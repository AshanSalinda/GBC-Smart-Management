import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration, { envValidationSchema } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { StateModule } from './state/state.module';
import { HardwareModule } from './hardware/hardware.module';
import { GatewayModule } from './gateway/gateway.module';
import { BookingsModule } from './bookings/bookings.module';
import { LightsModule } from './lights/lights.module';
import { ConfigsModule } from './configs/configs.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // ─── Core Infrastructure ─────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,         // Fail fast on first missing env var
        allowUnknown: true,       // Allow extra env vars (NODE_ENV, etc.)
      },
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
      }),
    }),

    ScheduleModule.forRoot(),

    EventEmitterModule.forRoot(),

    // ─── Domain Modules ──────────────────────────────────────────
    AuthModule,
    StateModule,
    HardwareModule,
    GatewayModule,
    BookingsModule,
    LightsModule,
    ConfigsModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
