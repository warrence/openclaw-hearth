import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolConfig, QueryResult, QueryResultRow } from 'pg';
export declare class DatabaseService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private pool?;
    constructor(configService: ConfigService);
    getConnectionOptions(): PoolConfig;
    private getPool;
    onModuleInit(): Promise<void>;
    check(): Promise<'up' | 'down'>;
    query<T extends QueryResultRow>(text: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
    onModuleDestroy(): Promise<void>;
}
