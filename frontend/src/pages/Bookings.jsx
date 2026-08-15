import { useState } from 'react';
import BookingTimeline from '../components/timeline/BookingTimeline';

const now = Date.now();
const hour = 60 * 60000;

// MOCK DATA for initial testing
const MOCK_TABLES = [
  { id: 1, status: 'busy', player: 'Rahul Mehta', mobile: '+1 234 567 890', startTime: now - 55000, duration: 60 * 60000, amount: 15.00, paid: true },
  { id: 2, status: 'busy', player: 'Sarah Connor', mobile: '+1 987 654 321', startTime: now - (48 * 60000 + 55000), duration: 60 * 60000, amount: 20.00, paid: false },
  { id: 3, status: 'busy', player: 'Alex Rivera', mobile: '+1 555 123 456', startTime: now - (59 * 60000 + 55000), duration: 60 * 60000, amount: 15.00, paid: true },
  { id: 4, status: 'available', player: null, mobile: null, startTime: null, duration: null, amount: null, paid: null }
];

const MOCK_TIMELINE_BOOKINGS = [
  // Table 1
  { id: 101, tableId: 1, player: 'John Doe', mobile: '555-0101', startTime: now - 3 * hour, duration: 1.5 * hour, amount: 22.5, paid: true },
  { id: 102, tableId: 1, player: 'Rahul Mehta', mobile: '+1 234 567 890', startTime: now - 55000, duration: 1 * hour, amount: 15.0, paid: true }, // Current
  { id: 103, tableId: 1, player: 'Alice Smith', mobile: '555-0102', startTime: now + 2 * hour, duration: 2 * hour, amount: 30.0, paid: false },

  // Table 2
  { id: 201, tableId: 2, player: 'Sarah Connor', mobile: '+1 987 654 321', startTime: now - (48 * 60000 + 55000), duration: 1 * hour, amount: 20.0, paid: false }, // Current
  { id: 202, tableId: 2, player: 'Mike Johnson', mobile: '555-0202', startTime: now + 1.5 * hour, duration: 1 * hour, amount: 15.0, paid: true },

  // Table 3
  { id: 301, tableId: 3, player: 'Bob Wilson', mobile: '555-0301', startTime: now - 4 * hour, duration: 2 * hour, amount: 30.0, paid: true },
  { id: 302, tableId: 3, player: 'Alex Rivera', mobile: '+1 555 123 456', startTime: now - (59 * 60000 + 55000), duration: 1 * hour, amount: 15.0, paid: true }, // Current

  // Table 4
  { id: 401, tableId: 4, player: 'Emma Davis', mobile: '555-0401', startTime: now - 2 * hour, duration: 1 * hour, amount: 15.0, paid: true },
  { id: 402, tableId: 4, player: 'Chris Lee', mobile: '555-0402', startTime: now + 0.5 * hour, duration: 1.5 * hour, amount: 22.5, paid: false },
];

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

import CreateBookingModal from '../components/timeline/CreateBookingModal';

