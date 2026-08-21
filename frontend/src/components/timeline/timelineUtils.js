export const TIMELINE_CONFIG = {
  PIXELS_PER_MINUTE: 3,
  MIN_SLOT_MINS: 15,
};

// Calculate dynamic close hour based on bookings
export const getDynamicCloseHour = (bookings = [], openHour = 10, defaultCloseHour = 24) => {
  let maxHour = defaultCloseHour;
  for (const b of bookings) {
    const startMins = getMinutesFromOpen(b.startTime, openHour);
    const endMins = startMins + (b.duration / 60000);
    const endHour = openHour + Math.ceil(endMins / 60);
    if (endHour > maxHour) {
      maxHour = endHour;
    }
  }
  // Cap at 6 AM the next day
  return Math.min(maxHour, openHour + 20);
};

// Calculate total width in pixels
export const getTotalTimelineWidth = (openHour = 10, closeHour = 24) => {
  const totalMins = (closeHour - openHour) * 60;
  return totalMins * TIMELINE_CONFIG.PIXELS_PER_MINUTE;
};

// Returns the timestamp of the openHour for the given business day.
export function getTimelineStartOfDay(baseDate = new Date(), openHour = 10) {
  const d = new Date(baseDate);
  if (d.getHours() < openHour) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(openHour, 0, 0, 0);
  return d.getTime();
}

// Returns minutes from the start of the openHour for the given business day
export function getMinutesFromOpen(timestamp, openHour = 10, baseDate = new Date()) {
  if (!timestamp) return 0;
  const openTimeMs = getTimelineStartOfDay(baseDate, openHour);
  const diffMs = timestamp - openTimeMs;
  return Math.floor(diffMs / 60000);
}

// Convert timestamp to Left Offset in pixels
export function timeToPixels(timestamp, openHour = 10) {
  const mins = getMinutesFromOpen(timestamp, openHour);
  return mins * TIMELINE_CONFIG.PIXELS_PER_MINUTE;
}

// Convert duration in MS to width in pixels
export function durationToPixels(durationMs) {
  const mins = Math.floor(durationMs / 60000);
  return mins * TIMELINE_CONFIG.PIXELS_PER_MINUTE;
}

// Generate the hour labels for the header
export function getTimelineHeaders(openHour = 10, closeHour = 24) {
  const headers = [];
  for (let h = openHour; h <= closeHour; h++) {
    const hour24 = h % 24;
    const isMidnight = hour24 === 0;
    const hour12 = isMidnight ? 12 : (hour24 % 12 || 12);
    const ampm = isMidnight ? 'AM' : (hour24 < 12 ? 'AM' : 'PM');

    headers.push({
      type: 'hour',
      label: `${hour12}:00 ${ampm}`,
      left: (h - openHour) * 60 * TIMELINE_CONFIG.PIXELS_PER_MINUTE,
    });

    // Don't add sub-markers after the last hour
    if (h < closeHour) {
      headers.push({
        type: 'quarter',
        left: ((h - openHour) * 60 + 15) * TIMELINE_CONFIG.PIXELS_PER_MINUTE,
      });
      headers.push({
        type: 'half',
        left: ((h - openHour) * 60 + 30) * TIMELINE_CONFIG.PIXELS_PER_MINUTE,
      });
      headers.push({
        type: 'quarter',
        left: ((h - openHour) * 60 + 45) * TIMELINE_CONFIG.PIXELS_PER_MINUTE,
      });
    }
  }
  return headers;
}
