import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { OwnerAuthGuard } from '../auth/owner-auth.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { TestGatewayConnectionDto } from './dto/test-gateway-connection.dto';
import { UpdateGatewayConfigDto } from './dto/update-gateway-config.dto';
import { UpdateModelPresetSettingsDto } from './dto/update-model-preset-settings.dto';
import { SettingsService } from './settings.service';

@Controller('api')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('openclaw-model-options')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  getOpenClawModelOptions(): Promise<Record<string, unknown>> {
    return this.settingsService.getOpenClawModelOptions();
  }

  @Get('model-preset-settings')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  getModelPresetSettings(): Promise<Record<string, unknown>> {
    return this.settingsService.getModelPresetSettings();
  }

  @Patch('model-preset-settings')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  updateModelPresetSettings(
    @Body() body: UpdateModelPresetSettingsDto,
  ): Promise<Record<string, unknown>> {
    return this.settingsService.updateModelPresetSettings(body);
  }

  @Get('gateway/status')
  @UseGuards(SessionAuthGuard)
  getGatewayStatus(): Promise<Record<string, unknown>> {
    return this.settingsService.getGatewayStatus();
  }

  @Post('gateway/test-connection')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  testGatewayConnection(
    @Body() body: TestGatewayConnectionDto,
  ): Promise<Record<string, unknown>> {
    return this.settingsService.testGatewayConnection(body);
  }

  @Put('gateway/config')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  updateGatewayConfig(
    @Body() body: UpdateGatewayConfigDto,
  ): Promise<Record<string, unknown>> {
    return this.settingsService.updateGatewayConfig(body);
  }

  @Get('agent-settings')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  getAgentSettings(): Promise<Record<string, unknown>> {
    return this.settingsService.getAgentSettings();
  }

  @Put('agent-settings')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  @HttpCode(HttpStatus.OK)
  updateAgentSettings(
    @Body() body: { aerisAgentId: string },
  ): Promise<Record<string, unknown>> {
    return this.settingsService.updateAgentSettings(body.aerisAgentId);
  }

  @Put('agent-display-name')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  @HttpCode(HttpStatus.OK)
  updateAgentDisplayName(
    @Body() body: { name: string },
  ): Promise<Record<string, unknown>> {
    return this.settingsService.updateAgentDisplayName(body.name);
  }

  @Get('reminder-settings')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  getReminderSettings(): Record<string, unknown> {
    return this.settingsService.getReminderSettings();
  }

  @Put('reminder-settings')
  @UseGuards(SessionAuthGuard, OwnerAuthGuard)
  @HttpCode(HttpStatus.OK)
  updateReminderSettings(
    @Body() body: { critical: { enabled: boolean; intervalMinutes: number; maxRepeats: number } },
  ): Record<string, unknown> {
    return this.settingsService.updateReminderSettings(body.critical);
  }
}
