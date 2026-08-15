import { useRef, useMemo, useState, useEffect } from 'react';
import TimelineRow from './TimelineRow';
import CurrentTimeLine from './CurrentTimeLine';
import { getTimelineHeaders, getTotalTimelineWidth, TIMELINE_CONFIG, getDynamicCloseHour } from './timelineUtils';

export default function BookingTimeline({ tables, bookings = [], onSlotClick, onEditBooking }) {
  const scrollContainerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Central clock that ticks at the exact start of every minute, handling background tab throttling
  useEffect(() => {
    let interval;
    let timeout;

    const syncClock = () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);

      // Force an immediate time update to catch up
      setCurrentTime(Date.now());

      const msUntilNextMinute = 60000 - (Date.now() % 60000);

      timeout = setTimeout(() => {
        setCurrentTime(Date.now());
        interval = setInterval(() => setCurrentTime(Date.now()), 60000);
      }, msUntilNextMinute);
    };

    // Initial sync on mount
    syncClock();

    // Re-sync whenever the user comes back to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncClock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Memoize these calculations so they only run when the bookings array changes
  const { closeHour, headers, totalWidth } = useMemo(() => {
    const ch = getDynamicCloseHour(bookings);
    return {
      closeHour: ch,
      headers: getTimelineHeaders(ch),
      totalWidth: getTotalTimelineWidth(ch)
    };
  }, [bookings]);

  return (
    <div className="border border-[#2a2a2e] rounded-[16px] overflow-hidden flex flex-col mt-4 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55),0_4px_12px_-4px_rgba(0,0,0,0.35)]" style={{ background: 'linear-gradient(180deg, #1a1a1d 0%, #151517 100%)' }}>
      {/* Top Header / Date Picker Area */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#2a2a2e] bg-[rgba(22,22,24,0.95)] sticky top-0 z-10">
        <h2 className="text-[1.15rem] font-display font-bold text-white tracking-[-0.03em]">Timeline</h2>
        <div className="flex items-center gap-3 bg-[#121214] px-[0.9rem] py-[0.55rem] rounded-[10px] border border-[#2a2a2e]">
          <svg className="w-4 h-4 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[0.9rem] font-medium text-white">Today</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Y-Axis (Table Labels) */}
        <div className="w-[48px] min-w-[48px] flex-shrink-0 border-r border-[#2a2a2e] bg-[rgba(22,22,24,0.98)] z-20 flex flex-col">
          {/* Empty corner space for header alignment */}
          <div className="h-[44px] min-h-[44px] border-b border-[#2a2a2e]" />

          {tables.map((t, index) => (
            <div key={t.id} className={`h-[92px] flex items-center justify-center font-display font-bold text-[1rem] tracking-[-0.02em] text-white ${index !== tables.length - 1 ? 'border-b border-[#2a2a2e]' : ''}`}>
              T{t.id}
            </div>
          ))}
        </div>

        {/* X-Axis (Scrollable Timeline Area) */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
        >
          {/* Time Header */}
          <div className="h-[44px] border-b border-[#2a2a2e] relative sticky top-0 z-30 bg-[rgba(22,22,24,0.95)]" style={{ width: `${totalWidth}px` }}>
            {headers.map((h, i) => (
              <div
                key={i}
                className="absolute bottom-0 flex flex-col items-center justify-end h-full"
                style={{ left: `${h.left}px`, transform: 'translateX(-50%)' }}
              >
                {h.type === 'hour' && (
                  <span
                    className="text-[0.7rem] text-text-dim font-medium whitespace-nowrap pointer-events-none tracking-[0.01em] [font-variant-numeric:tabular-nums] mb-1"
                    style={{
                      transform: h.left === 0 ? 'translateX(50%)' : (h.left === totalWidth ? 'translateX(-50%)' : 'none')
                    }}
                  >
                    {h.label}
                  </span>
                )}
                {/* Marker Tick */}
                <div
                  className={`w-[2px] bg-[#2a2a2e] ${h.type === 'hour' ? 'h-[18px]' :
                    h.type === 'half' ? 'h-[14px]' :
                      'h-[6px]'
                    }`}
                />
              </div>
            ))}
          </div>

          {/* Timeline Grid & Rows */}
          <div className="relative" style={{ width: `${totalWidth}px`, height: `${tables.length * 92}px` }}>
            {/* Unified Background Grid Lines (Every 30 mins) rendered ONCE for the entire grid */}
            <div className="absolute inset-0 pointer-events-none flex" style={{ width: `${totalWidth}px` }}>
              {Array.from({ length: (closeHour - TIMELINE_CONFIG.OPEN_HOUR) * 2 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-full border-r border-[#2a2a2e] ${i % 2 === 0 ? 'opacity-40' : 'opacity-60'}`}
                  style={{ width: `${30 * TIMELINE_CONFIG.PIXELS_PER_MINUTE}px` }}
                />
              ))}
            </div>

            <CurrentTimeLine scrollContainerRef={scrollContainerRef} currentTime={currentTime} />

            {tables.map((t, index) => (
              <TimelineRow
                key={t.id}
                table={t}
                width={totalWidth}
                bookings={bookings.filter(b => b.tableId === t.id)}
                isLast={index === tables.length - 1}
                closeHour={closeHour}
                currentTime={currentTime}
                onSlotClick={onSlotClick}
                onEditBooking={onEditBooking}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

