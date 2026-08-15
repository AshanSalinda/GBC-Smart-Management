import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { VenueCacheService } from '../state/venue-cache.service';
import { IsNumber, IsIn, Min, Max } from 'class-validator';

/**
 * DTO for POST /api/lights/toggle
 */
class ToggleLightDto {
  @IsNumber()
  @Min(1)
  @Max(4)
  tableId: number;

  @IsIn(['ON', 'OFF'])
  targetState: 'ON' | 'OFF';
}

/**
 * Lights manual override controller.
 *
 * Uses the SAME unified state engine as bookings:
 *   toggle desired light → cache update → EventEmitter → MQTT + WebSocket
 *
 * This is NOT a separate side-path. The VenueCacheService.setLightStatus()
 * emits TABLE_UPDATED_EVENT, which both MqttService and AppGateway listen to.
 */
@Controller('api/lights')
@UseGuards(RolesGuard)
export class LightsController {
  constructor(private readonly venueCacheService: VenueCacheService) {}

  @Post('toggle')
  @Roles('admin', 'staff')
  toggle(@Body() dto: ToggleLightDto) {
    const table = this.venueCacheService.getTable(dto.tableId);
    if (!table) {
      throw new BadRequestException(`Table ${dto.tableId} does not exist.`);
    }

    this.venueCacheService.setLightStatus(dto.tableId, dto.targetState);

    return {
      message: `Table ${dto.tableId} light set to ${dto.targetState}.`,
      tableId: dto.tableId,
      lightStatus: dto.targetState,
    };
  }
}
