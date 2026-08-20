export const TIMELINE_CONFIG = {
  OPEN_HOUR: 10,
  CLOSE_HOUR: 24, // 12 AM
  PIXELS_PER_MINUTE: 3,
  MIN_SLOT_MINS: 15,
};

// Calculate dynamic close hour based on bookings
export const getDynamicCloseHour = (bookings = []) => {
  let maxHour = TIMELINE_CONFIG.CLOSE_HOUR;
  for (const b of bookings) {
    const startMins = getMinutesFromOpen(b.startTime);
    const endMins = startMins + (b.duration / 60000);
    const endHour = TIMELINE_CONFIG.OPEN_HOUR + Math.ceil(endMins / 60);
    if (endHour > maxHour) {
      maxHour = endHour;
    }
  }
  // Cap at 6 AM the next day (which is hour 30)
  return Math.min(maxHour, 30);
};

// Calculate total width in pixels
export const getTotalTimelineWidth = (closeHour = TIMELINE_CONFIG.CLOSE_HOUR) => {
  const totalMins = (closeHour - TIMELINE_CONFIG.OPEN_HOUR) * 60;
  return totalMins * TIMELINE_CONFIG.PIXELS_PER_MINUTE;
};

// Returns the timestamp of the OPEN_HOUR for the given business day.
// If the time is before OPEN_HOUR, it conceptually belongs to the previous business day.
export function getTimelineStartOfDay(baseDate = new Date()) {
  const d = new Date(baseDate);
  if (d.getHours() < TIMELINE_CONFIG.OPEN_HOUR) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(TIMELINE_CONFIG.OPEN_HOUR, 0, 0, 0);
  return d.getTime();
}

// Returns minutes from the start of the OPEN_HOUR for the given business day
export function getMinutesFromOpen(timestamp, baseDate = new Date()) {
  if (!timestamp) return 0;
  const openTimeMs = getTimelineStartOfDay(baseDate);
  const diffMs = timestamp - openTimeMs;
  return Math.floor(diffMs / 60000);
}

// Convert timestamp to Left Offset in pixels
export function timeToPixels(timestamp) {
  const mins = getMinutesFromOpen(timestamp);
  return mins * TIMELINE_CONFIG.PIXELS_PER_MINUTE;
}

// Convert duration in MS to width in pixels
export function durationToPixels(durationMs) {
  const mins = Math.floor(durationMs / 60000);
  return mins * TIMELINE_CONFIG.PIXELS_PER_MINUTE;
}

// Generate the hour labels for the header
export function getTimelineHeaders(closeHour = TIMELINE_CONFIG.CLOSE_HOUR) {
  const headers = [];
  for (let h = TIMELINE_CONFIG.OPEN_HOUR; h <= closeHour; h++) {
    const hour24 = h % 24;
    const isMidnight = hour24 === 0;
    const hour12 = isMidnight ? 12 : (hour24 % 12 || 12);
    const ampm = isMidnight ? 'AM' : (hour24 < 12 ? 'AM' : 'PM');

    headers.push({
      type: 'hour',
      label: `${hour12}:00 ${ampm}`,
      left: (h - TIMELINE_CONFIG.OPEN_HOUR) * 60 * TIMELINE_CONFIG.PIXELS_PER_MINUTE,
    });

    // Don't add sub-markers after the last hour
    if (h < closeHour) {
      headers.push({
        type: 'quarter',
        left: ((h - TIMELINE_CONFIG.OPEN_HOUR) * 60 + 15) * TIMELINE_CONFIG.PIXELS_PER_MINUTE,
      });
      headers.push({
        type: 'half',
        left: ((h - TIMELINE_CONFIG.OPEN_HOUR) * 60 + 30) * TIMELINE_CONFIG.PIXELS_PER_MINUTE,
      });
      headers.push({
        type: 'quarter',
        left: ((h - TIMELINE_CONFIG.OPEN_HOUR) * 60 + 45) * TIMELINE_CONFIG.PIXELS_PER_MINUTE,
      });
    }
  }
  return headers;
}
