import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { appConfig } from '../config/app.config';
import { databaseConfig, DatabaseConfig } from '../config/database.config';
import { OpenClawConfig } from '../config/openclaw.config';
import { DatabaseService } from '../database/database.service';

export type HealthStatus = {
  status: 'ok' | 'degraded';
  service: string;
  environment: string;
  database: {
    status: 'up' | 'down';
    database: string;
    host: string;
    port: number;
    schema: string;
  };
  openclaw: {
    status: 'connected' | 'disconnected' | 'not_configured';
    url?: string;
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  async getStatus(): Promise<HealthStatus> {
    const appConfiguration = this.configService.get('app', {
      infer: true,
    });
    const dbConfiguration = this.configService.get<DatabaseConfig>(
      'database',
      {
        infer: true,
      },
    );
    const databaseStatus: HealthStatus['database']['status'] =
      await this.databaseService
        .check()
        .catch((): HealthStatus['database']['status'] => 'down');

    const openclawConfig = this.configService.get<OpenClawConfig>('openclaw', { infer: true });
    const openclawStatus = await this.checkOpenClaw(openclawConfig);

    const allUp = databaseStatus === 'up' && openclawStatus.status === 'connected';

    return {
      status: allUp ? 'ok' : 'degraded',
      service: appConfiguration?.name ?? 'hearth-api-nest',
      environment: appConfiguration?.environment ?? 'development',
      database: {
        status: databaseStatus,
        database: dbConfiguration?.name ?? 'hearth',
        host: dbConfiguration?.host ?? '127.0.0.1',
        port: dbConfiguration?.port ?? 5432,
        schema: dbConfiguration?.schema ?? 'public',
      },
      openclaw: openclawStatus,
    };
  }

  private async checkOpenClaw(
    config?: OpenClawConfig,
  ): Promise<HealthStatus['openclaw']> {
    const url = config?.baseUrl;
    if (!url || !config?.token) {
      return { status: 'not_configured' };
    }

    try {
      const res = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        return { status: 'connected', url };
      }
      return { status: 'disconnected', url };
    } catch {
      return { status: 'disconnected', url };
    }
  }
}
