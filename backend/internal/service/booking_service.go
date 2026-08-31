package service

import (
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"

	"gbc/backend/internal/domain"
	"gbc/backend/pkg/timeutil"
)

// BookingService implements all booking use cases with per-table mutex serialization,
// mirroring the async-mutex pattern from the NestJS implementation.
//
// Every write operation (create/update/cancel) acquires the per-table mutex so that
// the overlap check and the subsequent write are atomic — preventing double-booking
// under concurrent requests.
type BookingService struct {
	bookingRepo  domain.BookingRepository
	configRepo   domain.ConfigRepository
	tableSvc     *TableService
	timelineChan chan<- []domain.Booking
	logger       *slog.Logger

	// Per-table mutexes: the check + write must be serialized per table.
	// Different tables proceed independently.
	mu    sync.Mutex          // guards the tableMutexes map itself
	tblMu map[int]*sync.Mutex // one mutex per tableID
}

// NewBookingService creates a new BookingService.
func NewBookingService(
	bookingRepo domain.BookingRepository,
	configRepo domain.ConfigRepository,
	tableSvc *TableService,
	timelineChan chan<- []domain.Booking,
) *BookingService {
	tblMu := make(map[int]*sync.Mutex, 4)
	for i := 1; i <= 4; i++ {
		tblMu[i] = &sync.Mutex{}
	}
	return &BookingService{
		bookingRepo:  bookingRepo,
		configRepo:   configRepo,
		tableSvc:     tableSvc,
		timelineChan: timelineChan,
		logger:       slog.Default().With("module", "BOOK"),
		tblMu:        tblMu,
	}
}

