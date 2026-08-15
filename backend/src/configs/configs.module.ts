import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Config, ConfigSchema } from '../database/schemas/config.schema';
import { ConfigsController } from './configs.controller';
import { ConfigsService } from './configs.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Config.name, schema: ConfigSchema }]),
  ],
  controllers: [ConfigsController],
  providers: [ConfigsService],
  exports: [ConfigsService],
})
export class ConfigsModule {}
