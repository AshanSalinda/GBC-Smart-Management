import { timeToPixels, durationToPixels } from './timelineUtils';

export default function FreeSlotButton({ startTimestamp, durationMs, onClick }) {
  const left = timeToPixels(startTimestamp);
  const width = durationToPixels(durationMs);

  return (
    <div
      onClick={onClick}
      className="absolute top-[10px] bottom-[10px] rounded-[10px] border-[1.5px] border-dashed border-[#3a3a40]/90 bg-white/[0.015] flex items-center justify-center cursor-pointer z-10 text-text-dim text-[0.76rem] font-semibold gap-[0.35rem] hover:border-accent hover:bg-accent/10 hover:text-accent-bright active:border-accent active:bg-accent/20 active:text-accent-bright select-none [-webkit-tap-highlight-color:transparent]"
      style={{ left: `${left}px`, width: `${width}px` }}
    >
      <svg className="w-[14px] h-[14px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Book Slot
    </div>
  );
}