export default function Bookings() {
  const [tables] = useState(MOCK_TABLES);
  const [timelineBookings, setTimelineBookings] = useState(MOCK_TIMELINE_BOOKINGS);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);

  const handleCreateBooking = (bookingData) => {
    const newBooking = {
      id: Date.now(), // Generate unique ID
      ...bookingData
    };
    setTimelineBookings(prev => [...prev, newBooking]);
    // In a real app, this would be an API call, and we'd update table status if currently active
  };

  const handleUpdateBooking = (updatedData) => {
    setTimelineBookings(prev =>
      prev.map(b => b.id === editingBooking.id ? { ...b, ...updatedData } : b)
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight text-white mb-2 drop-shadow-sm">
            Bookings
          </h1>
          <p className="text-text-dim text-sm md:text-base font-medium tracking-wide">
            Manage tables and active sessions
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-6 mb-12">
        {tables.map((table) => {
          const isBusy = table.status === 'busy';

          return (
            <a
              key={table.id}
              href={isBusy ? `tel:${table.mobile?.replace(/\s+/g, '')}` : undefined}
              title={isBusy ? `Call ${table.player}` : 'Assign Table'}
              className={`block relative group overflow-hidden rounded-[2rem] bg-[#18181b] border transition-colors duration-500 cursor-pointer flex flex-col justify-between h-[280px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5),inset_0_0_40px_rgba(255,255,255,0.05),inset_0_1px_1px_rgba(255,255,255,0.08)] select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.98] ${isBusy
                ? 'border-white/10 hover:border-danger/50 hover:shadow-[0_0_40px_rgba(240,82,82,0.2),inset_0_0_40px_rgba(255,255,255,0.05),inset_0_1px_1px_rgba(255,255,255,0.08)] active:border-danger/50 active:shadow-[0_0_40px_rgba(240,82,82,0.2),inset_0_0_40px_rgba(255,255,255,0.05),inset_0_1px_1px_rgba(255,255,255,0.08)]'
                : 'border-dashed border-white/20 hover:border-accent/50 hover:bg-accent/[0.03] hover:shadow-[0_0_40px_rgba(74,188,109,0.2),inset_0_0_40px_rgba(74,188,109,0.08),inset_0_1px_1px_rgba(255,255,255,0.08)] active:border-accent/50 active:bg-accent/[0.03] active:shadow-[0_0_40px_rgba(74,188,109,0.2),inset_0_0_40px_rgba(74,188,109,0.08),inset_0_1px_1px_rgba(255,255,255,0.08)]'
                }`}
            >
              {/* Giant Background Number with Parallax Hover Effect */}
              <div className="absolute -bottom-6 -right-6 text-[200px] font-display font-black leading-none text-white opacity-[0.02] group-hover:opacity-[0.04] group-hover:scale-110 group-hover:-rotate-6 group-active:opacity-[0.04] group-active:scale-110 group-active:-rotate-6 transition-transform duration-700 pointer-events-none select-none z-0 will-change-transform">
                {table.id}
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
                  <div className={`px-4 py-1.5 rounded-xl border font-bold text-[0.75rem] uppercase tracking-wider flex flex-col items-end ${table.paid ? 'bg-accent/5 text-accent border-accent/20' : 'bg-warning/5 text-warning border-warning/20'
                    }`}>
                    <span className="opacity-80">{table.paid ? 'Paid' : 'Unpaid'}</span>
                    <span className="text-sm">${Math.floor(table.amount)}</span>
                  </div>
                )}
              </div>

              {/* Bottom Row */}
              <div className="z-10 relative mt-auto">
                {isBusy ? (
                  <div className="space-y-5">
                    {/* User Info */}
                    <div className="flex items-center gap-4 group/user w-fit pr-8">
                      <div className="w-14 h-14 flex-shrink-0 rounded-full bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg shadow-black/50 group-hover:border-danger/40 group-hover:text-danger group-hover:shadow-[0_0_15px_rgba(240,82,82,0.2)] group-active:border-danger/40 group-active:text-danger transition-all">
                        {table.player.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-2xl font-bold tracking-tight text-white truncate group-hover:text-danger group-active:text-danger transition-colors">{table.player}</h4>
                        <p className="text-text-dim text-sm flex items-center gap-1.5 mt-1 font-medium truncate group-hover:text-danger/80 group-active:text-danger/80 transition-colors">
                          <PhoneIcon /> {table.mobile}
                        </p>
                      </div>
                    </div>

                    {/* Session Box */}
                    <div className="flex items-center gap-3 bg-white/[0.05] px-4 py-3 rounded-2xl border border-white/10 w-fit group-hover:bg-white/[0.08] group-hover:border-white/20 group-active:bg-white/[0.08] group-active:border-white/20 transition-colors">
                      <ClockIcon />
                      <p className="text-sm font-semibold text-white/90 flex items-center gap-2 whitespace-nowrap">
                        {formatTime(table.startTime)}
                        <span className="text-white/30">&rarr;</span>
                        {formatTime(table.startTime + table.duration)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center opacity-80 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pb-4">
                    <div className="relative w-20 h-20 mb-5 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-dashed border-accent/40 group-hover:border-accent/80 group-hover:rotate-90 group-active:border-accent/80 group-active:rotate-90 transition-all duration-700" />
                      <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center group-hover:scale-110 group-active:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(74,188,109,0.2)]">
                        <PlusIcon />
                      </div>
                    </div>
                    <h3 className="text-3xl font-display font-black text-white/90 tracking-tighter mb-1">Table 0{table.id}</h3>
                    <p className="text-accent/80 text-sm font-medium tracking-wide">Ready for Assignment</p>
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* Interactive Booking Timeline */}
      <BookingTimeline
        tables={tables}
        bookings={timelineBookings}
        onSlotClick={setSelectedSlot}
        onEditBooking={setEditingBooking}
      />

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
        onConfirm={(data) => {
          if (editingBooking) {
            handleUpdateBooking(data);
            setEditingBooking(null);
          } else {
            handleCreateBooking(data);
            setSelectedSlot(null);
          }
        }}
      />
    </div>
  );
}



