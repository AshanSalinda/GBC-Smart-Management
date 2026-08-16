import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [BookingsModule],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class GatewayModule {}
