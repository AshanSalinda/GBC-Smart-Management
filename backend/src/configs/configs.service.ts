import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Config, ConfigDocument } from '../database/schemas/config.schema';

@Injectable()
export class ConfigsService implements OnModuleInit {
  private readonly logger = new Logger(ConfigsService.name);

  constructor(
    @InjectModel(Config.name) private readonly configModel: Model<ConfigDocument>,
  ) {}

  /**
   * On module init, ensure a default GLOBAL_CONFIG document exists.
   */
  async onModuleInit() {
    const existing = await this.configModel.findOne({ key: 'GLOBAL_CONFIG' }).exec();
    if (!existing) {
      await this.configModel.create({
        key: 'GLOBAL_CONFIG',
        hourlyRate: 1500,
        venueCloseTime: '00:00',
        venueStartTime: '09:00',
      });
      this.logger.log('Default GLOBAL_CONFIG created.');
    }
  }

  /**
   * Returns the global configuration document.
   */
  async getConfig(): Promise<ConfigDocument | null> {
    return this.configModel.findOne({ key: 'GLOBAL_CONFIG' }).exec();
  }

  /**
   * Updates global configuration values.
   */
  async updateConfig(
    updates: Partial<{ hourlyRate: number; venueCloseTime: string; venueStartTime: string }>,
  ): Promise<ConfigDocument | null> {
    const config = await this.configModel
      .findOneAndUpdate(
        { key: 'GLOBAL_CONFIG' },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true, upsert: true },
      )
      .exec();
    this.logger.log(`Config updated: ${JSON.stringify(updates)}`);
    return config;
  }
}
