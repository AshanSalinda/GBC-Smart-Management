import { DateTime } from 'luxon';

const VENUE_TIMEZONE = 'Asia/Colombo';

/**
 * Calculates the operational day boundaries for the GBC venue.
 *
 * An "operational day" does NOT align with a calendar day.
 * It starts at the venue opening time (from configs, e.g. 09:00)
 * and ends at the fixed cutoff of 06:00 the NEXT calendar day.
 *
 * All returned dates are in UTC.
 *
 * @param targetDate  - The date to calculate bounds for (YYYY-MM-DD string or JS Date).
 * @param venueStartTime - The venue opening time in HH:mm format (e.g. "09:00").
 * @returns { start: Date, end: Date } in UTC.
 */
export function getOperationalDayBounds(
  targetDate: Date | string,
  venueStartTime: string = '09:00',
): { start: Date; end: Date } {
  const [startHour, startMinute] = venueStartTime.split(':').map(Number);

  // Parse target date in venue timezone
  const baseDate =
    typeof targetDate === 'string'
      ? DateTime.fromISO(targetDate, { zone: VENUE_TIMEZONE })
      : DateTime.fromJSDate(targetDate, { zone: VENUE_TIMEZONE });

  // Operational day start: target date at venue opening time
  const start = baseDate
    .set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });

  // Operational day end: NEXT calendar day at 06:00 in venue timezone
  const end = baseDate
    .plus({ days: 1 })
    .set({ hour: 6, minute: 0, second: 0, millisecond: 0 });

  return {
    start: start.toUTC().toJSDate(),
    end: end.toUTC().toJSDate(),
  };
}
