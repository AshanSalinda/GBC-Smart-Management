import { useEffect, useState } from 'react';
import { timeToPixels } from './timelineUtils';

export default function CurrentTimeLine({ scrollContainerRef, currentTime }) {
  const [shouldRender, setShouldRender] = useState(true);

  const leftOffset = timeToPixels(currentTime);

  useEffect(() => {
    // If outside operating hours, don't show the line
    if (leftOffset < 0) {
      setShouldRender(false);
    } else {
      setShouldRender(true);
    }
  }, [leftOffset]);

  useEffect(() => {
    // Initial auto-scroll
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        // Center the view on current time (scroll left minus half the container width)
        const containerWidth = scrollContainerRef.current.clientWidth;
        scrollContainerRef.current.scrollLeft = Math.max(0, leftOffset - containerWidth / 2);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!shouldRender) return null;

  const formattedTime = new Date(currentTime).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  return (
    <div 
      className="absolute top-0 bottom-0 z-40 pointer-events-none w-0"
      style={{ left: `${leftOffset}px` }}
    >
      <div className="absolute top-0 bottom-0 left-0 border-l-[2px] border-dashed border-[#c9a84c] opacity-95" />
      <div className="absolute top-[6px] left-[8px] bg-[linear-gradient(135deg,#c9a84c,#a88b3a)] text-[#1a1508] text-[0.65rem] font-bold px-[0.5rem] py-[0.18rem] rounded-[5px] tracking-[0.04em] whitespace-nowrap shadow-[0_0_12px_rgba(201,168,76,0.22)]">
        {formattedTime}
      </div>
    </div>
  );
}
