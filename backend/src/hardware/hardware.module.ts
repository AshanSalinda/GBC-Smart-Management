import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { HardwareController } from './hardware.controller';
import { StateModule } from '../state/state.module';

@Module({
  imports: [StateModule],
  controllers: [HardwareController],
  providers: [MqttService],
  exports: [MqttService],
})
export class HardwareModule {}
