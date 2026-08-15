import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../database/schemas/booking.schema';
import { Config, ConfigSchema } from '../database/schemas/config.schema';
import { VenueCacheService } from './venue-cache.service';
import { StateCronService } from './state-cron.service';
import { BookingSchedulerService } from './booking-scheduler.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Config.name, schema: ConfigSchema },
    ]),
  ],
  providers: [VenueCacheService, StateCronService, BookingSchedulerService],
  exports: [VenueCacheService, BookingSchedulerService],
})
export class StateModule {}