func (s *BookingService) getTableMutex(tableID int) *sync.Mutex {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m, ok := s.tblMu[tableID]; ok {
		return m
	}
	m := &sync.Mutex{}
	s.tblMu[tableID] = m
	return m
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

// CreateBooking validates, saves a booking, and syncs the cache/MQTT if it is immediately active.
func (s *BookingService) CreateBooking(dto CreateBookingInput, createdBy, role string) (*domain.Booking, error) {
	m := s.getTableMutex(dto.TableID)
	m.Lock()
	defer m.Unlock()

	checkIn, checkOut, duration, err := parseTimes(dto.CheckInTime, dto.CheckOutTime)
	if err != nil {
		return nil, err
	}

	// Role-based temporal restriction: staff cannot book into a past operational day
	now := time.Now().UTC()
	if checkIn.Before(now) && role != "admin" {
		cfg, _ := s.configRepo.Get()
		venueStart := "09:00"
		if cfg != nil {
			venueStart = cfg.VenueStartTime
		}
		bounds, _ := timeutil.GetOperationalDayBounds(now.Format("2006-01-02"), venueStart)
		if checkIn.Before(bounds.Start) {
			return nil, &ValidationError{Code: 400, Message: "staff cannot create bookings in the past outside the current operational day"}
		}
	}

	// Overlap check (serialized by mutex)
	overlap, err := s.bookingRepo.HasOverlap(dto.TableID, checkIn, checkOut, "")
	if err != nil {
		return nil, fmt.Errorf("overlap check: %w", err)
	}
	if overlap {
		return nil, &ValidationError{Code: 409, Message: fmt.Sprintf("table %d is already booked during this time window", dto.TableID)}
	}

	b := &domain.Booking{
		TableID:         dto.TableID,
		BookerName:      dto.BookerName,
		BookerMobile:    dto.BookerMobile,
		CheckInTime:     checkIn,
		CheckOutTime:    checkOut,
		DurationMinutes: duration,
		Amount:          dto.Amount,
		IsPaid:          dto.IsPaid,
		Status:          "ACTIVE",
		CreatedBy:       createdBy,
		CreatedAt:       now,
	}

	if err := s.bookingRepo.Create(b); err != nil {
		return nil, fmt.Errorf("create booking: %w", err)
	}
	s.logger.Info("Booking created", "id", b.ID, "tableId", dto.TableID)

	// Sync cache if this booking is already live
	syncNow := time.Now().UTC()
	if !checkIn.After(syncNow) && checkOut.After(syncNow) {
		s.tableSvc.ActivateTable(dto.TableID, domain.CurrentBooking{
			BookingID:       b.ID,
			BookerName:      b.BookerName,
			BookerMobile:    b.BookerMobile,
			CheckInTime:     b.CheckInTime.UTC().Format(time.RFC3339),
			CheckOutTime:    b.CheckOutTime.UTC().Format(time.RFC3339),
			DurationMinutes: b.DurationMinutes,
			Amount:          b.Amount,
			IsPaid:          b.IsPaid,
		}, "booking-create")
	}

	s.emitTimelineUpdate()
	return b, nil
}

// ─── GET TIMELINE ──────────────────────────────────────────────────────────────

// GetTimeline returns all non-cancelled bookings for the operational day of dateStr.
// Implements domain.TimelineProvider.
func (s *BookingService) GetTimeline(dateStr string) ([]domain.Booking, error) {
	cfg, _ := s.configRepo.Get()
	venueStart := "09:00"
	if cfg != nil {
		venueStart = cfg.VenueStartTime
	}
	bounds, err := timeutil.GetOperationalDayBounds(dateStr, venueStart)
	if err != nil {
		return nil, fmt.Errorf("timeline bounds: %w", err)
	}
	return s.bookingRepo.FindTimeline(bounds.Start, bounds.End)
}

// ─── UPDATE ────────────────────────────────────────────────────────────────────

// UpdateBooking partially updates a booking (times, amount, isPaid).
func (s *BookingService) UpdateBooking(id string, dto UpdateBookingInput) (*domain.Booking, error) {
	// Pre-fetch to discover the tableID for the mutex
	b, err := s.bookingRepo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("fetch booking: %w", err)
	}
	if b == nil || b.Status == "CANCELLED" {
		return nil, &ValidationError{Code: 404, Message: "booking not found or already cancelled"}
	}

	m := s.getTableMutex(b.TableID)
	m.Lock()
	defer m.Unlock()

	// Re-fetch inside the mutex to get the latest state
	fresh, err := s.bookingRepo.FindByID(id)
	if err != nil || fresh == nil || fresh.Status == "CANCELLED" {
		return nil, &ValidationError{Code: 404, Message: "booking not found or already cancelled"}
	}

	if dto.CheckOutTime != "" || dto.CheckInTime != "" {
		newIn := fresh.CheckInTime
		newOut := fresh.CheckOutTime
		if dto.CheckInTime != "" {
			newIn, err = time.Parse(time.RFC3339, dto.CheckInTime)
			if err != nil {
				return nil, &ValidationError{Code: 400, Message: "invalid checkInTime"}
			}
		}
		if dto.CheckOutTime != "" {
			newOut, err = time.Parse(time.RFC3339, dto.CheckOutTime)
			if err != nil {
				return nil, &ValidationError{Code: 400, Message: "invalid checkOutTime"}
			}
		}
		if !newOut.After(newIn) {
			return nil, &ValidationError{Code: 400, Message: "checkOutTime must be after checkInTime"}
		}
		overlap, err := s.bookingRepo.HasOverlap(fresh.TableID, newIn, newOut, id)
		if err != nil {
			return nil, fmt.Errorf("overlap check: %w", err)
		}
		if overlap {
			return nil, &ValidationError{Code: 409, Message: fmt.Sprintf("table %d already booked in this window", fresh.TableID)}
		}
		fresh.CheckInTime = newIn
		fresh.CheckOutTime = newOut
		fresh.DurationMinutes = int(math.Round(newOut.Sub(newIn).Minutes()))
	}
	if dto.BookerName != nil {
		fresh.BookerName = *dto.BookerName
	}
	if dto.BookerMobile != nil {
		fresh.BookerMobile = *dto.BookerMobile
	}
	if dto.Amount != nil {
		fresh.Amount = *dto.Amount
	}
	if dto.IsPaid != nil {
		fresh.IsPaid = *dto.IsPaid
	}

	if err := s.bookingRepo.Save(fresh); err != nil {
		return nil, fmt.Errorf("save booking: %w", err)
	}
	s.logger.Info("Booking updated", "id", id)

	// Sync cache if the booking is currently active
	now := time.Now().UTC()
	if !fresh.CheckInTime.After(now) && fresh.CheckOutTime.After(now) {
		s.tableSvc.UpdateCurrentBooking(fresh.TableID, domain.CurrentBooking{
			BookingID:       fresh.ID,
			BookerName:      fresh.BookerName,
			BookerMobile:    fresh.BookerMobile,
			CheckInTime:     fresh.CheckInTime.UTC().Format(time.RFC3339),
			CheckOutTime:    fresh.CheckOutTime.UTC().Format(time.RFC3339),
			DurationMinutes: fresh.DurationMinutes,
			Amount:          fresh.Amount,
			IsPaid:          fresh.IsPaid,
		})
	}

	s.emitTimelineUpdate()
	return fresh, nil
}

