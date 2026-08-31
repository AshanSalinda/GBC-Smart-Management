import React, { useCallback } from 'react';
import { Lightbulb, Power, Info, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';

import { toggleLight as toggleLightApi } from '../api/lights';

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

const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// -----------------------------------------------------------------------------
// Component Memoization & Custom Equality (Performance Optimization)
// Only re-render if meaningful visual fields change to achieve 60 FPS
// -----------------------------------------------------------------------------
const tablePropsAreEqual = (prevProps, nextProps) => {
  const prev = prevProps.table;
  const next = nextProps.table;

  return (
    prev.status === next.status &&
    prev.lightStatus === next.lightStatus &&
    prev.currentBooking?.bookingId === next.currentBooking?.bookingId &&
    prevProps.localPendingState === nextProps.localPendingState
  );
};

const TableCard = React.memo(({ table, localPendingState, onToggle }) => {
  const isBusy = table.status === 'BUSY';

  const effectiveLightStatus = localPendingState || table.lightStatus;
  const isOn = effectiveLightStatus === 'ON' || effectiveLightStatus === 'PENDING-ON';
  const isPending = effectiveLightStatus === 'PENDING-ON' || effectiveLightStatus === 'PENDING-OFF';

  return (
    <div
      onClick={() => !isPending && onToggle(table.tableId, table.lightStatus)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!isPending) onToggle(table.tableId, table.lightStatus);
        }
      }}
      className={`block relative group overflow-hidden rounded-[2rem] bg-[#18181b] border transition-colors duration-500 flex flex-col justify-between h-[280px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] select-none [-webkit-tap-highlight-color:transparent] ${isPending ? 'opacity-80 cursor-wait' : 'cursor-pointer active:scale-[0.98]'} ${isOn
        ? 'border-light-on/40 bg-gradient-to-b from-[#1e1c16] to-[#18181b] hover:border-light-on/60 hover:shadow-[0_0_40px_rgba(240,230,168,0.25)]'
        : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
        }`}
    >
      {/* Giant Background Number */}
      <div className="absolute -bottom-6 -right-6 text-[200px] font-display font-black leading-none text-white opacity-[0.02] transition-transform duration-700 pointer-events-none select-none z-0">
        {table.tableId}
      </div>

      {/* Top Gradient Edge */}
      <div className={`absolute top-0 left-0 w-full h-[2px] transition-all duration-500 ${isOn ? 'bg-gradient-to-r from-light-on to-transparent opacity-80 shadow-[0_0_15px_var(--color-light-on)]' : 'bg-gradient-to-r from-white to-transparent opacity-10 group-hover:opacity-30'}`} />

      {/* Top Row: Light Status & Booking Badge */}
      <div className="flex justify-between items-start z-10 relative">
        <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border transition-colors ${isOn
          ? 'bg-light-on/15 border-light-on/30 text-light-on shadow-[0_0_20px_rgba(240,230,168,0.2)]'
          : 'bg-white/5 border-white/10 text-text-dim'
          }`}>
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin text-light-on" />
          ) : (
            <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${isOn ? 'bg-light-on shadow-[0_0_8px_var(--color-light-on)]' : 'bg-text-dim'}`} />
          )}
          <span className="text-xs font-bold tracking-widest uppercase whitespace-nowrap">{isOn ? 'Power On' : 'Standby'}</span>
        </div>

        <div className={`px-4 py-1.5 rounded-xl border font-bold text-[0.75rem] uppercase tracking-wider flex items-center justify-center ${isBusy ? 'bg-danger/10 text-danger border-danger/20' : 'bg-accent/10 text-accent-bright border-accent/20'}`}>
          {isBusy ? 'Busy' : 'Available'}
        </div>
      </div>

      {/* Center: Table Name or Booking Info */}
      <div className="z-10 relative mt-auto">
        {isBusy && table.currentBooking ? (
          <div className="space-y-5">
            {/* User Info */}
            <div className="flex items-center gap-4 group/user w-fit pr-8">
              <div className={`w-14 h-14 flex-shrink-0 rounded-full bg-gradient-to-tr from-white/10 to-white/5 border flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg shadow-black/50 transition ${isOn ? 'border-light-on/40 text-light-on' : 'border-white/10'}`}>
                {table.currentBooking.bookerName?.charAt(0) || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-2xl font-bold tracking-tight text-white truncate">{table.currentBooking.bookerName || 'Walk-in'}</h4>
                {table.currentBooking.bookerMobile && (
                  <p className="text-text-dim text-sm flex items-center gap-1.5 mt-1 font-medium truncate">
                    <PhoneIcon /> {table.currentBooking.bookerMobile}
                  </p>
                )}
              </div>
            </div>

            {/* Session Box */}
            <div className="flex items-center gap-3 bg-white/[0.05] px-4 py-3 rounded-2xl border border-white/10 w-fit">
              <ClockIcon />
              <p className="text-sm font-semibold text-white/90 flex items-center gap-2 whitespace-nowrap">
                Ends at <span className="text-white">{formatTime(table.currentBooking.checkOutTime)}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-80 transition-opacity duration-500 pb-4 group-hover:opacity-100">
            <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full border-2 border-dashed transition duration-700 ${isOn ? 'border-light-on/40 group-hover:rotate-90' : 'border-white/20 group-hover:rotate-90'}`} />
              <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition duration-500 ${isOn ? 'bg-light-on/10 border-light-on/30 text-light-on shadow-lg' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {isPending ? <Loader2 size={24} className="animate-spin" /> : <Lightbulb size={24} />}
              </div>
            </div>
            <h3 className="text-3xl font-display font-black text-white/90 tracking-tighter mb-1">{table.tableName || `Table ${table.tableId}`}</h3>
            <p className={`text-sm font-medium tracking-wide ${isOn ? 'text-light-on/80' : 'text-text-dim'}`}>Tap to toggle</p>
          </div>
        )}
      </div>
    </div>
  );
}, tablePropsAreEqual);

// -----------------------------------------------------------------------------
import { useState } from 'react';

export default function Illumination() {
  const tables = useStore(state => state.tables);
  const [pendingActions, setPendingActions] = useState({});

  const toggleLight = useCallback(async (tableId, currentLightStatus) => {
    // Determine the target state opposite of current
    const targetState = currentLightStatus === 'ON' || currentLightStatus === 'PENDING-ON' ? 'OFF' : 'ON';
    const pendingState = targetState === 'ON' ? 'PENDING-ON' : 'PENDING-OFF';

    setPendingActions(prev => ({ ...prev, [tableId]: pendingState }));

    try {
      await toggleLightApi(tableId, targetState);
    } catch (error) {
      console.error("Failed to toggle light:", error);
    } finally {
      setPendingActions(prev => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
    }
  }, []);

  const toggleAllLights = useCallback(async (targetState) => {
    const pendingState = targetState === 'ON' ? 'PENDING-ON' : 'PENDING-OFF';

    setPendingActions(prev => {
      const next = { ...prev };
      tables.forEach(t => { next[t.tableId] = pendingState; });
      return next;
    });

    try {
      await toggleLightApi('ALL', targetState);
    } catch (error) {
      console.error(`Failed to turn all lights ${targetState.toLowerCase()}:`, error);
    } finally {
      setPendingActions(prev => {
        const next = { ...prev };
        tables.forEach(t => delete next[t.tableId]);
        return next;
      });
    }
  }, [tables]);

  const isAllOn = tables.length > 0 && tables.every(t => t.lightStatus === 'ON' || t.lightStatus === 'PENDING-ON');
  const isAllOff = tables.length > 0 && tables.every(t => t.lightStatus === 'OFF' || t.lightStatus === 'PENDING-OFF');

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Illumination
            </h1>
          </div>
          <p className="text-text-dim text-sm">
            Control overhead lighting across all tables.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center shrink-0 justify-center md:justify-end gap-3 w-full md:w-auto mt-4 md:mt-0">
          <button
            onClick={() => toggleAllLights('ON')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition text-sm font-bold border shadow-lg ${isAllOn
              ? 'bg-light-on/15 text-light-on border-light-on/30 shadow-[0_0_20px_rgba(240,230,168,0.2)]'
              : 'bg-gradient-to-b from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white/90 border-white/10 hover:border-white/20 active:scale-[0.97]'
              }`}
          >
            <Lightbulb size={18} className={isAllOn ? "text-light-on" : "text-white/70"} /> All On
          </button>
          <button
            onClick={() => toggleAllLights('OFF')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition text-sm font-bold border shadow-lg ${isAllOff
              ? 'bg-black text-text-dim border-border-light shadow-[inset_0_2px_12px_rgba(0,0,0,0.6)]'
              : 'bg-gradient-to-b from-black/20 to-black/40 hover:from-black/10 hover:to-black/30 text-white/80 border-white/5 hover:border-white/10 active:scale-[0.97]'
              }`}
          >
            <Power size={18} className={isAllOff ? "text-text-dim" : "text-white/60"} /> All Off
          </button>
        </div>
      </div>

      {/* Quick Tip */}
      <div className="flex items-center justify-center gap-2 mb-8 text-sm text-text-dim">
        <Info size={16} className="text-light-on/80" />
        <p>Tap any card to manually toggle its light (overrides booking status).</p>
      </div>

      {/* Grid - Database Key Anchoring Applied Here */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6">
        {tables.length > 0 ? (
          tables.map((table) => (
            <TableCard
              key={table.tableId}
              table={table}
              localPendingState={pendingActions[table.tableId]}
              onToggle={toggleLight}
            />
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center text-white/50 py-20 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-light-on/50" />
            <p className="text-sm font-medium">Syncing with hardware...</p>
          </div>
        )}
      </div>
    </div>
  );
}
