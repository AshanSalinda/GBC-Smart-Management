import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { TIMELINE_CONFIG, getTimelineStartOfDay } from './timelineUtils';

const inputBase = "w-full bg-[#121214] border border-[#2a2a2e] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent focus:shadow-[0_0_15px_rgba(74,188,109,0.15)] transition-all font-medium placeholder-white/20";
const labelBase = "block text-text-dim text-[0.7rem] uppercase font-bold tracking-wider mb-2 ml-1";

export default function CreateBookingModal({ isOpen, onClose, slot, existingBooking, tableBookings = [], onConfirm, globalConfig }) {
  const [step, setStep] = useState('form');
  const [error, setError] = useState('');

  // Parse Config
  const openHour = globalConfig?.venueStartTime ? parseInt(globalConfig.venueStartTime.split(':')[0], 10) : 10;
  const HOURLY_RATE = globalConfig?.hourlyRate ? Number(globalConfig.hourlyRate) : 15.0;

  const [form, setForm] = useState({
    checkIn: '',
    checkOut: '',
    durationMins: 60,
    player: '',
    mobile: '',
    amount: '',
    isPaid: false
  });

  const formatDurationMins = (mins) => {
    if (!mins || isNaN(mins)) return '';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  useEffect(() => {
    setError('');
    if (!isOpen) return;

    if (existingBooking) {
      const startMs = existingBooking.startTime;
      const durationMs = existingBooking.duration;
      const endMs = startMs + durationMs;

      setForm({
        checkIn: formatTimeForInput(startMs),
        checkOut: formatTimeForInput(endMs),
        durationMins: Math.round(durationMs / 60000),
        player: existingBooking.player || '',
        mobile: existingBooking.mobile || '',
        amount: String(existingBooking.amount || 0),
        isPaid: !!existingBooking.paid
      });
      setStep('form');
    } else if (slot) {
      const startMs = slot.startTimestamp;
      const durationMs = 60 * 60000;
      const endMs = startMs + durationMs;

      setForm({
        checkIn: formatTimeForInput(startMs),
        checkOut: formatTimeForInput(endMs),
        durationMins: 60,
        player: '',
        mobile: '',
        amount: String(HOURLY_RATE),
        isPaid: false
      });
      setStep('form');
    }
  }, [isOpen, slot, existingBooking, HOURLY_RATE]);

  const getBaseMs = () => existingBooking ? existingBooking.startTime : slot?.startTimestamp;

  const formatTimeForInput = (ms) => {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const parseTimeFromInput = (timeStr, baseMs) => {
    if (!timeStr) return 0;
    const [hh, mm] = timeStr.split(':').map(Number);
    const startOfDay = new Date(getTimelineStartOfDay(baseMs, openHour));

    const d = new Date(startOfDay);
    d.setHours(hh, mm, 0, 0);

    if (hh < openHour) {
      d.setDate(d.getDate() + 1);
    }
    return d.getTime();
  };

  const handleCheckInChange = (val) => {
    const newCheckInMs = parseTimeFromInput(val, getBaseMs());

    const durMins = form.durationMins;
    if (durMins > 0) {
      const newCheckOutMs = newCheckInMs + (durMins * 60000);
      setForm(prev => ({
        ...prev,
        checkIn: val,
        checkOut: formatTimeForInput(newCheckOutMs)
      }));
    } else {
      setForm(prev => ({ ...prev, checkIn: val }));
    }
  };

  const handleDurationChange = (val) => {
    let durMins = form.durationMins;
    if (typeof val === 'number') {
      durMins = val;
    } else if (typeof val === 'object') {
      durMins = (val.h * 60) + val.m;
    }

    setForm(prev => ({ ...prev, durationMins: durMins }));

    if (durMins > 0 && form.checkIn) {
      const checkInMs = parseTimeFromInput(form.checkIn, getBaseMs());
      const newCheckOutMs = checkInMs + (durMins * 60000);
      setForm(prev => ({
        ...prev,
        checkOut: formatTimeForInput(newCheckOutMs),
        amount: String(((durMins / 60) * HOURLY_RATE).toFixed(2))
      }));
    }
  };

  const handleCheckOutChange = (val) => {
    const newCheckOutMs = parseTimeFromInput(val, getBaseMs());

    if (form.checkIn) {
      const checkInMs = parseTimeFromInput(form.checkIn, getBaseMs());
      let diffMs = newCheckOutMs - checkInMs;

      if (diffMs < 0) {
        diffMs += 24 * 3600000;
      }

      const durMins = diffMs / 60000;
      setForm(prev => ({
        ...prev,
        checkOut: val,
        durationMins: durMins,
        amount: String(((durMins / 60) * HOURLY_RATE).toFixed(2))
      }));
    } else {
      setForm(prev => ({ ...prev, checkOut: val }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!form.player.trim()) {
      return setError(`Please enter the player name`);
    }

    const checkInMs = parseTimeFromInput(form.checkIn, getBaseMs());
    let checkOutMs = parseTimeFromInput(form.checkOut, getBaseMs());

    if (checkOutMs < checkInMs) {
      checkOutMs += 24 * 3600000;
    }

    const durMins = (checkOutMs - checkInMs) / 60000;
    if (durMins < 15) {
      return setError(`Minimum booking duration is 15 minutes.`);
    }

    if (existingBooking) {
      // Edit Mode: Check for overlaps against other bookings
      const overlappingBooking = tableBookings.find(b => {
        // Skip the booking being edited
        if (b.bookingId === existingBooking.bookingId) return false;
        const bStart = b.startTime;
        const bEnd = b.startTime + b.duration;
        // Overlap condition: newStart < bEnd AND newEnd > bStart
        return checkInMs < bEnd && checkOutMs > bStart;
      });

      if (overlappingBooking) {
        const overlapStart = formatTimeForInput(overlappingBooking.startTime);
        const overlapEnd = formatTimeForInput(overlappingBooking.startTime + overlappingBooking.duration);
        return setError(`These times overlap with ${overlappingBooking.player}'s booking from ${overlapStart} to ${overlapEnd}.`);
      }
    } else if (slot) {
      // Create Mode: Check against free slot boundaries
      const slotStartMs = slot.startTimestamp;
      const slotEndMs = slot.startTimestamp + slot.durationMs;

      const minCheckIn = slotStartMs - (15 * 60000);
      const maxCheckIn = slotEndMs - (15 * 60000);

      if (checkInMs < minCheckIn) {
        return setError(`Check-in cannot be earlier than ${formatTimeForInput(minCheckIn)}`);
      }
      if (checkInMs > maxCheckIn) {
        return setError(`Check-in cannot be later than ${formatTimeForInput(maxCheckIn)}`);
      }
      if (checkOutMs < slotStartMs) {
        return setError(`Check-out cannot be earlier than ${formatTimeForInput(slotStartMs)}`);
      }
      if (checkOutMs > slotEndMs) {
        return setError(`Check-out cannot be later than ${formatTimeForInput(slotEndMs)}`);
      }
    }

    setStep('summary');
  };

  const handleConfirm = () => {
    const checkInMs = parseTimeFromInput(form.checkIn, getBaseMs());
    const durMins = form.durationMins || 60;

    onConfirm({
      tableId: existingBooking ? existingBooking.tableId : slot?.tableId,
      player: form.player,
      mobile: form.mobile,
      startTime: checkInMs,
      duration: durMins * 60000,
      amount: parseFloat(form.amount) || 0,
      paid: form.isPaid
    });
    onClose();
  };

  if (!isOpen || (!slot && !existingBooking)) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {step === 'form' ? (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-2xl font-display font-black text-white">
              {existingBooking ? 'Edit Booking' : 'New Booking'}
            </h2>
            <p className="text-text-dim text-sm font-medium">Table 0{existingBooking ? existingBooking.tableId : slot?.tableId}</p>
          </div>

          <div className="space-y-5 flex-1">
            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelBase}>Check-in</label>
                <input
                  type="time"
                  value={form.checkIn}
                  onChange={(e) => handleCheckInChange(e.target.value)}
                  className={inputBase + " [color-scheme:dark]"}
                  required
                />
              </div>
              <div>
                <label className={labelBase}>Check-out</label>
                <input
                  type="time"
                  value={form.checkOut}
                  onChange={(e) => handleCheckOutChange(e.target.value)}
                  className={inputBase + " [color-scheme:dark]"}
                  required
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className={labelBase}>Duration</label>
              <div className="flex gap-3 mb-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min="0"
                    value={Math.floor(form.durationMins / 60)}
                    onChange={(e) => handleDurationChange({ h: parseInt(e.target.value) || 0, m: form.durationMins % 60 })}
                    className={inputBase + " pr-8"}
                    inputMode="numeric"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim font-bold">h</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={form.durationMins % 60}
                    onChange={(e) => handleDurationChange({ h: Math.floor(form.durationMins / 60), m: parseInt(e.target.value) || 0 })}
                    className={inputBase + " pr-8"}
                    inputMode="numeric"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim font-bold">m</span>
                </div>
              </div>
              <div className="flex gap-2">
                {[{ label: '30m', val: 30 }, { label: '1h', val: 60 }, { label: '1.5h', val: 90 }, { label: '2h', val: 120 }].map(d => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => handleDurationChange(d.val)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${form.durationMins === d.val
                      ? 'bg-accent/20 text-accent border border-accent/50'
                      : 'bg-white/5 text-text-dim border border-transparent hover:bg-white/10'
                      }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customer */}
            <div className="grid grid-cols-1 gap-4 pt-2">
              <div>
                <label className={labelBase}>Player Name</label>
                <input
                  type="text"
                  name="player_name"
                  value={form.player}
                  onChange={(e) => setForm({ ...form, player: e.target.value })}
                  className={inputBase}
                  placeholder="E.g. Allison Fisher"
                  autoComplete="on"
                />
              </div>
              <div>
                <label className={labelBase}>Mobile Number</label>
                <input
                  type="tel"
                  name="player_mobile"
                  value={form.mobile}
                  onChange={(e) => {
                    const filtered = e.target.value.replace(/[^0-9+]/g, '');
                    setForm({ ...form, mobile: filtered });
                  }}
                  className={inputBase}
                  placeholder="0771234567"
                  autoComplete="on"
                />
              </div>
            </div>

            {/* Payment */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
              <div>
                <label className={labelBase}>Amount (Rs)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={inputBase + " !text-xl !font-bold !text-accent-bright bg-black/20"}
                />
              </div>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-bold text-white/90">Mark as Paid</span>
                <div className={`w-14 h-8 rounded-full transition-colors relative border ${form.isPaid ? 'bg-accent/10 border-accent/40' : 'bg-black/40 border-[#2a2a2e]'}`}>
                  <div className={`absolute top-[3px] w-[24px] h-[24px] rounded-full transition-all duration-300 ${form.isPaid ? 'left-[29px] bg-accent shadow-[0_0_10px_rgba(74,188,109,0.5)]' : 'left-[3px] bg-text-dim'}`} />
                </div>
                {/* Hidden native checkbox to handle standard toggling logic easily */}
                <input
                  type="checkbox"
                  className="hidden"
                  checked={form.isPaid}
                  onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
                />
              </label>
            </div>
          </div>

          <div className='mt-8'>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold flex items-center">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-4 rounded-xl font-bold text-white/90 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-accent hover:bg-accent-bright text-white px-6 py-4 rounded-xl font-bold tracking-wide shadow-[0_0_20px_rgba(74,188,109,0.2)] hover:shadow-[0_0_30px_rgba(74,188,109,0.4)] transition-all active:scale-[0.98]"
              >
                Continue
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-2xl font-display font-black text-white">{existingBooking ? 'Review Changes' : 'Review Booking'}</h2>
            <p className="text-text-dim text-sm font-medium">Please confirm the details</p>
          </div>

          <div className="flex-1 space-y-4">
            <div className="bg-[#121214] border border-[#2a2a2e] rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-text-dim text-sm font-bold">Table</span>
                <span className="text-white font-bold text-lg">0{existingBooking ? existingBooking.tableId : slot?.tableId}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-text-dim text-sm font-bold">Player</span>
                <span className="text-white font-bold">{form.player}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-text-dim text-sm font-bold">Time</span>
                <div className="text-right">
                  <div className="text-white font-bold">{form.checkIn} &rarr; {form.checkOut}</div>
                  <div className="text-accent text-sm font-bold mt-0.5">{formatDurationMins(form.durationMins)}</div>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-text-dim text-sm font-bold">Amount Due</span>
                <div className="text-right">
                  <div className="text-accent-bright font-black text-2xl">${parseFloat(form.amount).toFixed(2)}</div>
                  <div className={`text-xs font-bold uppercase tracking-wider mt-1 ${form.isPaid ? 'text-accent' : 'text-warning'}`}>
                    {form.isPaid ? 'Paid' : 'Unpaid'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="flex-1 px-6 py-4 rounded-xl font-bold text-white/90 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 bg-accent hover:bg-accent-bright text-white px-6 py-4 rounded-xl font-bold tracking-wide shadow-[0_0_20px_rgba(74,188,109,0.2)] hover:shadow-[0_0_30px_rgba(74,188,109,0.4)] transition-all active:scale-[0.98]"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
