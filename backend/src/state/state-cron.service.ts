import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { VenueCacheService } from './venue-cache.service';
import { BookingSchedulerService } from './booking-scheduler.service';

/**
 * The 5-Second Reconcile Cycle (Safety Net).
 *
 * Evaluates all 4 tables in the in-memory cache every 5 seconds to catch drift,
 * missed timer fires, or process restart gaps.
 * Primary state transitions are handled by exact timeouts in BookingSchedulerService.
 */
@Injectable()
export class StateCronService {
  private readonly logger = new Logger(StateCronService.name);

  constructor(
    private readonly venueCacheService: VenueCacheService,
    private readonly bookingSchedulerService: BookingSchedulerService,
  ) {}

  @Interval(5000)
  async handleTick(): Promise<void> {
    const now = new Date();

    for (let tableId = 1; tableId <= 4; tableId++) {
      const table = this.venueCacheService.getTable(tableId);
      if (!table) continue;

      // ─── Scheduled End: booking has expired ────────────────────
      if (
        table.status === 'BUSY' &&
        table.currentBooking &&
        now >= new Date(table.currentBooking.checkOutTime)
      ) {
        this.logger.warn(`[Cron Reconcile] Table ${tableId} booking expired but timer missed. Deactivating.`);
        this.venueCacheService.deactivateTable(tableId, 'cron-reconcile');
        await this.bookingSchedulerService.rescheduleTable(tableId);
        continue;
      }

      // ─── Scheduled Start: check if any booking should begin ───
      if (table.status === 'AVAILABLE') {
        const candidates = await this.venueCacheService.findUpcomingBookingsToActivate(now);
        const match = candidates.find((b) => b.tableId === tableId);

        if (match) {
          this.logger.warn(`[Cron Reconcile] Table ${tableId} should be active for booking ${(match as any)._id} but timer missed. Activating.`);
          this.venueCacheService.activateTable(tableId, {
            bookingId: (match as any)._id.toString(),
            bookerName: match.bookerName,
            bookerMobile: match.bookerMobile || '',
            checkInTime: match.checkInTime.toISOString(),
            checkOutTime: match.checkOutTime.toISOString(),
            durationMinutes: match.durationMinutes,
            amount: match.amount,
            isPaid: match.isPaid,
          }, 'cron-reconcile');
          await this.bookingSchedulerService.rescheduleTable(tableId);
        }
      }
    }
  }
}
