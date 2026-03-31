import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { LaravelCryptoService } from './laravel-crypto.service';
import { OpenClawConfigWriterService } from './openclaw-config-writer.service';
import { OpenClawGatewayHealthService } from './openclaw-gateway-health.service';
import { OpenClawModelCatalogService } from './openclaw-model-catalog.service';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [SettingsController],
  providers: [
    LaravelCryptoService,
    OpenClawConfigWriterService,
    OpenClawGatewayHealthService,
    OpenClawModelCatalogService,
    SettingsRepository,
    SettingsService,
  ],
  exports: [OpenClawConfigWriterService],
})
export class SettingsModule {}
