import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../database/schemas/booking.schema';
import { Config, ConfigSchema } from '../database/schemas/config.schema';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: Config.name, schema: ConfigSchema },
    ]),
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
