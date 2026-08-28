import React, { useState, useEffect } from 'react';
import BookingTimeline from '../components/timeline/BookingTimeline';
import CreateBookingModal from '../components/timeline/CreateBookingModal';
import useStore from '../store/useStore';

import { createBooking, updateBooking } from '../api/bookings';

const formatTime = (ms) => {
  if (!ms) return '--:--';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// SVG Icons
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

const PlusIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// -----------------------------------------------------------------------------
// Component Memoization & Custom Equality
// -----------------------------------------------------------------------------
const tablePropsAreEqual = (prevProps, nextProps) => {
  const prev = prevProps.table;
  const next = nextProps.table;

  return (
    prev.status === next.status &&
    prev.currentBooking?.id === next.currentBooking?.id &&
    prev.currentBooking?.isPaid === next.currentBooking?.isPaid &&
    prev.currentBooking?.amount === next.currentBooking?.amount
  );
};

const TableSummaryCard = React.memo(({ table }) => {
  const isBusy = table.status === 'BUSY';
  const tableId = table.tableId;
  const tableName = table.tableName || `Table 0${tableId}`;

  const player = table.currentBooking?.bookerName || 'Walk-in';
  const mobile = table.currentBooking?.bookerMobile || '';
  const isPaid = table.currentBooking?.isPaid;
  const amount = table.currentBooking?.amount || 0;

  const startTime = table.currentBooking?.checkInTime ? new Date(table.currentBooking.checkInTime).getTime() : null;
  const endTime = table.currentBooking?.checkOutTime ? new Date(table.currentBooking.checkOutTime).getTime() : null;

  return (
    <a
      href={isBusy && mobile ? `tel:${mobile.replace(/\s+/g, '')}` : undefined}
      title={isBusy ? `Call ${player}` : 'Assign Table'}
      className={`block relative group overflow-hidden rounded-[2rem] bg-[#18181b] border transition-colors duration-500 cursor-pointer flex flex-col justify-between h-[280px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.98] ${isBusy
        ? 'border-white/10 hover:border-danger/50 hover:shadow-[0_0_40px_rgba(240,82,82,0.2)] active:border-danger/50 active:shadow-[0_0_40px_rgba(240,82,82,0.2)]'
        : 'border-dashed border-white/20 hover:border-accent/50 hover:bg-accent/[0.03] hover:shadow-[0_0_40px_rgba(74,188,109,0.2)] active:border-accent/50 active:bg-accent/[0.03] active:shadow-[0_0_40px_rgba(74,188,109,0.2)]'
        }`}
    >
      {/* Giant Background Number with Parallax Hover Effect (Optimized) */}
      <div className="absolute -bottom-6 -right-6 text-[200px] font-display font-black leading-none text-white opacity-[0.02] group-hover:opacity-[0.04] group-hover:scale-110 group-hover:-rotate-6 group-active:opacity-[0.04] group-active:scale-110 group-active:-rotate-6 transition-transform duration-700 pointer-events-none select-none z-0">
        {tableId}
      </div>

      {/* Top Gradient Edge */}
      <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${isBusy ? 'from-danger to-transparent' : 'from-accent to-transparent'} opacity-40 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500`} />

      {/* Top Row */}
      <div className="flex justify-between items-start z-10 relative">
        <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border transition-colors ${isBusy
          ? 'bg-danger/10 border-danger/30 text-danger shadow-[0_0_20px_rgba(240,82,82,0.15)]'
          : 'bg-accent/10 border-accent/30 text-accent shadow-[0_0_20px_rgba(74,188,109,0.15)]'
          }`}>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isBusy ? 'bg-danger shadow-[0_0_8px_rgba(240,82,82,1)]' : 'bg-accent shadow-[0_0_8px_rgba(74,188,109,1)]'}`} />
          <span className="text-xs font-bold tracking-widest uppercase whitespace-nowrap">{isBusy ? 'In Play' : 'Available'}</span>
        </div>

        {isBusy && (
          <div className={`px-4 py-1.5 rounded-xl border font-bold text-[0.75rem] uppercase tracking-wider flex flex-col items-end ${isPaid ? 'bg-accent/5 text-accent border-accent/20' : 'bg-warning/5 text-warning border-warning/20'
            }`}>
            <span className="opacity-80">{isPaid ? 'Paid' : 'Unpaid'}</span>
            <span className="text-sm">${Math.floor(amount)}</span>
          </div>
        )}
      </div>

      {/* Bottom Row */}
      <div className="z-10 relative mt-auto">
        {isBusy && table.currentBooking ? (
          <div className="space-y-5">
            {/* User Info */}
            <div className="flex items-center gap-4 group/user w-fit pr-8">
              <div className="w-14 h-14 flex-shrink-0 rounded-full bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg shadow-black/50 group-hover:border-danger/40 group-hover:text-danger group-active:border-danger/40 group-active:text-danger transition">
                {player.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-2xl font-bold tracking-tight text-white truncate group-hover:text-danger group-active:text-danger transition-colors">{player}</h4>
                {mobile && (
                  <p className="text-text-dim text-sm flex items-center gap-1.5 mt-1 font-medium truncate group-hover:text-danger/80 group-active:text-danger/80 transition-colors">
                    <PhoneIcon /> {mobile}
                  </p>
                )}
              </div>
            </div>

            {/* Session Box */}
            <div className="flex items-center gap-3 bg-white/[0.05] px-4 py-3 rounded-2xl border border-white/10 w-fit group-hover:bg-white/[0.08] group-hover:border-white/20 group-active:bg-white/[0.08] group-active:border-white/20 transition-colors">
              <ClockIcon />
              <p className="text-sm font-semibold text-white/90 flex items-center gap-2 whitespace-nowrap">
                {formatTime(startTime)}
                <span className="text-white/30">&rarr;</span>
                {formatTime(endTime)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-80 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pb-4">
            <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-accent/40 group-hover:border-accent/80 group-hover:rotate-90 group-active:border-accent/80 group-active:rotate-90 transition duration-700" />
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center group-hover:scale-110 group-active:scale-110 transition-transform duration-500 shadow-lg">
                <PlusIcon />
              </div>
            </div>
            <h3 className="text-3xl font-display font-black text-white/90 tracking-tighter mb-1">{tableName}</h3>
            <p className="text-accent/80 text-sm font-medium tracking-wide">Ready for Assignment</p>
          </div>
        )}
      </div>
    </a>
  );
}, tablePropsAreEqual);


// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
export default function Bookings() {
  const tables = useStore(state => state.tables);
  const rawTimeline = useStore(state => state.timeline) || [];
  const globalConfig = useStore(state => state.globalConfig);
  const setGlobalConfig = useStore(state => state.setGlobalConfig);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  // Map backend timeline to UI shape
  const timelineBookings = React.useMemo(() => {
    return rawTimeline.map(b => ({
      id: b.id,
      tableId: b.tableId,
      player: b.bookerName || 'Unknown',
      mobile: b.bookerMobile || '',
      startTime: new Date(b.checkInTime).getTime(),
      duration: new Date(b.checkOutTime).getTime() - new Date(b.checkInTime).getTime(),
      amount: b.amount || 0,
      paid: !!b.isPaid
    }));
  }, [rawTimeline]);

  // Fetch Global Config once on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { getConfig } = await import('../api/configs');
        const data = await getConfig();
        if (data) {
          setGlobalConfig(data);
        }
      } catch (err) {
        console.error("Failed to load global config:", err);
      }
    };
    if (!globalConfig) {
      loadConfig();
    }
  }, [globalConfig, setGlobalConfig]);

  // Defer the heavy timeline rendering by a few frames to ensure the 
  // page mounts and transitions instantly on mobile devices.
  useEffect(() => {
    if (globalConfig) {
      const timer = setTimeout(() => setShowTimeline(true), 150);
      return () => clearTimeout(timer);
    }
  }, [globalConfig]);

  const handleCreateBooking = async (bookingData) => {
    try {
      await createBooking(bookingData);
      setSelectedSlot(null);
    } catch (e) {
      console.error("Failed to create booking:", e);
    }
  };

  const handleUpdateBooking = async (updatedData) => {
    try {
      await updateBooking(editingBooking.id, updatedData);
      setEditingBooking(null);
    } catch (e) {
      console.error("Failed to update booking:", e);
    }
  };

  const totalTables = tables.length || 4;
  const freeTablesCount = tables.length > 0 ? tables.filter(t => t.status !== 'BUSY').length : 0;

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              Bookings
            </h1>
          </div>
          <p className="text-text-dim text-sm">
            Manage table reservations and active sessions.
          </p>
        </div>

        <div className={`flex w-fit min-w-24 items-center justify-center shrink-0 gap-1.5 px-3 py-1.5 ml-auto rounded-full border ${tables.length === 0 ? 'bg-white/10 border-white/15 text-white/50' : freeTablesCount > 0 ? 'bg-accent/10 border-accent/15 text-accent' : 'bg-warning/10 border-warning/15 text-warning'
          }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${tables.length === 0 ? 'bg-white/20 animate-pulse' : freeTablesCount > 0 ? 'bg-accent' : 'bg-warning'}`} />
          <span className="text-[11px] font-bold uppercase tracking-widest">
            {tables.length === 0 ? 'Loading...' : `${freeTablesCount}/${totalTables} Free`}
          </span>
        </div>
      </div>

      {/* Cards Grid - Database Key Anchoring Applied Here */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6 mb-12">
        {tables.length > 0 ? tables.map((table) => (
          <TableSummaryCard key={table.tableId} table={table} />
        )) : (
          <div className="col-span-full text-center text-white/50 py-12">
            Loading tables...
          </div>
        )}
      </div>

      {/* Interactive Booking Timeline */}
      {showTimeline ? (
        <BookingTimeline
          tables={tables.length > 0 ? tables : [{ tableId: 1 }, { tableId: 2 }, { tableId: 3 }, { tableId: 4 }]} // Fallback for timeline layout structure mapping
          bookings={timelineBookings}
          onSlotClick={setSelectedSlot}
          onEditBooking={setEditingBooking}
          globalConfig={globalConfig}
        />
      ) : (
        <div className="h-[400px] w-full rounded-[16px] border border-[#2a2a2e] flex flex-col items-center justify-center bg-[#151517] shadow-xl mt-4 animate-pulse">
          <div className="w-8 h-8 border-4 border-[#3a3a40] border-t-accent rounded-full animate-spin mb-4" />
          <p className="text-text-dim text-sm font-medium">Loading Schedule...</p>
        </div>
      )}

      {/* Create / Edit Booking Modal */}
      <CreateBookingModal
        isOpen={!!selectedSlot || !!editingBooking}
        onClose={() => {
          setSelectedSlot(null);
          setEditingBooking(null);
        }}
        slot={selectedSlot}
        existingBooking={editingBooking}
        tableBookings={timelineBookings.filter(b => b.tableId === (selectedSlot?.tableId || editingBooking?.tableId))}
        globalConfig={globalConfig}
        onConfirm={(data) => {
          if (editingBooking) {
            handleUpdateBooking(data);
          } else {
            handleCreateBooking(data);
          }
        }}
      />
    </div>
  );
}
