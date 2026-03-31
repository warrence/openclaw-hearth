import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

import { databaseConfig, DatabaseConfig } from '../config/database.config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool?: Pool;

  constructor(private readonly configService: ConfigService) {}

  getConnectionOptions(): PoolConfig {
    const config = this.configService.get<DatabaseConfig>('database', {
      infer: true,
    });

    if (!config) {
      throw new Error('Database configuration is missing.');
    }

    return {
      connectionString: config.url,
      host: config.url ? undefined : config.host,
      port: config.url ? undefined : config.port,
      user: config.url ? undefined : config.user,
      password: config.url ? undefined : config.password,
      database: config.url ? undefined : config.name,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 10000,
    };
  }

  private getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool(this.getConnectionOptions());
    }

    return this.pool;
  }

  async onModuleInit(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        counter BIGINT NOT NULL DEFAULT 0,
        device_type TEXT,
        backed_up BOOLEAN DEFAULT FALSE,
        transports TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.query(`
      CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id
        ON webauthn_credentials(user_id)
    `);
  }

  async check(): Promise<'up' | 'down'> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('SELECT 1');
      return 'up';
    } finally {
      client.release();
    }
  }

  async query<T extends QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.getPool().query<T>(text, [...params]);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
