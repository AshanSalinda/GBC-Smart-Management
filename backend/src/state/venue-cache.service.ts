import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Booking, BookingDocument } from '../database/schemas/booking.schema';
import { Config, ConfigDocument } from '../database/schemas/config.schema';
import { getOperationalDayBounds } from '../common/utils/time.util';
import { TABLES_UPDATED_EVENT } from '../common/events/event-types';

/* ─── Interfaces ──────────────────────────────────────────────── */

export interface CurrentBookingState {
  bookingId: string;
  bookerName: string;
  bookerMobile: string;
  checkInTime: string;   // ISO 8601 UTC
  checkOutTime: string;  // ISO 8601 UTC
  durationMinutes: number;
  amount: number;
  isPaid: boolean;
}

export interface TableState {
  tableId: number;
  tableName: string;
  status: 'AVAILABLE' | 'BUSY' | 'PENDING';
  lightStatus: 'ON' | 'OFF' | 'PENDING-ON' | 'PENDING-OFF';
  currentBooking: CurrentBookingState | null;
}

export type VenueMemoryCache = Record<number, TableState>;

/* ─── Service ─────────────────────────────────────────────────── */

@Injectable()
export class VenueCacheService implements OnModuleInit {
  private readonly logger = new Logger(VenueCacheService.name);
  private cache: VenueMemoryCache = {};

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Config.name) private readonly configModel: Model<ConfigDocument>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /* ─── Boot Hydration ────────────────────────────────────────── */

  async onModuleInit() {
    await this.hydrateCache();
    this.logger.log('In-memory venue cache hydrated from MongoDB.');
  }

  /**
   * Hydrates the in-memory cache from MongoDB for the current operational moment.
   */
  async hydrateCache(): Promise<void> {
    // Initialize all 4 tables to AVAILABLE
    for (let i = 1; i <= 4; i++) {
      this.cache[i] = {
        tableId: i,
        tableName: `Table 0${i}`,
        status: 'AVAILABLE',
        lightStatus: 'PENDING-OFF',
        currentBooking: null,
      };
    }

    const now = new Date();

    // Find bookings that are currently active (spanning right now)
    const activeBookings = await this.bookingModel.find({
      status: { $ne: 'CANCELLED' },
      checkInTime: { $lte: now },
      checkOutTime: { $gt: now },
    }).exec();

    for (const booking of activeBookings) {
      const tid = booking.tableId;
      if (this.cache[tid]) {
        this.cache[tid].status = 'BUSY';
        this.cache[tid].lightStatus = 'PENDING-ON';
        this.cache[tid].currentBooking = {
          bookingId: (booking as any)._id.toString(),
          bookerName: booking.bookerName,
          bookerMobile: booking.bookerMobile || '',
          checkInTime: booking.checkInTime.toISOString(),
          checkOutTime: booking.checkOutTime.toISOString(),
          durationMinutes: booking.durationMinutes,
          amount: booking.amount,
          isPaid: booking.isPaid,
        };
      }
    }
  }

  /* ─── Cache Accessors ───────────────────────────────────────── */

  /** Returns the full in-memory state of all tables. */
  getAllTables(): TableState[] {
    return Object.values(this.cache);
  }

  /** Returns the state of a single table. */
  getTable(tableId: number): TableState | undefined {
    return this.cache[tableId];
  }

  /** Returns the raw cache map (for MQTT sync). */
  getCacheMap(): VenueMemoryCache {
    return this.cache;
  }

  /* ─── Cache Mutators ────────────────────────────────────────── */

  /**
   * Transitions a table to BUSY with the given booking data.
   * Emits TABLE_UPDATED_EVENT for decoupled MQTT + WebSocket broadcasting.
   */
  activateTable(tableId: number, booking: CurrentBookingState, source: string = 'unknown'): void {
    const table = this.cache[tableId];
    if (!table) return;

    table.status = 'BUSY';
    table.lightStatus = 'PENDING-ON';
    table.currentBooking = booking;

    this.emitTableUpdate(table, source);
  }

  /**
   * Transitions a table back to AVAILABLE, clearing the active booking.
   * Emits TABLE_UPDATED_EVENT.
   */
  deactivateTable(tableId: number, source: string = 'unknown'): void {
    const table = this.cache[tableId];
    if (!table) return;

    table.status = 'AVAILABLE';
    table.lightStatus = 'PENDING-OFF';
    table.currentBooking = null;

    this.emitTableUpdate(table, source);
  }

  /**
   * Manually toggles the light status without changing table/booking state.
   * Used by the lights manual override endpoint.
   */
  setLightStatus(tableId: number, targetState: 'ON' | 'OFF', source: string = 'unknown'): void {
    const table = this.cache[tableId];
    if (!table) return;

    table.lightStatus = targetState === 'ON' ? 'PENDING-ON' : 'PENDING-OFF';

    this.emitTableUpdate(table, source);
  }

  /**
   * Called by the MQTT service when the ESP32 acknowledges a relay command.
   * Resolves the PENDING-ON/PENDING-OFF state to ON/OFF and broadcasts the final state.
   */
  confirmLightStatus(tableId: number, relayState: 'ON' | 'OFF', source: string = 'hardware-ack'): void {
    const table = this.cache[tableId];
    if (!table) return;

    // Only update if it's resolving a pending state or fixing a mismatch
    if (table.lightStatus !== relayState) {
      table.lightStatus = relayState;
      this.emitTableUpdate(table, source);
    }
  }

  /**
   * Called when ESP32 acknowledges a full state sync.
   * Resolves all PENDING states across all tables.
   */
  confirmFullSync(source: string = 'hardware-sync-ack'): void {
    let changed = false;
    for (const table of Object.values(this.cache)) {
      if (table.lightStatus === 'PENDING-ON') {
        table.lightStatus = 'ON';
        changed = true;
      } else if (table.lightStatus === 'PENDING-OFF') {
        table.lightStatus = 'OFF';
        changed = true;
      }
    }
    
    if (changed) {
      this.eventEmitter.emit(TABLES_UPDATED_EVENT, this.getAllTables());
    }
  }

  /**
   * Updates the currentBooking data in-place (e.g., after PATCH).
   */
  updateCurrentBooking(tableId: number, partial: Partial<CurrentBookingState>, source: string = 'unknown'): void {
    const table = this.cache[tableId];
    if (!table || !table.currentBooking) return;

    Object.assign(table.currentBooking, partial);
    this.emitTableUpdate(table, source);
  }

  /* ─── Tick Cycle Helpers ────────────────────────────────────── */

  /**
   * Called by the 5-second cron tick to find bookings that should start now.
   */
  async findUpcomingBookingsToActivate(now: Date): Promise<BookingDocument[]> {
    return this.bookingModel.find({
      status: { $ne: 'CANCELLED' },
      checkInTime: { $lte: now },
      checkOutTime: { $gt: now },
    }).exec();
  }

  /* ─── Private ───────────────────────────────────────────────── */

  private emitTableUpdate(table: TableState, source: string = 'unknown'): void {
    this.logger.log(`[Transition] Table ${table.tableId} | Status: ${table.status} | Light: ${table.lightStatus} | Source: ${source}`);
    this.eventEmitter.emit(TABLES_UPDATED_EVENT, this.getAllTables());
  }
}
