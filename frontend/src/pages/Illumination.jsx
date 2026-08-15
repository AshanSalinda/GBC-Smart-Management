import { useState, useCallback } from 'react';
import { Lightbulb, Power, Info } from 'lucide-react';

const INITIAL_TABLES = [
  { id: 1, status: 'busy', booker: 'Rahul Mehta', mobile: '+1 234 567 890', endTime: '4:30 PM', lightOn: true },
  { id: 2, status: 'available', booker: null, mobile: null, endTime: null, lightOn: false },
  { id: 3, status: 'busy', booker: 'Alex Rivera', mobile: '+1 555 123 456', endTime: '5:15 PM', lightOn: true },
  { id: 4, status: 'available', booker: null, mobile: null, endTime: null, lightOn: false },
];

const PhoneIcon = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function Illumination() {
  const [tables, setTables] = useState(INITIAL_TABLES);

  const toggleLight = useCallback((id) => {
    setTables((prev) =>
      prev.map((t) => (t.id === id ? { ...t, lightOn: !t.lightOn } : t))
    );
  }, []);

  const turnAllOn = useCallback(() => {
    setTables((prev) => prev.map((t) => ({ ...t, lightOn: true })));
  }, []);

  const turnAllOff = useCallback(() => {
    setTables((prev) => prev.map((t) => ({ ...t, lightOn: false })));
  }, []);

  const isAllOn = tables.length > 0 && tables.every(t => t.lightOn);
  const isAllOff = tables.length > 0 && tables.every(t => !t.lightOn);

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-white mb-2 drop-shadow-sm">
            Illumination
          </h1>
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-light-on/10 border border-light-on/20 shadow-[0_0_15px_rgba(240,230,168,0.05)]">
            <span className="w-2 h-2 rounded-full bg-light-on animate-pulse shadow-[0_0_8px_var(--color-light-on)]" />
            <span className="text-light-on text-xs font-bold tracking-widest uppercase">Hardware Synced</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-center md:justify-end gap-3 w-full md:w-auto mt-4 md:mt-0">
          <button
            onClick={turnAllOn}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition text-sm font-bold border shadow-lg ${isAllOn
              ? 'bg-light-on/15 text-light-on border-light-on/30 shadow-[0_0_20px_rgba(240,230,168,0.2)]'
              : 'bg-gradient-to-b from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white/90 border-white/10 hover:border-white/20 active:scale-[0.97]'
              }`}
          >
            <Lightbulb size={18} className={isAllOn ? "text-light-on" : "text-white/70"} /> All On
          </button>
          <button
            onClick={turnAllOff}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition text-sm font-bold border shadow-lg ${isAllOff
              ? 'bg-black text-text-dim border-border-light shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]'
              : 'bg-gradient-to-b from-black/20 to-black/40 hover:from-black/10 hover:to-black/30 text-white/80 border-white/5 hover:border-white/10 active:scale-[0.97]'
              }`}
          >
            <Power size={18} className={isAllOff ? "text-text-dim" : "text-white/60"} /> All Off
          </button>
        </div>
      </div>

      {/* Premium Info Banner (Optimized for Mobile) */}
      <div className="relative overflow-hidden flex items-start md:items-center gap-5 p-5 md:p-6 rounded-[24px] mb-12 border border-white/10 bg-[#18181b] shadow-xl">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-light-on/30 to-transparent opacity-50" />

        <div className="relative bg-[#18181b] border border-white/10 text-light-on p-3.5 rounded-2xl flex-shrink-0 shadow-[0_0_20px_rgba(240,230,168,0.1)]">
          <Info size={24} strokeWidth={2.5} />
        </div>

        <div className="flex-1">
          <h3 className="text-white font-bold text-lg mb-1 tracking-tight">Manual Override Enabled</h3>
          <p className="text-text-dim text-[15px] font-medium leading-relaxed">
            Instantly toggle any table’s overhead light by tapping its card. This state operates completely independently of the active booking status.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6 mb-12">
        {tables.map((table) => {
          const isBusy = table.status === 'busy';
          const isOn = table.lightOn;

          return (
            <div
              key={table.id}
              onClick={() => toggleLight(table.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleLight(table.id);
                }
              }}
              className={`block relative group overflow-hidden rounded-[2rem] bg-[#18181b] border transition-colors duration-500 cursor-pointer flex flex-col justify-between h-[280px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.98] ${isOn
                ? 'border-light-on/40 bg-gradient-to-b from-[#1e1c16] to-[#18181b] hover:border-light-on/60 hover:shadow-[0_0_40px_rgba(240,230,168,0.25)] active:border-light-on/60 active:shadow-[0_0_40px_rgba(240,230,168,0.25)]'
                : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02] active:border-white/20 active:bg-white/[0.02]'
                }`}
            >
              {/* Giant Background Number with Parallax Hover Effect (Optimized) */}
              <div className="absolute -bottom-6 -right-6 text-[200px] font-display font-black leading-none text-white opacity-[0.02] group-hover:opacity-[0.04] group-hover:scale-110 group-hover:-rotate-6 group-active:opacity-[0.04] group-active:scale-110 group-active:-rotate-6 transition-transform duration-700 pointer-events-none select-none z-0">
                {table.id}
              </div>

              {/* Top Gradient Edge */}
              <div className={`absolute top-0 left-0 w-full h-[2px] transition-all duration-500 ${isOn ? 'bg-gradient-to-r from-light-on to-transparent opacity-80 shadow-[0_0_15px_var(--color-light-on)]' : 'bg-gradient-to-r from-white to-transparent opacity-10 group-hover:opacity-30'}`} />

              {/* Top Row: Light Status & Booking Badge */}
              <div className="flex justify-between items-start z-10 relative">
                <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border transition-colors ${isOn
                  ? 'bg-light-on/15 border-light-on/30 text-light-on shadow-[0_0_20px_rgba(240,230,168,0.2)]'
                  : 'bg-white/5 border-white/10 text-text-dim'
                  }`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isOn ? 'bg-light-on shadow-[0_0_8px_var(--color-light-on)]' : 'bg-text-dim'}`} />
                  <span className="text-xs font-bold tracking-widest uppercase whitespace-nowrap">{isOn ? 'Power On' : 'Standby'}</span>
                </div>

                <div className={`px-4 py-1.5 rounded-xl border font-bold text-[0.75rem] uppercase tracking-wider flex items-center justify-center ${isBusy ? 'bg-danger/10 text-danger border-danger/20' : 'bg-accent/10 text-accent-bright border-accent/20'}`}>
                  {isBusy ? 'Busy' : 'Available'}
                </div>
              </div>

              {/* Center: Table Name (Visible when Off/Available or always as a design element) */}
              <div className="z-10 relative mt-auto">
                {isBusy ? (
                  <div className="space-y-5">
                    {/* User Info */}
                    <div className="flex items-center gap-4 group/user w-fit pr-8">
                      <div className={`w-14 h-14 flex-shrink-0 rounded-full bg-gradient-to-tr from-white/10 to-white/5 border flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg shadow-black/50 transition ${isOn ? 'border-light-on/40 text-light-on' : 'border-white/10 group-hover:border-white/30'}`}>
                        {table.booker.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-2xl font-bold tracking-tight text-white truncate">{table.booker}</h4>
                        <p className="text-text-dim text-sm flex items-center gap-1.5 mt-1 font-medium truncate">
                          <PhoneIcon /> {table.mobile}
                        </p>
                      </div>
                    </div>

                    {/* Session Box */}
                    <div className="flex items-center gap-3 bg-white/[0.05] px-4 py-3 rounded-2xl border border-white/10 w-fit">
                      <ClockIcon />
                      <p className="text-sm font-semibold text-white/90 flex items-center gap-2 whitespace-nowrap">
                        Ends at <span className="text-white">{table.endTime}</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-80 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pb-4">
                    <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
                      <div className={`absolute inset-0 rounded-full border-2 border-dashed transition duration-700 ${isOn ? 'border-light-on/40 group-hover:border-light-on/80 group-hover:rotate-90' : 'border-white/20 group-hover:border-white/40 group-hover:rotate-90'}`} />
                      <div className={`w-12 h-12 rounded-full border flex items-center justify-center group-hover:scale-110 transition duration-500 ${isOn ? 'bg-light-on/10 border-light-on/30 text-light-on shadow-lg' : 'bg-white/5 border-white/10 text-white/50'}`}>
                        <Lightbulb size={24} />
                      </div>
                    </div>
                    <h3 className="text-3xl font-display font-black text-white/90 tracking-tighter mb-1">Table {table.id}</h3>
                    <p className={`text-sm font-medium tracking-wide ${isOn ? 'text-light-on/80' : 'text-text-dim'}`}>Tap to toggle</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
