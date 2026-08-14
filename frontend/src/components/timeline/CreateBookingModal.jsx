import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { TIMELINE_CONFIG, getTimelineStartOfDay } from './timelineUtils';

const HOURLY_RATE = 15.0; // Global rate config

const inputBase = "w-full bg-[#121214] border border-[#2a2a2e] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent focus:shadow-[0_0_15px_rgba(74,188,109,0.15)] transition-all font-medium placeholder-white/20";
const labelBase = "block text-text-dim text-[0.7rem] uppercase font-bold tracking-wider mb-2 ml-1";

export default function CreateBookingModal({ isOpen, onClose, slot, onConfirm }) {
  const [step, setStep] = useState('form');

  const [form, setForm] = useState({
    checkIn: '',
    checkOut: '',
    durationStr: '1',
    player: '',
    mobile: '',
    amount: '',
    isPaid: false
  });

  useEffect(() => {
    if (isOpen && slot) {
      const startMs = slot.startTimestamp;
      const durationMs = 60 * 60000;
      const endMs = startMs + durationMs;

      setForm({
        checkIn: formatTimeForInput(startMs),
        checkOut: formatTimeForInput(endMs),
        durationStr: '1',
        player: '',
        mobile: '',
        amount: String(HOURLY_RATE),
        isPaid: false
      });
      setStep('form');
    }
  }, [isOpen, slot]);

  const formatTimeForInput = (ms) => {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const parseTimeFromInput = (timeStr, baseMs) => {
    if (!timeStr) return 0;
    const [hh, mm] = timeStr.split(':').map(Number);
    const startOfDay = new Date(getTimelineStartOfDay(baseMs));

    const d = new Date(startOfDay);
    d.setHours(hh, mm, 0, 0);

    if (hh < TIMELINE_CONFIG.OPEN_HOUR) {
      d.setDate(d.getDate() + 1);
    }
    return d.getTime();
  };

  const handleCheckInChange = (val) => {
    const newCheckInMs = parseTimeFromInput(val, slot?.startTimestamp);

    const durHours = parseFloat(form.durationStr);
    if (!isNaN(durHours) && durHours > 0) {
      const newCheckOutMs = newCheckInMs + (durHours * 3600000);
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
    const durHours = parseFloat(val);
    setForm(prev => ({ ...prev, durationStr: val }));

    if (!isNaN(durHours) && durHours > 0 && form.checkIn) {
      const checkInMs = parseTimeFromInput(form.checkIn, slot?.startTimestamp);
      const newCheckOutMs = checkInMs + (durHours * 3600000);
      setForm(prev => ({
        ...prev,
        checkOut: formatTimeForInput(newCheckOutMs),
        amount: String(durHours * HOURLY_RATE)
      }));
    }
  };

  const handleCheckOutChange = (val) => {
    const newCheckOutMs = parseTimeFromInput(val, slot?.startTimestamp);

    if (form.checkIn) {
      const checkInMs = parseTimeFromInput(form.checkIn, slot?.startTimestamp);
      let diffMs = newCheckOutMs - checkInMs;

      if (diffMs < 0) {
        diffMs += 24 * 3600000;
      }

      const durHours = diffMs / 3600000;
      setForm(prev => ({
        ...prev,
        checkOut: val,
        durationStr: durHours.toFixed(2).replace(/\.00$/, ''),
        amount: String(durHours * HOURLY_RATE)
      }));
    } else {
      setForm(prev => ({ ...prev, checkOut: val }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.player) return;
    setStep('summary');
  };

  const handleConfirm = () => {
    const checkInMs = parseTimeFromInput(form.checkIn, slot?.startTimestamp);
    const durHours = parseFloat(form.durationStr) || 1;

    onConfirm({
      tableId: slot.tableId,
      player: form.player,
      mobile: form.mobile,
      startTime: checkInMs,
      duration: durHours * 3600000,
      amount: parseFloat(form.amount) || 0,
      paid: form.isPaid
    });
    onClose();
  };

  if (!isOpen || !slot) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {step === 'form' ? (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-2xl font-display font-black text-white">New Booking</h2>
            <p className="text-text-dim text-sm font-medium">Table 0{slot.tableId}</p>
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
              <label className={labelBase}>Duration (Hours)</label>
              <div className="flex gap-2 mb-2">
                {['0.5', '1', '1.5', '2'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDurationChange(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${form.durationStr === d
                      ? 'bg-accent/20 text-accent border border-accent/50'
                      : 'bg-white/5 text-text-dim border border-transparent hover:bg-white/10'
                      }`}
                  >
                    {d}h
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="0.25"
                min="0.25"
                value={form.durationStr}
                onChange={(e) => handleDurationChange(e.target.value)}
                className={inputBase}
                placeholder="Custom Duration"
              />
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
                  required
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

          <div className="mt-8 flex gap-3">
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
        </form>
      ) : (
        <div className="flex flex-col h-full">
          <div className="mb-6">
            <h2 className="text-2xl font-display font-black text-white">Review Booking</h2>
            <p className="text-text-dim text-sm font-medium">Please confirm the details</p>
          </div>

          <div className="flex-1 space-y-4">
            <div className="bg-[#121214] border border-[#2a2a2e] rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-text-dim text-sm font-bold">Table</span>
                <span className="text-white font-bold text-lg">0{slot.tableId}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-text-dim text-sm font-bold">Player</span>
                <span className="text-white font-bold">{form.player}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-text-dim text-sm font-bold">Time</span>
                <div className="text-right">
                  <div className="text-white font-bold">{form.checkIn} &rarr; {form.checkOut}</div>
                  <div className="text-accent text-sm font-bold mt-0.5">{form.durationStr} Hours</div>
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
