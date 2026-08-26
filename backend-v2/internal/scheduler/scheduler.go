// Package scheduler implements two complementary booking state engines:
//
//  1. Deadline timer engine (primary): uses time.AfterFunc to fire at the exact
//     checkInTime and checkOutTime of each booking — same precision as NestJS setTimeout.
//
//  2. 5-second reconcile tick (safety net): a goroutine-based ticker that catches
//     any timers missed due to process restart or clock drift.
package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"gbc/backend/internal/domain"
	"gbc/backend/internal/service"
)

// Scheduler manages deadline timers for all 4 tables.
type Scheduler struct {
	bookingRepo domain.BookingRepository
	tableSvc    *service.TableService

	mu     sync.Mutex
	timers map[string]*time.Timer // keyed by "{tableId}:start" or "{tableId}:end"
}

// New creates a new Scheduler. Call Start() to begin the reconcile loop.
func New(bookingRepo domain.BookingRepository, tableSvc *service.TableService) *Scheduler {
	return &Scheduler{
		bookingRepo: bookingRepo,
		tableSvc:    tableSvc,
		timers:      make(map[string]*time.Timer),
	}
}

// InitAll queries the DB and schedules deadline timers for all 4 tables.
// Call this once at boot, after cache hydration.
func (s *Scheduler) InitAll() {
	for tableID := 1; tableID <= 4; tableID++ {
		if err := s.RescheduleTable(tableID); err != nil {
			slog.Error("Scheduler: failed to init table", "tableId", tableID, "err", err)
		}
	}
	slog.Info("Scheduler: deadline timers initialized for all tables")
}

// RescheduleTable clears existing timers for a table and sets new ones based on DB state.
// Safe to call after any booking mutation.
func (s *Scheduler) RescheduleTable(tableID int) error {
	s.clearTableTimers(tableID)
	now := time.Now().UTC()

	// 1. Is there an active booking right now? Schedule its end.
	active, err := s.bookingRepo.FindCurrentForTable(tableID, now)
	if err != nil {
		return err
	}
	if active != nil {
		s.setEndTimer(tableID, active.ID, active.CheckOutTime)
		return nil // end-timer callback chains to the next booking's start
	}

	// 2. No active booking → schedule the next upcoming one.
	next, err := s.bookingRepo.FindNextUpcoming(tableID, now)
	if err != nil {
		return err
	}
	if next != nil {
		s.setStartTimer(tableID, next.ID, next.CheckInTime)
	}
	return nil
}

// StartReconcileLoop starts the 5-second safety-net reconcile goroutine.
// The loop exits when ctx is cancelled.
func (s *Scheduler) StartReconcileLoop(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.reconcile()
			}
		}
	}()
}

// StopAll cancels all pending timers (called on graceful shutdown).
func (s *Scheduler) StopAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for key, t := range s.timers {
		t.Stop()
		delete(s.timers, key)
	}
	slog.Info("Scheduler: all timers stopped")
}

// ─── Timer Setters ────────────────────────────────────────────────────────────

func (s *Scheduler) setStartTimer(tableID int, bookingID string, checkIn time.Time) {
	delay := time.Until(checkIn)
	if delay < 0 {
		delay = 0
	}
	key := timerKey(tableID, "start")
	s.clearTimer(key)

	timer := time.AfterFunc(delay, func() {
		s.handleStartFired(tableID, bookingID)
	})

	s.mu.Lock()
	s.timers[key] = timer
	s.mu.Unlock()

	slog.Info("Scheduler: START timer set", "tableId", tableID, "checkIn", checkIn.Format(time.RFC3339), "inSeconds", int(delay.Seconds()))
}

func (s *Scheduler) setEndTimer(tableID int, bookingID string, checkOut time.Time) {
	delay := time.Until(checkOut)
	if delay < 0 {
		delay = 0
	}
	key := timerKey(tableID, "end")
	s.clearTimer(key)

	timer := time.AfterFunc(delay, func() {
		s.handleEndFired(tableID, bookingID)
	})

	s.mu.Lock()
	s.timers[key] = timer
	s.mu.Unlock()

	slog.Info("Scheduler: END timer set", "tableId", tableID, "checkOut", checkOut.Format(time.RFC3339), "inSeconds", int(delay.Seconds()))
}

// ─── Timer Callbacks ──────────────────────────────────────────────────────────

