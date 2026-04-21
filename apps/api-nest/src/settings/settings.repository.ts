import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

type GatewayConnectionRow = {
  id: number | string;
  name: string;
  base_url: string;
  auth_token_encrypted: string | null;
  status: string | null;
  last_checked_at: Date | string | null;
  last_error: string | null;
  is_default: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type GatewayConnectionRecord = {
  id: number;
  name: string;
  base_url: string;
  auth_token_encrypted: string | null;
  status: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class SettingsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findDefaultGatewayConnection(): Promise<GatewayConnectionRecord | null> {
    const result = await this.databaseService.query<GatewayConnectionRow>(
      `
        SELECT
          id,
          name,
          base_url,
          auth_token_encrypted,
          status,
          last_checked_at,
          last_error,
          is_default,
          created_at,
          updated_at
        FROM gateway_connections
        WHERE is_default = TRUE
        ORDER BY id DESC
        LIMIT 1
      `,
    );

    const row = result.rows[0];
    return row ? this.mapGatewayConnectionRow(row) : null;
  }

  async updateGatewayStatus(
    recordId: number,
    status: string,
    lastCheckedAt: string,
    lastError: string | null,
  ): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE gateway_connections
        SET status = $2, last_checked_at = $3, last_error = $4, updated_at = NOW()
        WHERE id = $1
      `,
      [recordId, status, lastCheckedAt, lastError],
    );
  }

  async clearDefaultGatewayConnections(): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE gateway_connections
        SET is_default = FALSE, updated_at = NOW()
      `,
    );
  }

  async createGatewayConnection(params: {
    name: string;
    baseUrl: string;
    authTokenEncrypted: string;
  }): Promise<GatewayConnectionRecord> {
    const result = await this.databaseService.query<GatewayConnectionRow>(
      `
        INSERT INTO gateway_connections (
          name,
          base_url,
          auth_token_encrypted,
          status,
          is_default,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'unknown', TRUE, NOW(), NOW())
        RETURNING
          id,
          name,
          base_url,
          auth_token_encrypted,
          status,
          last_checked_at,
          last_error,
          is_default,
          created_at,
          updated_at
      `,
      [params.name, params.baseUrl, params.authTokenEncrypted],
    );

    return this.mapGatewayConnectionRow(result.rows[0]!);
  }

  private mapGatewayConnectionRow(
    row: GatewayConnectionRow,
  ): GatewayConnectionRecord {
    return {
      id: Number(row.id),
      name: row.name,
      base_url: row.base_url,
      auth_token_encrypted: row.auth_token_encrypted,
      status: row.status,
      last_checked_at: this.toIsoString(row.last_checked_at),
      last_error: row.last_error,
      is_default: Boolean(row.is_default),
      created_at: this.toIsoString(row.created_at)!,
      updated_at: this.toIsoString(row.updated_at)!,
    };
  }

  private toIsoString(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    return new Date(value).toISOString();
  }
}
