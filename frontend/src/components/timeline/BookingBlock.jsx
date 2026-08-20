import { useState } from 'react';
import Modal from '../ui/Modal';
import { timeToPixels, durationToPixels } from './timelineUtils';

const formatTime = (ms) => {
  if (!ms) return '--:--';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export default function BookingBlock({ booking, onEditBooking, openHour }) {
  const [showModal, setShowModal] = useState(false);
  const isPlaying = Date.now() >= booking.startTime && Date.now() <= (booking.startTime + booking.duration);
  const isPast = Date.now() > (booking.startTime + booking.duration);

  // Position and Width
  const left = timeToPixels(booking.startTime, openHour);
  const width = durationToPixels(booking.duration);
  const isPaid = booking.paid;

  const startTimeStr = formatTime(booking.startTime);
  const endTimeStr = formatTime(booking.startTime + booking.duration);
  const durationHrs = (booking.duration / 3600000).toFixed(1).replace('.0', '');

  return (
    <>
      <div
        className={`absolute top-[10px] bottom-[10px] rounded-[10px] px-[0.7rem] py-[0.45rem] flex flex-col justify-center overflow-hidden cursor-pointer z-20 border hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:z-30 hover:brightness-110 active:brightness-90 select-none [-webkit-tap-highlight-color:transparent] gap-[0.1rem] ${isPaid
          ? 'bg-[linear-gradient(155deg,#1a7a45_0%,#145c35_100%)] border-[#6ed49a]/20 shadow-[0_2px_8px_rgba(20,92,53,0.35)]'
          : 'bg-[linear-gradient(155deg,#9a7a28_0%,#7a5f1c_100%)] border-[#e0c878]/20 shadow-[0_2px_8px_rgba(122,95,28,0.3)]'
          }`}
        style={{ left: `${left}px`, width: `${Math.max(width, 50)}px` }}
        onClick={(e) => {
          e.stopPropagation();
          setShowModal(true);
        }}
      >
        <div className="font-semibold text-[0.8rem] whitespace-nowrap overflow-hidden text-ellipsis leading-[1.2] text-white pr-4">{booking.player}</div>
        <div className="text-[0.68rem] opacity-90 whitespace-nowrap overflow-hidden text-ellipsis text-white">
          {startTimeStr} - {endTimeStr} &bull; ${Math.floor(booking.amount)}
        </div>

        {/* Top right dot indicator */}
        <div className={`absolute top-[7px] right-[7px] w-[6px] h-[6px] rounded-full ${isPaid ? 'bg-[#8eecc0] shadow-[0_0_6px_rgba(142,236,192,0.5)]' : 'bg-[#e8d08a] shadow-[0_0_6px_rgba(232,208,138,0.45)]'}`} />
      </div>

      {/* Mobile-first Details Popup */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-display font-bold text-white tracking-tight">{booking.player}</h3>
            <p className="text-text-dim text-sm mt-1 font-medium">{booking.mobile}</p>
          </div>
          <div className={`px-3 py-1.5 rounded-xl text-[0.7rem] uppercase tracking-wider font-bold border ${isPaid ? 'bg-[#1a7a45]/20 text-[#8eecc0] border-[#1a7a45]/40' : 'bg-[#9a7a28]/20 text-[#e8d08a] border-[#9a7a28]/40'}`}>
            {isPaid ? 'Paid' : 'Unpaid'}
          </div>
        </div>

        <div className="space-y-4 bg-white/5 rounded-2xl p-5 border border-white/10">
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/50 font-medium">Time</span>
            <span className="font-semibold text-white/90">{startTimeStr} &rarr; {endTimeStr}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/50 font-medium">Duration</span>
            <span className="font-semibold text-white/90">{durationHrs} Hours</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/50 font-medium">Amount</span>
            <span className="font-semibold text-white/90">${Math.floor(booking.amount)}</span>
          </div>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          {/* Call Booker */}
          <a
            href={`tel:${booking.mobile?.replace(/\s+/g, '')}`}
            className="flex items-center justify-center py-4 bg-white/5 hover:bg-white/10 active:bg-white/15 active:scale-[0.95] text-white rounded-[1rem] transition-all select-none"
            onClick={e => e.stopPropagation()}
            title="Call Booker"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </a>

          {/* Edit Booking */}
          <button
            className="flex items-center justify-center py-4 bg-white/5 hover:bg-white/10 active:bg-white/15 active:scale-[0.95] text-white rounded-[1rem] transition-all select-none"
            onClick={e => { 
              e.stopPropagation(); 
              setShowModal(false);
              onEditBooking?.(booking); 
            }}
            title="Update Info"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Toggle Paid/Unpaid */}
          <button
            className={`flex items-center justify-center py-4 active:scale-[0.95] rounded-[1rem] transition-all select-none ${isPaid ? 'bg-warning/10 text-warning hover:bg-warning/20 active:bg-warning/20' : 'bg-[#1a7a45]/20 text-[#8eecc0] hover:bg-[#1a7a45]/30 active:bg-[#1a7a45]/30'}`}
            onClick={e => { e.stopPropagation(); /* TODO: Toggle Paid */ }}
            title={isPaid ? "Mark Unpaid" : "Mark Paid"}
          >
            {isPaid ? (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8">
                {/* Dollar Circle */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                {/* Line Through It (Slash) */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5" />
              </svg>
            ) : (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8">
                {/* Dollar Circle */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          {/* Cancel Booking */}
          <button
            className={`flex items-center justify-center py-4 rounded-[1rem] transition-all select-none ${booking.startTime < Date.now() ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-danger/10 hover:bg-danger/20 active:bg-danger/20 active:scale-[0.95] text-danger'}`}
            onClick={e => {
              e.stopPropagation();
              if (booking.startTime < Date.now()) return;
              /* TODO: Cancel */
            }}
            disabled={booking.startTime < Date.now()}
            title="Cancel Booking"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <button
          className="w-full mt-3 py-3.5 bg-transparent border border-white/10 hover:bg-white/5 active:bg-white/10 active:scale-[0.98] text-white/70 rounded-xl font-semibold transition-all select-none"
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(false);
          }}
        >
          Close
        </button>
      </Modal>
    </>
  );
}
