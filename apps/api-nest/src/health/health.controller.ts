import { Controller, Get } from '@nestjs/common';

import { HealthService, HealthStatus } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  getHealth(): Promise<HealthStatus> {
    return this.healthService.getStatus();
  }

  @Get('api/health')
  getApiHealth(): Promise<HealthStatus> {
    return this.healthService.getStatus();
  }
}
