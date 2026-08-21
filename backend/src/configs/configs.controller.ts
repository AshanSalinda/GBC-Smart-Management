import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ConfigsService } from './configs.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

class UpdateConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  venueCloseTime?: string;

  @IsOptional()
  @IsString()
  venueStartTime?: string;
}

@Controller('api/configs')
@UseGuards(RolesGuard)
export class ConfigsController {
  constructor(private readonly configsService: ConfigsService) {}

  @Get()
  @Roles('admin', 'staff')
  async getConfig() {
    return this.configsService.getConfig();
  }

  @Patch()
  @Roles('admin')
  async updateConfig(@Body() dto: UpdateConfigDto) {
    return this.configsService.updateConfig(dto);
  }
}
