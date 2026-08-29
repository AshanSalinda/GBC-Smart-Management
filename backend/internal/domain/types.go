// Package domain defines the core business types and repository/service interfaces.
// This package has zero external dependencies — it is the innermost layer of the
// Clean Architecture and may be imported by any other package safely.
package domain

import "time"

// ─── Table State ──────────────────────────────────────────────────────────────

// TableStatus represents the booking occupancy of a table.
type TableStatus string

const (
	StatusAvailable TableStatus = "AVAILABLE"
	StatusBusy      TableStatus = "BUSY"
	StatusPending   TableStatus = "PENDING"
)

// LightStatus represents the physical relay (light) state.
type LightStatus string

const (
	LightOn         LightStatus = "ON"
	LightOff        LightStatus = "OFF"
	LightPendingOn  LightStatus = "PENDING-ON"
	LightPendingOff LightStatus = "PENDING-OFF"
)

// CurrentBooking holds the live booking metadata attached to a BUSY table.
type CurrentBooking struct {
	BookingID       string  `json:"bookingId"`
	BookerName      string  `json:"bookerName"`
	BookerMobile    string  `json:"bookerMobile"`
	CheckInTime     string  `json:"checkInTime"`  // ISO 8601 UTC
	CheckOutTime    string  `json:"checkOutTime"` // ISO 8601 UTC
	DurationMinutes int     `json:"durationMinutes"`
	Amount          float64 `json:"amount"`
	IsPaid          bool    `json:"isPaid"`
}

// TableState is the complete runtime state of one table held in the in-memory cache.
type TableState struct {
	TableID        int             `json:"tableId"`
	TableName      string          `json:"tableName"`
	Status         TableStatus     `json:"status"`
	LightStatus    LightStatus     `json:"lightStatus"`
	CurrentBooking *CurrentBooking `json:"currentBooking"`
}

// ─── Database Models ──────────────────────────────────────────────────────────

// Booking is the domain model for a reservation record.
type Booking struct {
	ID              string    `json:"id"`
	TableID         int       `json:"tableId"`
	BookerName      string    `json:"bookerName"`
	BookerMobile    string    `json:"bookerMobile"`
	CheckInTime     time.Time `json:"checkInTime"`
	CheckOutTime    time.Time `json:"checkOutTime"`
	DurationMinutes int       `json:"durationMinutes"`
	Amount          float64   `json:"amount"`
	IsPaid          bool      `json:"isPaid"`
	Status          string    `json:"status"` // "ACTIVE" | "CANCELLED"
	CreatedBy       string    `json:"createdBy"`
	CreatedAt       time.Time `json:"createdAt"`
}

// VenueConfig is the global configuration stored in MongoDB.
type VenueConfig struct {
	HourlyRate     float64   `json:"hourlyRate"`
	VenueCloseTime string    `json:"venueCloseTime"`
	VenueStartTime string    `json:"venueStartTime"` // "HH:MM"
	UpdatedAt      time.Time `json:"updatedAt"`
}

// ─── Inter-Service Messages ────────────────────────────────────────────────────

// MqttCommand is the message produced by TableService and consumed by MqttClient.
// Using a channel instead of a direct call prevents circular imports between the
// service and hardware packages.
type MqttCommand struct {
	CommandID  string
	TableID    int
	LightState string // "ON" | "OFF"
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

// AuthUser holds the verified Firebase identity injected into request context.
type AuthUser struct {
	UID   string
	Email string
	Role  string
}

// ─── Repository Interfaces (Ports) ────────────────────────────────────────────

// BookingRepository defines the data-access contract for the bookings collection.
type BookingRepository interface {
	// Create inserts a new booking and sets its ID.
	Create(b *Booking) error
	// FindByID returns a single booking by its hex ObjectID string.
	FindByID(id string) (*Booking, error)
	// Save persists changes to an existing booking document.
	Save(b *Booking) error
	// FindTimeline returns all non-cancelled bookings within [start, end).
	FindTimeline(start, end time.Time) ([]Booking, error)
	// FindCurrentForTable returns the active booking for tableID at time now, or nil.
	FindCurrentForTable(tableID int, now time.Time) (*Booking, error)
	// FindNextUpcoming returns the earliest future booking for tableID after `after`.
	FindNextUpcoming(tableID int, after time.Time) (*Booking, error)
	// FindAllActiveNow returns all active bookings across all tables at time now.
	FindAllActiveNow(now time.Time) ([]Booking, error)
	// HasOverlap checks whether any non-cancelled booking on tableID overlaps [checkIn, checkOut).
	// excludeID (may be "") is excluded from the check (for PATCH operations).
	HasOverlap(tableID int, checkIn, checkOut time.Time, excludeID string) (bool, error)
}

// ConfigRepository defines the data-access contract for the configs collection.
type ConfigRepository interface {
	// Get returns the global config document.
	Get() (*VenueConfig, error)
	// Update applies partial field updates to the global config.
	Update(updates map[string]any) (*VenueConfig, error)
	// EnsureDefault creates a default config document if none exists.
	EnsureDefault() error
}

// ─── Cache Interface ──────────────────────────────────────────────────────────

// TableCache defines the contract for the thread-safe in-memory venue state.
type TableCache interface {
	GetTable(tableID int) (TableState, bool)
	GetAll() []TableState
	// HydrateTable sets table state silently on boot without broadcasting.
	HydrateTable(tableID int, booking *CurrentBooking)
	ActivateTable(tableID int, booking CurrentBooking)
	DeactivateTable(tableID int)
	SetLightStatus(tableID int, targetState LightStatus)
	SetAllLightStatuses(targetState LightStatus)
	ConfirmLightStatus(tableID int, state LightStatus)
	ConfirmAllLightStatuses(state LightStatus)
	ConfirmFullSync()
	UpdateCurrentBooking(tableID int, partial CurrentBooking)
}

// ─── Service Interfaces ───────────────────────────────────────────────────────

// TableCoordinator is the narrow interface the MQTT client calls back on ACK/sync.
// Implemented by TableService. Keeping it here prevents hardware → service import.
type TableCoordinator interface {
	ConfirmLightStatus(tableID int, state LightStatus)
	ConfirmFullSync()
	GetCacheSnapshot() []TableState
}

// TimelineProvider is the narrow interface the WS hub uses to fetch today's timeline.
type TimelineProvider interface {
	GetTimeline(dateStr string) ([]Booking, error)
}
