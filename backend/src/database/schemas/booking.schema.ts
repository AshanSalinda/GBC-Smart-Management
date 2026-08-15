import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BookingDocument = HydratedDocument<Booking>;

@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: false } })
export class Booking {
  @Prop({ type: Number, required: true, min: 1, max: 4, index: true })
  tableId: number;

  @Prop({ type: String, required: true, trim: true })
  bookerName: string;

  @Prop({ type: String, required: false, trim: true })
  bookerMobile: string;

  @Prop({ type: Date, required: true, index: true })
  checkInTime: Date;

  @Prop({ type: Date, required: true, index: true })
  checkOutTime: Date;

  @Prop({ type: Number, required: true })
  durationMinutes: number;

  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @Prop({ type: Boolean, required: true, default: false })
  isPaid: boolean;

  @Prop({
    type: String,
    required: true,
    default: 'ACTIVE',
    enum: ['ACTIVE', 'CANCELLED'],
    index: true,
  })
  status: string;

  @Prop({ type: String, required: true })
  createdBy: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Compound index for fast collision / timeline checking
BookingSchema.index({ tableId: 1, checkInTime: 1, checkOutTime: 1 });
