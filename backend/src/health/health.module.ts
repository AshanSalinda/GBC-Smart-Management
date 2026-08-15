import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HardwareModule } from '../hardware/hardware.module';

@Module({
  imports: [HardwareModule],
  controllers: [HealthController],
})
export class HealthModule {}
