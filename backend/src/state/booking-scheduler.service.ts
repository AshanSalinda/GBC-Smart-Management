import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../database/schemas/booking.schema';
import { VenueCacheService } from './venue-cache.service';

/**
 * Deadline-based timer scheduler for exact booking start/end transitions.
 *
 * Each table can have at most two timers:
 *   - `{tableId}:start` → fires at checkInTime → activates table, then sets end timer
 *   - `{tableId}:end`   → fires at checkOutTime → deactivates table, then chains to next booking
 *
 * Timer callbacks use the SAME activate/deactivate path as lights toggle and cron,
 * so MQTT + WS stay on the EventEmitter bus.
 *
 * The 5-second cron is demoted to reconcile-only (catches missed fires, process restarts, drift).
 */
@Injectable()
export class BookingSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingSchedulerService.name);

  /** Active timers keyed by "{tableId}:start" or "{tableId}:end" */
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    private readonly venueCacheService: VenueCacheService,
  ) {}

  /* ─── Lifecycle ─────────────────────────────────────────────── */

  async onModuleInit() {
    // Process restart: timers die with the process, so re-schedule everything
    await this.scheduleAllTables();
    this.logger.log('Deadline timers initialized for all tables.');
  }

  onModuleDestroy() {
    for (const [, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.logger.log('All deadline timers cleared.');
  }

  /* ─── Public API ────────────────────────────────────────────── */

  /**
   * Clears existing timers for a table and re-queries the DB to schedule
   * the correct next deadline(s). Safe to call after any mutation
   * (create, update, cancel) — it always converges to the right state.
   */
  async rescheduleTable(tableId: number): Promise<void> {
    this.clearTableTimers(tableId);
    const now = new Date();

    // 1. Is there a currently active booking? → schedule its end
    const active = await this.bookingModel.findOne({
      tableId,
      status: { $ne: 'CANCELLED' },
      checkInTime: { $lte: now },
      checkOutTime: { $gt: now },
    }).exec();

    if (active) {
      this.setEndTimer(tableId, active._id.toString(), active.checkOutTime);
      return; // end timer callback will chain to the next booking
    }

    // 2. No active booking → find the next upcoming one → schedule its start
    const next = await this.bookingModel.findOne({
      tableId,
      status: { $ne: 'CANCELLED' },
      checkInTime: { $gt: now },
    }).sort({ checkInTime: 1 }).exec();

    if (next) {
      this.setStartTimer(tableId, next._id.toString(), next.checkInTime);
    }
  }

  /**
   * Schedules deadline timers for all 4 tables.
   * Called on boot (after cache hydration) and optionally after bulk operations.
   */
  async scheduleAllTables(): Promise<void> {
    for (let tableId = 1; tableId <= 4; tableId++) {
      await this.rescheduleTable(tableId);
    }
  }

  /* ─── Timer Setters ─────────────────────────────────────────── */

  private setStartTimer(tableId: number, bookingId: string, checkInTime: Date): void {
    const delay = Math.max(0, checkInTime.getTime() - Date.now());
    const key = `${tableId}:start`;

    this.clearTimer(key);

    const timer = setTimeout(() => {
      this.timers.delete(key);
      this.handleStartFired(tableId, bookingId);
    }, delay);

    // Prevent the timer from keeping Node.js alive during graceful shutdown
    if (timer.unref) timer.unref();

    this.timers.set(key, timer);
    this.logger.log(
      `[Timer] Table ${tableId} START scheduled: ${checkInTime.toISOString()} (in ${Math.round(delay / 1000)}s)`,
    );
  }

  private setEndTimer(tableId: number, bookingId: string, checkOutTime: Date): void {
    const delay = Math.max(0, checkOutTime.getTime() - Date.now());
    const key = `${tableId}:end`;

    this.clearTimer(key);

    const timer = setTimeout(() => {
      this.timers.delete(key);
      this.handleEndFired(tableId, bookingId);
    }, delay);

    if (timer.unref) timer.unref();

    this.timers.set(key, timer);
    this.logger.log(
      `[Timer] Table ${tableId} END scheduled: ${checkOutTime.toISOString()} (in ${Math.round(delay / 1000)}s)`,
    );
  }

  /* ─── Timer Callbacks ───────────────────────────────────────── */

  /**
   * Fires at the exact checkInTime of a booking.
   * Re-fetches from DB to verify the booking is still valid (not cancelled/modified
   * between scheduling and firing), then activates via the same cache path
   * used by lights toggle and cron.
   */
  private async handleStartFired(tableId: number, bookingId: string): Promise<void> {
    const booking = await this.bookingModel.findById(bookingId).exec();

    if (!booking || booking.status === 'CANCELLED') {
      this.logger.warn(
        `[Timer] Table ${tableId} start fired but booking ${bookingId} is no longer active. Rescheduling.`,
      );
      await this.rescheduleTable(tableId);
      return;
    }

    const now = new Date();
    if (booking.checkInTime <= now && booking.checkOutTime > now) {
      this.logger.log(`[Timer] Table ${tableId} ACTIVATING via deadline timer (booking ${bookingId}).`);

      // Same activation path as cron/lights — goes through EventEmitter → MQTT + WS
      this.venueCacheService.activateTable(tableId, {
        bookingId: booking._id.toString(),
        bookerName: booking.bookerName,
        bookerMobile: booking.bookerMobile || '',
        checkInTime: booking.checkInTime.toISOString(),
        checkOutTime: booking.checkOutTime.toISOString(),
        durationMinutes: booking.durationMinutes,
        amount: booking.amount,
        isPaid: booking.isPaid,
      }, 'timer-start');

      // Chain: schedule the end timer for this booking
      this.setEndTimer(tableId, booking._id.toString(), booking.checkOutTime);
    } else {
      this.logger.warn(
        `[Timer] Table ${tableId} start fired but timing mismatch (checkIn: ${booking.checkInTime.toISOString()}, now: ${now.toISOString()}). Rescheduling.`,
      );
      await this.rescheduleTable(tableId);
    }
  }

  /**
   * Fires at the exact checkOutTime of a booking.
   * Verifies the table is still BUSY with this specific booking before deactivating,
   * then chains to the next upcoming booking for this table.
   */
  private async handleEndFired(tableId: number, bookingId: string): Promise<void> {
    const table = this.venueCacheService.getTable(tableId);

    if (table?.status === 'BUSY' && table.currentBooking?.bookingId === bookingId) {
      this.logger.log(`[Timer] Table ${tableId} DEACTIVATING via deadline timer (booking ${bookingId}).`);

      // Same deactivation path — goes through EventEmitter → MQTT + WS
      this.venueCacheService.deactivateTable(tableId, 'timer-end');
    } else {
      this.logger.warn(
        `[Timer] Table ${tableId} end fired but state mismatch ` +
        `(status: ${table?.status}, currentBooking: ${table?.currentBooking?.bookingId}). Skipping.`,
      );
    }

    // Chain: find next upcoming booking for this table and schedule its start
    const now = new Date();
    const next = await this.bookingModel.findOne({
      tableId,
      status: { $ne: 'CANCELLED' },
      checkInTime: { $gt: now },
    }).sort({ checkInTime: 1 }).exec();

    if (next) {
      this.setStartTimer(tableId, next._id.toString(), next.checkInTime);
    }
  }

  /* ─── Helpers ───────────────────────────────────────────────── */

  private clearTableTimers(tableId: number): void {
    this.clearTimer(`${tableId}:start`);
    this.clearTimer(`${tableId}:end`);
  }

  private clearTimer(key: string): void {
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(key);
    }
  }
}
