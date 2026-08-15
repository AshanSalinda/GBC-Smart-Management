import { Module } from '@nestjs/common';
import { LightsController } from './lights.controller';

@Module({
  controllers: [LightsController],
})
export class LightsModule {}
