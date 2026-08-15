import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/bookings')
@UseGuards(RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  /**
   * POST /api/bookings
   * Creates a new booking with overlap validation.
   */
  @Post()
  @Roles('admin', 'staff')
  async create(@Body() dto: CreateBookingDto, @Req() req: any) {
    const createdBy = req.user?.email || req.user?.uid || 'unknown';
    const role = req.user?.role || 'staff';
    return this.bookingsService.createBooking(dto, createdBy, role);
  }

  /**
   * GET /api/bookings/timeline?date=YYYY-MM-DD
   * Returns all non-cancelled bookings for the operational day.
   */
  @Get('timeline')
  @Roles('admin', 'staff')
  async getTimeline(@Query('date') date: string) {
    return this.bookingsService.getTimeline(date);
  }

  /**
   * PATCH /api/bookings/:id
   * Partial update (checkOutTime, amount, isPaid).
   */
  @Patch(':id')
  @Roles('admin', 'staff')
  async update(@Param('id') id: string, @Body() dto: UpdateBookingDto, @Req() req: any) {
    const role = req.user?.role || 'staff';
    return this.bookingsService.updateBooking(id, dto, role);
  }

  /**
   * DELETE /api/bookings/:id
   * Soft-cancels a booking (sets status to CANCELLED).
   */
  @Delete(':id')
  @Roles('admin', 'staff')
  async cancel(@Param('id') id: string) {
    return this.bookingsService.cancelBooking(id);
  }
}
