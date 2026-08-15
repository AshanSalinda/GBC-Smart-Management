import {
  IsString,
  IsNumber,
  IsBoolean,
  IsISO8601,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

/**
 * DTO for POST /api/bookings.
 *
 * class-validator decorators enforce strict typing before the data
 * reaches the controller. The global ValidationPipe with whitelist: true
 * strips any unknown fields (e.g., a fake durationMinutes from the client).
 */
export class CreateBookingDto {
  @IsNumber()
  @Min(1)
  @Max(4)
  tableId: number;

  @IsString()
  bookerName: string;

  @IsOptional()
  @IsString()
  bookerMobile?: string;

  @IsISO8601()
  checkInTime: string;

  @IsISO8601()
  checkOutTime: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsBoolean()
  isPaid: boolean;
}
