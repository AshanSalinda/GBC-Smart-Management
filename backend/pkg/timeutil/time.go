// Package timeutil provides venue-aware operational day boundary calculations.
//
// The GBC venue operates on a non-calendar day that spans midnight:
// it begins at venueStartTime (local venue time) and closes the following morning at 06:00 local time.
//
// All boundaries are computed in the venue's local timezone (VENUE_TIMEZONE env var,
// defaults to "Asia/Colombo") and then returned as UTC time.Time values so that
// MongoDB range queries and Go time comparisons work correctly regardless of
// where the server binary is deployed.
//
// The blank import of "time/tzdata" embeds the full IANA timezone database directly
// into the binary. This ensures timezone lookups work on minimal container images
// (Alpine, scratch, distroless) that have no OS-level tzdata package installed.
package timeutil

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
	_ "time/tzdata" // embed IANA timezone DB into the binary
)

// colomboFallback is UTC+5:30 expressed as a fixed-offset zone.
// It is used when time.LoadLocation fails (should not happen after tzdata embed,
// but kept as a last-resort safety net so the server never panics).
var colomboFallback = time.FixedZone("Asia/Colombo", 5*60*60+30*60)

// DayBounds holds the inclusive start and exclusive end of one operational day,
// expressed in UTC so they are safe to use in MongoDB queries and time.Before/After calls.
type DayBounds struct {
	Start time.Time // venueStartTime on dateStr, in venue local tz → UTC
	End   time.Time // 06:00 the following calendar day, in venue local tz → UTC
}

// venueLocation is lazily loaded from the VENUE_TIMEZONE environment variable.
// All access is guarded by locationOnce so it is goroutine-safe.
var (
	locationOnce  sync.Once
	venueLocation *time.Location
)

// VenueLocation returns the venue's *time.Location.
// It reads VENUE_TIMEZONE once and caches the result for the lifetime of the process.
//
// Resolution order:
//  1. VENUE_TIMEZONE env var (any valid IANA name, e.g. "Asia/Colombo")
//  2. Hardcoded UTC+5:30 fixed-offset zone as an absolute fallback
//
// The embedded tzdata (time/tzdata import) ensures LoadLocation works even on
// minimal container images without an OS-level timezone database.
func VenueLocation() *time.Location {
	locationOnce.Do(func() {
		tz := os.Getenv("VENUE_TIMEZONE")
		if tz == "" {
			tz = "Asia/Colombo"
		}
		loc, err := time.LoadLocation(tz)
		if err != nil {
			// Should never happen after tzdata embed, but guard anyway.
			fmt.Printf("[timeutil] WARNING: cannot load timezone %q (%v) — using fixed UTC+5:30\n", tz, err)
			loc = colomboFallback
		}
		venueLocation = loc
	})
	return venueLocation
}

// GetOperationalDayBounds returns the UTC start and end of an operational day for the given date.
//
// The "date" (dateStr) is interpreted as a venue-local calendar date.
// The operational window is: [venueStartTime on dateStr] → [06:00 on dateStr+1].
// Both bounds are constructed in the venue's local timezone and then stored as UTC.
//
// dateStr may be a bare "YYYY-MM-DD" or a full ISO 8601 string (only the date part is used).
// venueStartTime and venueCloseTime must be in "HH:MM" format (venue local time).
func GetOperationalDayBounds(dateStr, venueStartTime, venueCloseTime string) (DayBounds, error) {
	loc := VenueLocation()

	// Use only the date portion
	dateOnly := dateStr
	if len(dateStr) > 10 {
		dateOnly = dateStr[:10]
	}

	parts := strings.Split(dateOnly, "-")
	if len(parts) != 3 {
		return DayBounds{}, fmt.Errorf("timeutil: invalid date %q, expected YYYY-MM-DD", dateStr)
	}
	year, err1 := strconv.Atoi(parts[0])
	month, err2 := strconv.Atoi(parts[1])
	day, err3 := strconv.Atoi(parts[2])
	if err1 != nil || err2 != nil || err3 != nil {
		return DayBounds{}, fmt.Errorf("timeutil: non-numeric date components in %q", dateStr)
	}

	// Parse venue start time (venue local)
	tparts := strings.Split(venueStartTime, ":")
	if len(tparts) < 2 {
		tparts = []string{"09", "00"}
	}
	startHour, _ := strconv.Atoi(tparts[0])
	startMin, _ := strconv.Atoi(tparts[1])

	// Parse venue close time (venue local)
	cparts := strings.Split(venueCloseTime, ":")
	if len(cparts) < 2 {
		cparts = []string{"06", "00"}
	}
	closeHour, _ := strconv.Atoi(cparts[0])
	closeMin, _ := strconv.Atoi(cparts[1])

	// Construct bounds in venue local time — Go converts to UTC internally.
	start := time.Date(year, time.Month(month), day, startHour, startMin, 0, 0, loc)
	// Operational day ends at venueCloseTime the following calendar day.
	end := time.Date(year, time.Month(month), day+1, closeHour, closeMin, 0, 0, loc)

	return DayBounds{Start: start.UTC(), End: end.UTC()}, nil
}

// TodayVenueString returns the current operational date string ("YYYY-MM-DD") for the venue.
// We subtract the closing hours and minutes from the current local time so the date
// naturally rolls over exactly at the venue's closing time.
func TodayVenueString(venueCloseTime string) string {
	cparts := strings.Split(venueCloseTime, ":")
	if len(cparts) < 2 {
		cparts = []string{"06", "00"}
	}
	closeHour, _ := strconv.Atoi(cparts[0])
	closeMin, _ := strconv.Atoi(cparts[1])

	now := time.Now().In(VenueLocation())
	// Subtract the close time so that anything before the close time shifts to the previous day
	shiftDuration := time.Duration(closeHour)*time.Hour + time.Duration(closeMin)*time.Minute
	operationalNow := now.Add(-shiftDuration)
	return operationalNow.Format("2006-01-02")
}
