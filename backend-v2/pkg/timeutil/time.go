// Package timeutil provides venue-aware operational day boundary calculations.
// The GBC venue operates on a non-calendar day: from venueStartTime to 06:00 the next day.
package timeutil

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// DayBounds holds the inclusive start and exclusive end of one operational day.
type DayBounds struct {
	Start time.Time
	End   time.Time
}

// GetOperationalDayBounds returns the start and end of an operational day for the given date.
//
// The operational day starts at venueStartTime (e.g. "09:00" UTC) on dateStr
// and ends at 06:00 UTC the following calendar day.
//
// dateStr may be a bare "YYYY-MM-DD" or a full ISO 8601 string (only the date part is used).
// venueStartTime must be in "HH:MM" format.
func GetOperationalDayBounds(dateStr, venueStartTime string) (DayBounds, error) {
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

	// Parse venue start time
	tparts := strings.Split(venueStartTime, ":")
	if len(tparts) < 2 {
		tparts = []string{"09", "00"}
	}
	startHour, _ := strconv.Atoi(tparts[0])
	startMin, _ := strconv.Atoi(tparts[1])

	start := time.Date(year, time.Month(month), day, startHour, startMin, 0, 0, time.UTC)
	// Operational day ends at 06:00 the next calendar day
	end := time.Date(year, time.Month(month), day+1, 6, 0, 0, 0, time.UTC)

	return DayBounds{Start: start, End: end}, nil
}

// TodayString returns the current UTC date as "YYYY-MM-DD".
func TodayString() string {
	return time.Now().UTC().Format("2006-01-02")
}
