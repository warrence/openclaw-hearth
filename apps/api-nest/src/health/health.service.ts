import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { appConfig } from '../config/app.config';
import { databaseConfig, DatabaseConfig } from '../config/database.config';
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

    return {
      status: databaseStatus === 'up' ? 'ok' : 'degraded',
      service: appConfiguration?.name ?? 'hearth-api-nest',
      environment: appConfiguration?.environment ?? 'development',
      database: {
        status: databaseStatus,
        database: dbConfiguration?.name ?? 'hearth',
        host: dbConfiguration?.host ?? '127.0.0.1',
        port: dbConfiguration?.port ?? 5432,
        schema: dbConfiguration?.schema ?? 'public',
      },
    };
  }
}