// handleStartFired fires at the exact checkInTime.
// Re-fetches from DB to verify the booking is still valid before activating.
func (s *Scheduler) handleStartFired(tableID int, bookingID string) {
	s.mu.Lock()
	delete(s.timers, timerKey(tableID, "start"))
	s.mu.Unlock()

	b, err := s.bookingRepo.FindByID(bookingID)
	if err != nil {
		slog.Error("Scheduler: start-timer DB error", "tableId", tableID, "err", err)
		return
	}
	if b == nil || b.Status == "CANCELLED" {
		slog.Warn("Scheduler: start-timer fired but booking gone — rescheduling", "tableId", tableID, "bookingId", bookingID)
		s.RescheduleTable(tableID)
		return
	}

	now := time.Now().UTC()
	if !b.CheckInTime.After(now) && b.CheckOutTime.After(now) {
		slog.Info("Scheduler: ACTIVATING table via deadline timer", "tableId", tableID, "bookingId", bookingID)
		s.tableSvc.ActivateTable(tableID, domain.CurrentBooking{
			BookingID:       b.ID,
			BookerName:      b.BookerName,
			BookerMobile:    b.BookerMobile,
			CheckInTime:     b.CheckInTime.UTC().Format(time.RFC3339),
			CheckOutTime:    b.CheckOutTime.UTC().Format(time.RFC3339),
			DurationMinutes: b.DurationMinutes,
			Amount:          b.Amount,
			IsPaid:          b.IsPaid,
		}, "timer-start")
		// Chain: schedule the end timer for this booking
		s.setEndTimer(tableID, b.ID, b.CheckOutTime)
	} else {
		slog.Warn("Scheduler: start-timer timing mismatch — rescheduling", "tableId", tableID)
		s.RescheduleTable(tableID)
	}
}

// handleEndFired fires at the exact checkOutTime.
// Verifies the table is still BUSY with this specific booking before deactivating.
func (s *Scheduler) handleEndFired(tableID int, bookingID string) {
	s.mu.Lock()
	delete(s.timers, timerKey(tableID, "end"))
	s.mu.Unlock()

	table, ok := s.tableSvc.GetTable(tableID)
	if ok && table.Status == domain.StatusBusy && table.CurrentBooking != nil && table.CurrentBooking.BookingID == bookingID {
		slog.Info("Scheduler: DEACTIVATING table via deadline timer", "tableId", tableID, "bookingId", bookingID)
		s.tableSvc.DeactivateTable(tableID, "timer-end")
	} else {
		slog.Warn("Scheduler: end-timer state mismatch — skipping deactivation", "tableId", tableID)
	}

	// Chain: find the next upcoming booking and schedule its start
	now := time.Now().UTC()
	next, err := s.bookingRepo.FindNextUpcoming(tableID, now)
	if err != nil {
		slog.Error("Scheduler: failed to find next booking", "tableId", tableID, "err", err)
		return
	}
	if next != nil {
		s.setStartTimer(tableID, next.ID, next.CheckInTime)
	}
}

// ─── 5-Second Reconcile ───────────────────────────────────────────────────────

func (s *Scheduler) reconcile() {
	now := time.Now().UTC()
	for tableID := 1; tableID <= 4; tableID++ {
		table, ok := s.tableSvc.GetTable(tableID)
		if !ok {
			continue
		}

		// Expired booking still shown as BUSY → timer missed, deactivate
		if table.Status == domain.StatusBusy && table.CurrentBooking != nil {
			checkOut, err := time.Parse(time.RFC3339, table.CurrentBooking.CheckOutTime)
			if err == nil && !now.Before(checkOut) {
				slog.Warn("Scheduler(reconcile): booking expired, timer missed — deactivating", "tableId", tableID)
				s.tableSvc.DeactivateTable(tableID, "cron-reconcile")
				s.RescheduleTable(tableID)
			}
			continue
		}

		// Table is AVAILABLE but an active booking exists in DB → timer missed, activate
		if table.Status == domain.StatusAvailable {
			active, err := s.bookingRepo.FindCurrentForTable(tableID, now)
			if err != nil || active == nil {
				continue
			}
			slog.Warn("Scheduler(reconcile): booking should be active, timer missed — activating", "tableId", tableID, "bookingId", active.ID)
			s.tableSvc.ActivateTable(tableID, domain.CurrentBooking{
				BookingID:       active.ID,
				BookerName:      active.BookerName,
				BookerMobile:    active.BookerMobile,
				CheckInTime:     active.CheckInTime.UTC().Format(time.RFC3339),
				CheckOutTime:    active.CheckOutTime.UTC().Format(time.RFC3339),
				DurationMinutes: active.DurationMinutes,
				Amount:          active.Amount,
				IsPaid:          active.IsPaid,
			}, "cron-reconcile")
			s.RescheduleTable(tableID)
		}
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (s *Scheduler) clearTableTimers(tableID int) {
	s.clearTimer(timerKey(tableID, "start"))
	s.clearTimer(timerKey(tableID, "end"))
}

func (s *Scheduler) clearTimer(key string) {
	s.mu.Lock()
	if t, ok := s.timers[key]; ok {
		t.Stop()
		delete(s.timers, key)
	}
	s.mu.Unlock()
}

func timerKey(tableID int, kind string) string {
	return fmt.Sprintf("%d:%s", tableID, kind)
}
