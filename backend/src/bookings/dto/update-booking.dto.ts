import {
  IsNumber,
  IsBoolean,
  IsISO8601,
  IsOptional,
  Min,
} from 'class-validator';

/**
 * DTO for PATCH /api/bookings/:id.
 *
 * Only allows updating checkOutTime, amount, and isPaid.
 * All fields are optional (partial update).
 */
export class UpdateBookingDto {
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
