import { useState, useCallback } from 'react';
import { Lightbulb, Power, Info, Clock, User } from 'lucide-react';

const INITIAL_TABLES = [
  { id: 1, status: 'busy', booker: 'Rahul Mehta', endTime: '4:30 PM', lightOn: true },
  { id: 2, status: 'available', booker: null, endTime: null, lightOn: false },
  { id: 3, status: 'busy', booker: 'Alex Rivera', endTime: '5:15 PM', lightOn: true },
  { id: 4, status: 'available', booker: null, endTime: null, lightOn: false },
];

export default function LightsControl() {
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
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-3">
            Light Controls
          </h1>
          <p className="text-text-muted flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-light-on animate-pulse shadow-[0_0_8px_var(--color-light-on)]" />
            Hardware synchronization active
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-center md:justify-end gap-3 w-full md:w-auto mt-2 md:mt-0">
          <button
            onClick={turnAllOn}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-bold border ${isAllOn
                ? 'bg-light-on/15 text-light-on border-light-on/30 shadow-[0_0_15px_rgba(240,230,168,0.15)]'
                : 'bg-panel-elevated hover:bg-card-hover text-text-main border-border shadow-sm hover:border-border-light'
              }`}
          >
            <Lightbulb size={18} className={isAllOn ? "text-light-on" : "text-text-muted"} /> Turn All On
          </button>
          <button
            onClick={turnAllOff}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-bold border ${isAllOff
                ? 'bg-black text-text-dim border-border-light shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]'
                : 'bg-panel-elevated hover:bg-card-hover text-text-main border-border shadow-sm hover:border-border-light'
              }`}
          >
            <Power size={18} className={isAllOff ? "text-text-dim" : "text-text-muted"} /> Turn All Off
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-center gap-4 p-4 md:p-5 bg-gold/5 border border-gold/20 rounded-[18px] mb-10 text-[15px] text-text-muted leading-relaxed">
        <div className="bg-gold/15 text-gold p-2.5 rounded-xl flex-shrink-0">
          <Info size={22} />
        </div>
        <p>
          <strong className="text-gold font-semibold">Tap any card</strong> to instantly toggle that table’s overhead light.
          The light state is independent of the booking status.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5 md:gap-6 lg:gap-8">
        {tables.map((table) => {
          const isBusy = table.status === 'busy';
          const isOn = table.lightOn;

          return (
            <div
              key={table.id}
              onClick={() => toggleLight(table.id)}
              className={`relative flex flex-col group cursor-pointer transition-all duration-300 ease-out select-none
                rounded-[20px] border p-6 overflow-hidden
                ${isOn
                  ? 'border-light-on/40 bg-gradient-to-b from-[#1e1c16] to-[#181610] shadow-[0_0_0_1px_rgba(240,230,168,0.08),0_0_32px_rgba(240,230,168,0.12),inset_0_0_40px_rgba(240,230,168,0.04)] hover:-translate-y-1 hover:shadow-[0_0_0_1px_rgba(240,230,168,0.12),0_0_40px_rgba(240,230,168,0.18),inset_0_0_40px_rgba(240,230,168,0.04)]'
                  : 'border-border bg-gradient-to-b from-card to-bg-elevated hover:border-border-light hover:-translate-y-1 hover:shadow-glow'
                }
              `}
              role="button"
              aria-pressed={isOn}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleLight(table.id);
                }
              }}
            >
              {/* Top accent glow line when ON */}
              <div
                className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${isOn ? 'opacity-100' : 'opacity-0'}`}
                style={{
                  background: 'linear-gradient(90deg, var(--color-light-on), transparent 80%)',
                  boxShadow: '0 0 12px var(--color-light-on-glow)'
                }}
              />

              <div className="flex flex-wrap justify-between items-start gap-4 mb-5 relative z-10">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center transition-all duration-300
                      ${isOn
                        ? 'bg-light-on/10 text-light-on border border-light-on/30 shadow-[0_0_15px_rgba(240,230,168,0.3)]'
                        : 'bg-white/5 text-text-dim border border-border grayscale opacity-60 group-hover:opacity-80 group-hover:grayscale-0'
                      }`}
                  >
                    <Lightbulb size={24} />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-xl md:text-2xl text-text-main leading-tight whitespace-nowrap">
                      Table {table.id}
                    </h2>
                    <span className="text-xs text-text-dim font-medium uppercase tracking-wider block mt-0.5">
                      Area {Math.ceil(table.id / 2)}
                    </span>
                  </div>
                </div>

                <div
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase border transition-colors duration-300
                    ${isOn
                      ? 'bg-light-on/15 text-light-on border-light-on/30'
                      : 'bg-border/50 text-text-dim border-border'
                    }`}
                >
                  {isOn ? 'Power On' : 'Standby'}
                </div>
              </div>

              <div className="space-y-3 relative z-10 mt-auto pt-4 border-t border-white/5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-dim font-medium">Status</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-bold tracking-wide border
                      ${isBusy
                        ? 'bg-danger/10 text-danger border-danger/20'
                        : 'bg-accent/10 text-accent-bright border-accent/20'
                      }`}
                  >
                    {isBusy ? 'BUSY' : 'AVAILABLE'}
                  </span>
                </div>

                {isBusy ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-dim flex items-center gap-1.5"><User size={14} /> Booker</span>
                      <span className="text-text-main font-semibold truncate max-w-[120px]">{table.booker}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-dim flex items-center gap-1.5"><Clock size={14} /> Ends At</span>
                      <span className="text-text-main font-semibold">{table.endTime}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-2 opacity-50">
                    <span className="text-xs text-text-dim">No active booking</span>
                  </div>
                )}
              </div>

              {/* Tap Hint */}
              <div className={`mt-5 pt-3 border-t text-center text-xs tracking-wide transition-colors duration-300
                ${isOn ? 'border-light-on/10 text-light-on/60' : 'border-border text-text-dim/60'}
              `}>
                Tap card to toggle light
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
