import { Controller, Get, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { MqttService } from '../hardware/mqtt.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly mqttService: MqttService,
  ) {}

  @Get()
  check() {
    const mongoStatus = this.connection.readyState === 1 ? 'connected' : 'disconnected';
    const mqttStatus = this.mqttService.isConnected() ? 'connected' : 'disconnected';
    
    const isHealthy = mongoStatus === 'connected' && mqttStatus === 'connected';

    if (!isHealthy) {
      this.logger.warn(`Health check degraded. Mongo: ${mongoStatus}, MQTT: ${mqttStatus}`);
    }

    return {
      status: isHealthy ? 'ok' : 'degraded',
      mongo: mongoStatus,
      mqtt: mqttStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
