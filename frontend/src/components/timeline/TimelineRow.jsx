import BookingBlock from './BookingBlock';
import FreeSlotButton from './FreeSlotButton';
import { TIMELINE_CONFIG, getTimelineStartOfDay } from './timelineUtils';

// Helper to calculate free slots between bookings
function calculateFreeSlots(bookings, closeHour, currentTime, openHour) {
  const freeSlots = [];
  
  const openTimeMs = getTimelineStartOfDay(new Date(), openHour);
  const closeTimeMs = openTimeMs + ((closeHour - openHour) * 3600000);

  let currentCursor = openTimeMs;
  const now = currentTime;

  const addSlotIfValid = (start, duration) => {
    let slotStart = start;
    const slotEnd = start + duration;

    // We cannot book in the past, so if slot starts before now, push its start to now
    if (slotStart < now) {
      slotStart = now;
    }

    const newDuration = slotEnd - slotStart;
    
    // Only add if remaining duration is >= min slot time
    if (newDuration >= TIMELINE_CONFIG.MIN_SLOT_MINS * 60000) {
      freeSlots.push({ startTimestamp: slotStart, durationMs: newDuration });
    }
  };

  // Sort bookings by start time
  const sortedBookings = [...bookings].sort((a, b) => a.startTime - b.startTime);

  sortedBookings.forEach((b) => {
    const gap = b.startTime - currentCursor;
    if (gap > 0) {
      addSlotIfValid(currentCursor, gap);
    }
    currentCursor = Math.max(currentCursor, b.startTime + b.duration);
  });

  // Check from last booking to close time
  const endGap = closeTimeMs - currentCursor;
  if (endGap > 0) {
    addSlotIfValid(currentCursor, endGap);
  }

  return freeSlots;
}

export default function TimelineRow({ table, width, bookings = [], isLast, closeHour, currentTime, onSlotClick, onEditBooking, openHour }) {
  const freeSlots = calculateFreeSlots(bookings, closeHour, currentTime, openHour);

  return (
    <div className={`relative h-[92px] flex items-center ${isLast ? '' : 'border-b border-[#2a2a2e]'}`} style={{ width: `${width}px` }}>
      {/* Existing Bookings */}
      {bookings.map((b) => (
        <BookingBlock key={b.id} booking={b} onEditBooking={onEditBooking} openHour={openHour} />
      ))}

      {/* Free Slots */}
      {freeSlots.map((slot, index) => (
        <FreeSlotButton 
          key={`free-${index}`} 
          startTimestamp={slot.startTimestamp} 
          durationMs={slot.durationMs} 
          onClick={() => onSlotClick?.({ tableId: table.tableId || table.id, startTimestamp: slot.startTimestamp, durationMs: slot.durationMs })}
          openHour={openHour}
        />
      ))}
    </div>
  );
}