// ─── CANCEL ────────────────────────────────────────────────────────────────────

// CancelBooking soft-cancels a booking and deactivates the table if it is currently active.
func (s *BookingService) CancelBooking(id string) (*domain.Booking, error) {
	b, err := s.bookingRepo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("fetch booking: %w", err)
	}
	if b == nil || b.Status == "CANCELLED" {
		return nil, &ValidationError{Code: 404, Message: "booking not found or already cancelled"}
	}

	m := s.getTableMutex(b.TableID)
	m.Lock()
	defer m.Unlock()

	fresh, err := s.bookingRepo.FindByID(id)
	if err != nil || fresh == nil || fresh.Status == "CANCELLED" {
		return nil, &ValidationError{Code: 404, Message: "booking not found or already cancelled"}
	}

	fresh.Status = "CANCELLED"
	if err := s.bookingRepo.Save(fresh); err != nil {
		return nil, fmt.Errorf("save cancelled booking: %w", err)
	}
	s.logger.Info("Booking cancelled", "id", id)

	// Deactivate the table if this booking is currently active in the cache
	now := time.Now().UTC()
	if !fresh.CheckInTime.After(now) && fresh.CheckOutTime.After(now) {
		if table, ok := s.tableSvc.GetTable(fresh.TableID); ok {
			if table.CurrentBooking != nil && table.CurrentBooking.BookingID == id {
				s.tableSvc.DeactivateTable(fresh.TableID, "booking-cancel")
			}
		}
	}

	s.emitTimelineUpdate()
	return fresh, nil
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

func (s *BookingService) emitTimelineUpdate() {
	tl, err := s.GetTimeline(timeutil.TodayVenueString())
	if err != nil {
		s.logger.Error("failed to fetch timeline", "err", err)
		return
	}
	select {
	case s.timelineChan <- tl:
	default:
		s.logger.Warn("timelineChan full, timeline update dropped")
	}
}

func parseTimes(checkInStr, checkOutStr string) (time.Time, time.Time, int, error) {
	checkIn, err := time.Parse(time.RFC3339, checkInStr)
	if err != nil {
		return time.Time{}, time.Time{}, 0, &ValidationError{Code: 400, Message: "invalid checkInTime: must be ISO 8601"}
	}
	checkOut, err := time.Parse(time.RFC3339, checkOutStr)
	if err != nil {
		return time.Time{}, time.Time{}, 0, &ValidationError{Code: 400, Message: "invalid checkOutTime: must be ISO 8601"}
	}
	duration := int(math.Round(checkOut.Sub(checkIn).Minutes()))
	if duration <= 0 {
		return time.Time{}, time.Time{}, 0, &ValidationError{Code: 400, Message: "checkOutTime must be after checkInTime"}
	}
	return checkIn.UTC(), checkOut.UTC(), duration, nil
}

// ─── Input DTOs ────────────────────────────────────────────────────────────────

// CreateBookingInput holds the validated fields for creating a booking.
type CreateBookingInput struct {
	TableID      int
	BookerName   string
	BookerMobile string
	CheckInTime  string
	CheckOutTime string
	Amount       float64
	IsPaid       bool
}

// UpdateBookingInput holds the optional fields for a partial booking update.
type UpdateBookingInput struct {
	BookerName   *string
	BookerMobile *string
	CheckInTime  string
	CheckOutTime string
	Amount       *float64
	IsPaid       *bool
}

// ValidationError is a sentinel error type that carries an HTTP status code.
type ValidationError struct {
	Code    int
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}
