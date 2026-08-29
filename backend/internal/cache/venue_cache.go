// Package cache provides the thread-safe in-memory venue state engine.
// It is the absolute Single Source of Truth for live table status.
package cache

import (
	"fmt"
	"log/slog"
	"sync"

	"gbc/backend/internal/domain"
)

// VenueCache holds the runtime state for all 4 tables, guarded by a RWMutex.
// After every mutation, a snapshot is pushed to broadcastChan for the WS hub
// without holding the lock (non-blocking send prevents the hub from stalling writes).
type VenueCache struct {
	mu            sync.RWMutex
	tables        map[int]domain.TableState
	broadcastChan chan<- []domain.TableState
}

// New initialises the cache with all 4 tables in AVAILABLE/PENDING-OFF state.
func New(broadcastChan chan<- []domain.TableState) *VenueCache {
	c := &VenueCache{
		tables:        make(map[int]domain.TableState, 4),
		broadcastChan: broadcastChan,
	}
	for i := 1; i <= 4; i++ {
		c.tables[i] = domain.TableState{
			TableID:        i,
			TableName:      fmt.Sprintf("Table 0%d", i),
			Status:         domain.StatusAvailable,
			LightStatus:    domain.LightPendingOff,
			CurrentBooking: nil,
		}
	}
	return c
}

// ─── Read Methods ─────────────────────────────────────────────────────────────

func (c *VenueCache) GetTable(tableID int) (domain.TableState, bool) {
	c.mu.RLock()
	t, ok := c.tables[tableID]
	c.mu.RUnlock()
	return t, ok
}

func (c *VenueCache) GetAll() []domain.TableState {
	c.mu.RLock()
	out := make([]domain.TableState, 0, 4)
	for i := 1; i <= 4; i++ {
		out = append(out, c.tables[i])
	}
	c.mu.RUnlock()
	return out
}

// ─── Boot Hydration (silent, no broadcast) ────────────────────────────────────

// HydrateTable sets the state of a table at boot without broadcasting.
// Call this before the WS hub goroutine starts.
func (c *VenueCache) HydrateTable(tableID int, booking *domain.CurrentBooking) {
	c.mu.Lock()
	t := c.tables[tableID]
	if booking != nil {
		t.Status = domain.StatusBusy
		t.LightStatus = domain.LightOn // already confirmed ON from DB
		t.CurrentBooking = booking
	} else {
		t.Status = domain.StatusAvailable
		t.LightStatus = domain.LightPendingOff
		t.CurrentBooking = nil
	}
	c.tables[tableID] = t
	c.mu.Unlock()
}

// ─── Mutating Methods (each broadcasts after unlock) ─────────────────────────

// ActivateTable transitions a table to BUSY and sends a relay ON command via broadcast.
func (c *VenueCache) ActivateTable(tableID int, booking domain.CurrentBooking) {
	c.mu.Lock()
	t := c.tables[tableID]
	t.Status = domain.StatusBusy
	t.LightStatus = domain.LightPendingOn
	t.CurrentBooking = &booking
	c.tables[tableID] = t
	c.mu.Unlock()
	slog.Info("Cache: table activated", "tableId", tableID, "booking", booking.BookingID)
	c.broadcast()
}

// DeactivateTable transitions a table to AVAILABLE and triggers a relay OFF command.
func (c *VenueCache) DeactivateTable(tableID int) {
	c.mu.Lock()
	t := c.tables[tableID]
	t.Status = domain.StatusAvailable
	t.LightStatus = domain.LightPendingOff
	t.CurrentBooking = nil
	c.tables[tableID] = t
	c.mu.Unlock()
	slog.Info("Cache: table deactivated", "tableId", tableID)
	c.broadcast()
}

// SetLightStatus manually overrides the light state (used by the manual toggle API).
func (c *VenueCache) SetLightStatus(tableID int, targetState domain.LightStatus) {
	c.mu.Lock()
	t := c.tables[tableID]
	if targetState == domain.LightOn {
		t.LightStatus = domain.LightPendingOn
	} else {
		t.LightStatus = domain.LightPendingOff
	}
	c.tables[tableID] = t
	c.mu.Unlock()
	slog.Info("Cache: light status set", "tableId", tableID, "target", targetState)
	c.broadcast()
}

// ConfirmLightStatus resolves a PENDING state to a final state after hardware ACK.
func (c *VenueCache) ConfirmLightStatus(tableID int, state domain.LightStatus) {
	c.mu.Lock()
	t := c.tables[tableID]
	changed := t.LightStatus != state
	if changed {
		t.LightStatus = state
		c.tables[tableID] = t
	}
	c.mu.Unlock()
	if changed {
		slog.Info("Cache: light confirmed", "tableId", tableID, "state", state)
		c.broadcast()
	}
}

// ConfirmFullSync resolves all PENDING states after a full hardware sync ACK.
func (c *VenueCache) ConfirmFullSync() {
	c.mu.Lock()
	changed := false
	for id, t := range c.tables {
		if t.LightStatus == domain.LightPendingOn {
			t.LightStatus = domain.LightOn
			c.tables[id] = t
			changed = true
		} else if t.LightStatus == domain.LightPendingOff {
			t.LightStatus = domain.LightOff
			c.tables[id] = t
			changed = true
		}
	}
	c.mu.Unlock()
	if changed {
		slog.Info("Cache: full sync confirmed")
		c.broadcast()
	}
}

// UpdateCurrentBooking patches the live booking metadata on an active table (used by PATCH booking).
func (c *VenueCache) UpdateCurrentBooking(tableID int, partial domain.CurrentBooking) {
	c.mu.Lock()
	t, ok := c.tables[tableID]
	if ok && t.CurrentBooking != nil {
		t.CurrentBooking = &partial
		c.tables[tableID] = t
	}
	c.mu.Unlock()
	if ok {
		c.broadcast()
	}
}

// ─── Private ──────────────────────────────────────────────────────────────────

// broadcast sends a non-blocking snapshot to the WS hub's broadcast channel.
// If the channel buffer is full, the update is dropped (the next mutation will send a fresh snapshot).
func (c *VenueCache) broadcast() {
	snapshot := c.GetAll()
	select {
	case c.broadcastChan <- snapshot:
	default:
		slog.Warn("Cache: broadcast channel full — snapshot dropped")
	}
}
