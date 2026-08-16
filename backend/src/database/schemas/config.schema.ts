import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConfigDocument = HydratedDocument<Config>;

@Schema({ 
  timestamps: { createdAt: false, updatedAt: 'updatedAt' },
  toJSON: {
    virtuals: true,
    transform: (doc, ret: Record<string, any>) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
})
export class Config {
  @Prop({ type: String, required: true, unique: true, default: 'GLOBAL_CONFIG' })
  key: string;

  @Prop({ type: Number, required: true, default: 1500 })
  hourlyRate: number;

  @Prop({ type: Number, required: true, default: 16 })
  workingHoursPerDay: number;

  @Prop({ type: String, required: true, default: '09:00' })
  venueStartTime: string;
}

export const ConfigSchema = SchemaFactory.createForClass(Config);
