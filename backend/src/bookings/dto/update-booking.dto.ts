import {
  IsNumber,
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * DTO for PATCH /api/bookings/:id.
 *
 * Allows updating checkInTime, checkOutTime, bookerName, bookerMobile, amount, and isPaid.
 * All fields are optional (partial update).
 */
export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  bookerName?: string;

  @IsOptional()
  @IsString()
  bookerMobile?: string;

  @IsOptional()
  @IsISO8601()
  checkInTime?: string;

  @IsOptional()
  @IsISO8601()
  checkOutTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}
