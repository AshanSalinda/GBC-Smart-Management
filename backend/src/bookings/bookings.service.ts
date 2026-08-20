import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Mutex } from 'async-mutex';
import { Booking, BookingDocument } from '../database/schemas/booking.schema';
import { Config, ConfigDocument } from '../database/schemas/config.schema';
import { VenueCacheService } from '../state/venue-cache.service';
import { BookingSchedulerService } from '../state/booking-scheduler.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { getOperationalDayBounds } from '../common/utils/time.util';
import {
  TIMELINE_UPDATED_EVENT,
} from '../common/events/event-types';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  /**
   * Per-table mutex map.
   * Serializes all booking mutations (create/update/cancel) for a given tableId
   * so that the overlap check + write is atomic. Two concurrent requests for the
   * same table are queued — the second sees the first's write and correctly 409s.
   *
   * Different tables are independent and can proceed in parallel.
   */
  private readonly tableMutexes: Map<number, Mutex>;

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Config.name) private readonly configModel: Model<ConfigDocument>,
    private readonly venueCacheService: VenueCacheService,
    private readonly bookingSchedulerService: BookingSchedulerService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Pre-create a mutex for each of the 4 tables
    this.tableMutexes = new Map<number, Mutex>();
    for (let i = 1; i <= 4; i++) {
      this.tableMutexes.set(i, new Mutex());
    }
  }

  /**
   * Returns the mutex for a given table, creating one lazily if needed
   * (defensive, in case table count ever changes).
   */
  private getMutex(tableId: number): Mutex {
    let mutex = this.tableMutexes.get(tableId);
    if (!mutex) {
      mutex = new Mutex();
      this.tableMutexes.set(tableId, mutex);
    }
    return mutex;
  }

  /* ─── CREATE ────────────────────────────────────────────────── */

  async createBooking(dto: CreateBookingDto, createdBy: string, role: string = 'staff'): Promise<BookingDocument> {
    const mutex = this.getMutex(dto.tableId);

    return mutex.runExclusive(async () => {
      const checkIn = new Date(dto.checkInTime);
      const checkOut = new Date(dto.checkOutTime);

      // 1. Calculate duration and validate checkOut > checkIn
      const durationMinutes = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
      if (durationMinutes <= 0) {
        throw new BadRequestException('checkOutTime must be after checkInTime.');
      }

      // 2. Role-based temporal boundaries (Now buffer)
      const now = new Date();
      if (checkIn < now && role !== 'admin') {
        const config = await this.configModel.findOne({ key: 'GLOBAL_CONFIG' }).exec();
        const venueStartTime = config?.venueStartTime || '09:00';
        const todayBounds = getOperationalDayBounds(now, venueStartTime);
        
        if (checkIn < todayBounds.start) {
          throw new BadRequestException('Staff cannot create bookings in the past outside the current operational day.');
        }
      }

      // 3. Check for overlapping bookings on the same table
      //    Inside the mutex, this read + the write below are serialized.
      await this.assertNoOverlap(dto.tableId, checkIn, checkOut);

      // 4. Save booking
      const booking = await this.bookingModel.create({
        tableId: dto.tableId,
        bookerName: dto.bookerName,
        bookerMobile: dto.bookerMobile || '',
        checkInTime: checkIn,
        checkOutTime: checkOut,
        durationMinutes,
        amount: dto.amount,
        isPaid: dto.isPaid,
        status: 'ACTIVE',
        createdBy,
      });

      this.logger.log(`Booking created: ${booking._id} for Table ${dto.tableId}`);

      // 5. Sync in-memory cache if booking is currently active
      const syncTime = new Date();
      if (checkIn <= syncTime && checkOut > syncTime) {
        this.venueCacheService.activateTable(dto.tableId, {
          bookingId: booking._id.toString(),
          bookerName: booking.bookerName,
          bookerMobile: booking.bookerMobile,
          checkInTime: booking.checkInTime.toISOString(),
          checkOutTime: booking.checkOutTime.toISOString(),
          durationMinutes: booking.durationMinutes,
          amount: booking.amount,
          isPaid: booking.isPaid,
        }, 'booking-create');
      }

      // 6. Broadcast full timeline
      await this.emitTimelineUpdate();

      // 7. Update deadline timers
      await this.bookingSchedulerService.rescheduleTable(dto.tableId);

      return booking;
    });
  }

  /* ─── GET TIMELINE ──────────────────────────────────────────── */

  async getTimeline(dateStr: string): Promise<BookingDocument[]> {
    // Fetch venue config for venueStartTime
    const config = await this.configModel.findOne({ key: 'GLOBAL_CONFIG' }).exec();
    const venueStartTime = config?.venueStartTime || '09:00';

    const { start, end } = getOperationalDayBounds(dateStr, venueStartTime);

    return this.bookingModel
      .find({
        status: { $ne: 'CANCELLED' },
        checkInTime: { $lt: end },
        checkOutTime: { $gt: start },
      })
      .sort({ tableId: 1, checkInTime: 1 })
      .exec();
  }

  /* ─── UPDATE ────────────────────────────────────────────────── */

  async updateBooking(id: string, dto: UpdateBookingDto, role: string = 'staff'): Promise<BookingDocument> {
    // We need to find the booking first to know which table mutex to acquire.
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking || booking.status === 'CANCELLED') {
      throw new NotFoundException('Booking not found or already cancelled.');
    }

    const mutex = this.getMutex(booking.tableId);

    return mutex.runExclusive(async () => {
      // Re-fetch inside the mutex to see the latest state
      const freshBooking = await this.bookingModel.findById(id).exec();
      if (!freshBooking || freshBooking.status === 'CANCELLED') {
        throw new NotFoundException('Booking not found or already cancelled.');
      }

      // If checkInTime or checkOutTime is being modified, re-validate
      if (dto.checkOutTime || dto.checkInTime) {
        const newCheckIn = dto.checkInTime ? new Date(dto.checkInTime) : freshBooking.checkInTime;
        const newCheckOut = dto.checkOutTime ? new Date(dto.checkOutTime) : freshBooking.checkOutTime;

        if (newCheckOut <= newCheckIn) {
          throw new BadRequestException('checkOutTime must be after checkInTime.');
        }

        // Re-check for overlaps excluding this booking (serialized by mutex)
        await this.assertNoOverlap(freshBooking.tableId, newCheckIn, newCheckOut, id);

        // Recompute duration
        freshBooking.checkInTime = newCheckIn;
        freshBooking.checkOutTime = newCheckOut;
        freshBooking.durationMinutes = Math.round(
          (newCheckOut.getTime() - newCheckIn.getTime()) / 60000,
        );
      }

      if (dto.bookerName !== undefined) {
        freshBooking.bookerName = dto.bookerName;
      }

      if (dto.bookerMobile !== undefined) {
        freshBooking.bookerMobile = dto.bookerMobile;
      }

      if (dto.amount !== undefined) {
        freshBooking.amount = dto.amount;
      }

      if (dto.isPaid !== undefined) {
        freshBooking.isPaid = dto.isPaid;
      }

      await freshBooking.save();
      this.logger.log(`Booking updated: ${id}`);

      // Sync cache if this booking is currently active
      const now = new Date();
      if (freshBooking.checkInTime <= now && freshBooking.checkOutTime > now) {
        this.venueCacheService.updateCurrentBooking(freshBooking.tableId, {
          bookerName: freshBooking.bookerName,
          bookerMobile: freshBooking.bookerMobile,
          checkInTime: freshBooking.checkInTime.toISOString(),
          checkOutTime: freshBooking.checkOutTime.toISOString(),
          durationMinutes: freshBooking.durationMinutes,
          amount: freshBooking.amount,
          isPaid: freshBooking.isPaid,
        }, 'booking-update');
      }

      // Broadcast
      await this.emitTimelineUpdate();

      // Update deadline timers
      await this.bookingSchedulerService.rescheduleTable(freshBooking.tableId);

      return freshBooking;
    });
  }

  /* ─── CANCEL ────────────────────────────────────────────────── */

  async cancelBooking(id: string): Promise<BookingDocument> {
    // Find first to get the tableId for the mutex
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking || booking.status === 'CANCELLED') {
      throw new NotFoundException('Booking not found or already cancelled.');
    }

    const mutex = this.getMutex(booking.tableId);

    return mutex.runExclusive(async () => {
      // Re-fetch inside the mutex
      const freshBooking = await this.bookingModel.findById(id).exec();
      if (!freshBooking || freshBooking.status === 'CANCELLED') {
        throw new NotFoundException('Booking not found or already cancelled.');
      }

      freshBooking.status = 'CANCELLED';
      await freshBooking.save();
      this.logger.log(`Booking cancelled: ${id}`);

      // If this booking is currently active in cache, deactivate the table
      const now = new Date();
      if (freshBooking.checkInTime <= now && freshBooking.checkOutTime > now) {
        const table = this.venueCacheService.getTable(freshBooking.tableId);
        if (table?.currentBooking?.bookingId === id) {
          this.venueCacheService.deactivateTable(freshBooking.tableId, 'booking-cancel');
        }
      }

      // Broadcast
      await this.emitTimelineUpdate();

      // Update deadline timers
      await this.bookingSchedulerService.rescheduleTable(freshBooking.tableId);

      return freshBooking;
    });
  }

  /* ─── Overlap Detection ─────────────────────────────────────── */

  /**
   * Checks for overlapping active bookings on the same table.
   * Uses the standard overlap formula: A.start < B.end AND A.end > B.start
   *
   * IMPORTANT: This method MUST be called inside a table mutex to guarantee
   * that the check and subsequent write are atomic. Without the mutex, two
   * concurrent calls can both pass this check before either writes.
   *
   * @param excludeBookingId  - Optional booking ID to exclude (for PATCH updates).
   */
  private async assertNoOverlap(
    tableId: number,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const query: any = {
      tableId,
      status: { $ne: 'CANCELLED' },
      checkInTime: { $lt: checkOut },
      checkOutTime: { $gt: checkIn },
    };

    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const overlap = await this.bookingModel.findOne(query).exec();
    if (overlap) {
      throw new ConflictException(
        `Table ${tableId} is already booked during this time window ` +
        `(conflicting booking: ${overlap._id}).`,
      );
    }
  }

  /* ─── Private Helpers ───────────────────────────────────────── */

  private async emitTimelineUpdate(): Promise<void> {
    try {
      const today = new Date().toISOString();
      const timeline = await this.getTimeline(today);
      this.eventEmitter.emit(TIMELINE_UPDATED_EVENT, timeline);
    } catch (err) {
      this.logger.error('Failed to emit timeline update', err);
    }
  }
}
