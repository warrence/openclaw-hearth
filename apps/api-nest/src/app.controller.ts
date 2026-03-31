import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { appConfig } from './config/app.config';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getInfo(): { name: string; status: string; docs: string } {
    return this.buildInfo();
  }

  @Get('api/info')
  getApiInfo(): { name: string; status: string; docs: string } {
    return this.buildInfo();
  }

  private buildInfo(): { name: string; status: string; docs: string } {
    const config = this.configService.get('app', { infer: true });

    return {
      name: config?.name ?? 'hearth-api-nest',
      status: 'ok',
      docs: 'See /health or /api/health for status and README.md for migration notes.',
    };
  }
}
