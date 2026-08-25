import { Controller, Get, HttpException, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { VenueCacheService } from '../state/venue-cache.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('hardware')
export class HardwareController {
  private readonly logger = new Logger(HardwareController.name);

  constructor(
    private readonly mqttService: MqttService,
    private readonly venueCacheService: VenueCacheService,
  ) { }

  @Get('health')
  @UseGuards(RolesGuard)
  @Roles('admin', 'staff')
  async getHardwareHealth() {
    try {
      // 1. Request hardware health from ESP32 via MQTT (waits up to 5 seconds)
      const hardwareData = await this.mqttService.requestHardwareHealth();

      // 2. Fetch the backend's current truth
      const backendCache = this.venueCacheService.getAllTables();

      // 3. Reconcile tables
      const reconciledTables: any[] = [];
      const hwTables = hardwareData.tables || {};

      for (const bTable of backendCache) {
        const hwState = hwTables[bTable.tableId.toString()];
        const bState = bTable.lightStatus === 'ON' || bTable.lightStatus === 'PENDING-ON' ? 'ON' : 'OFF';

        reconciledTables.push({
          tableId: bTable.tableId,
          backendState: bState,
          hardwareState: hwState || 'UNKNOWN',
          isSynced: bState === hwState,
        });
      }

      // 4. Return unified payload
      return {
        status: 'ONLINE',
        metadata: {
          deviceName: hardwareData.deviceName,
          macAddress: hardwareData.mac,
          uptimeMillis: hardwareData.uptime,
          freeHeap: hardwareData.freeHeap,
          heapSize: hardwareData.heapSize,
          temperature: hardwareData.temperature,
          ssid: hardwareData.ssid,
          rssi: hardwareData.rssi,
          ipAddress: hardwareData.ipAddress,
        },
        tables: reconciledTables,
      };
    } catch (err: any) {
      this.logger.error(`Failed to get hardware health: ${err.message}`);
      throw new HttpException(
        {
          status: 'OFFLINE',
          error: err.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
