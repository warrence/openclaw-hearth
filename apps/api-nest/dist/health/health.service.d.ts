import { ConfigService } from '@nestjs/config';
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
        status: 'connected' | 'disconnected' | 'not_configured' | 'no_model';
        url?: string;
    };
};
export declare class HealthService {
    private readonly databaseService;
    private readonly configService;
    constructor(databaseService: DatabaseService, configService: ConfigService);
    getStatus(): Promise<HealthStatus>;
    private checkOpenClaw;
}
