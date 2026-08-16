/**
 * Internal event names and payload interfaces for the EventEmitter-based
 * decoupling between modules (Cache ↔ MQTT ↔ WebSocket Gateway).
 */

export const TABLE_UPDATED_EVENT = 'table.updated';
export const BOOKING_MUTATED_EVENT = 'booking.mutated';
export const HARDWARE_SYNC_REQUEST_EVENT = 'hardware.sync.request';

export interface TableUpdatedPayload {
  tableId: number;
  tableName: string;
  status: 'AVAILABLE' | 'BUSY' | 'PENDING';
  lightStatus: 'ON' | 'OFF' | 'PENDING-ON' | 'PENDING-OFF';
  currentBooking: {
    bookingId: string;
    bookerName: string;
    bookerMobile: string;
    checkInTime: string;
    checkOutTime: string;
    durationMinutes: number;
    amount: number;
    isPaid: boolean;
  } | null;
}

export interface BookingMutatedPayload {
  action: 'CREATED' | 'UPDATED' | 'CANCELLED';
  booking: {
    id: string;
    tableId: number;
    bookerName: string;
    bookerMobile: string;
    checkInTime: string;
    checkOutTime: string;
    durationMinutes: number;
    amount: number;
    isPaid: boolean;
  };
}

export interface HardwareSyncRequestPayload {
  macAddress: string;
  event: string;
}
