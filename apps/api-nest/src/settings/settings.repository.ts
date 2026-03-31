import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

type ModelPresetSettingsRow = {
  id: number | string;
  fast_model_id: string | null;
  fast_think_level: string | null;
  fast_reasoning_enabled: boolean | null;
  deep_model_id: string | null;
  deep_think_level: string | null;
  deep_reasoning_enabled: boolean | null;
  created_at: Date | string;
  updated_at: Date | string | null;
};

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

export type ModelPresetSettingsRecord = {
  id: number;
  fast_model_id: string;
  fast_think_level: string | null;
  fast_reasoning_enabled: boolean | null;
  deep_model_id: string;
  deep_think_level: string | null;
  deep_reasoning_enabled: boolean | null;
  updated_at: string | null;
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

  async getOrCreateModelPresetSettings(
    defaults: { fastModel: string; deepModel: string },
  ): Promise<ModelPresetSettingsRecord> {
    const existing = await this.databaseService.query<ModelPresetSettingsRow>(
      `
        SELECT
          id,
          fast_model_id,
          fast_think_level,
          fast_reasoning_enabled,
          deep_model_id,
          deep_think_level,
          deep_reasoning_enabled,
          created_at,
          updated_at
        FROM model_preset_settings
        ORDER BY id ASC
        LIMIT 1
      `,
    );

    const row = existing.rows[0];
    if (row) {
      return this.mapModelPresetSettingsRow(row, defaults);
    }

    const inserted = await this.databaseService.query<ModelPresetSettingsRow>(
      `
        INSERT INTO model_preset_settings (
          fast_model_id,
          deep_model_id,
          created_at,
          updated_at
        )
        VALUES ($1, $2, NOW(), NOW())
        RETURNING
          id,
          fast_model_id,
          fast_think_level,
          fast_reasoning_enabled,
          deep_model_id,
          deep_think_level,
          deep_reasoning_enabled,
          created_at,
          updated_at
      `,
      [defaults.fastModel, defaults.deepModel],
    );

    return this.mapModelPresetSettingsRow(inserted.rows[0]!, defaults);
  }

  async updateModelPresetSettings(
    recordId: number,
    updates: Pick<
      ModelPresetSettingsRecord,
      | 'fast_model_id'
      | 'fast_think_level'
      | 'fast_reasoning_enabled'
      | 'deep_model_id'
      | 'deep_think_level'
      | 'deep_reasoning_enabled'
    >,
    defaults: { fastModel: string; deepModel: string },
  ): Promise<ModelPresetSettingsRecord> {
    const result = await this.databaseService.query<ModelPresetSettingsRow>(
      `
        UPDATE model_preset_settings
        SET
          fast_model_id = $2,
          fast_think_level = $3,
          fast_reasoning_enabled = $4,
          deep_model_id = $5,
          deep_think_level = $6,
          deep_reasoning_enabled = $7,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          fast_model_id,
          fast_think_level,
          fast_reasoning_enabled,
          deep_model_id,
          deep_think_level,
          deep_reasoning_enabled,
          created_at,
          updated_at
      `,
      [
        recordId,
        updates.fast_model_id,
        updates.fast_think_level,
        updates.fast_reasoning_enabled,
        updates.deep_model_id,
        updates.deep_think_level,
        updates.deep_reasoning_enabled,
      ],
    );

    return this.mapModelPresetSettingsRow(result.rows[0]!, defaults);
  }

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

  private mapModelPresetSettingsRow(
    row: ModelPresetSettingsRow,
    defaults: { fastModel: string; deepModel: string },
  ): ModelPresetSettingsRecord {
    return {
      id: Number(row.id),
      fast_model_id: row.fast_model_id ?? defaults.fastModel,
      fast_think_level: row.fast_think_level,
      fast_reasoning_enabled: row.fast_reasoning_enabled,
      deep_model_id: row.deep_model_id ?? defaults.deepModel,
      deep_think_level: row.deep_think_level,
      deep_reasoning_enabled: row.deep_reasoning_enabled,
      updated_at: this.toIsoString(row.updated_at),
    };
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
