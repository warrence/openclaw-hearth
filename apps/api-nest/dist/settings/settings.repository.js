"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let SettingsRepository = class SettingsRepository {
    databaseService;
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getOrCreateModelPresetSettings(defaults) {
        const existing = await this.databaseService.query(`
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
      `);
        const row = existing.rows[0];
        if (row) {
            return this.mapModelPresetSettingsRow(row, defaults);
        }
        const inserted = await this.databaseService.query(`
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
      `, [defaults.fastModel, defaults.deepModel]);
        return this.mapModelPresetSettingsRow(inserted.rows[0], defaults);
    }
    async updateModelPresetSettings(recordId, updates, defaults) {
        const result = await this.databaseService.query(`
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
      `, [
            recordId,
            updates.fast_model_id,
            updates.fast_think_level,
            updates.fast_reasoning_enabled,
            updates.deep_model_id,
            updates.deep_think_level,
            updates.deep_reasoning_enabled,
        ]);
        return this.mapModelPresetSettingsRow(result.rows[0], defaults);
    }
    async findDefaultGatewayConnection() {
        const result = await this.databaseService.query(`
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
      `);
        const row = result.rows[0];
        return row ? this.mapGatewayConnectionRow(row) : null;
    }
    async updateGatewayStatus(recordId, status, lastCheckedAt, lastError) {
        await this.databaseService.query(`
        UPDATE gateway_connections
        SET status = $2, last_checked_at = $3, last_error = $4, updated_at = NOW()
        WHERE id = $1
      `, [recordId, status, lastCheckedAt, lastError]);
    }
    async clearDefaultGatewayConnections() {
        await this.databaseService.query(`
        UPDATE gateway_connections
        SET is_default = FALSE, updated_at = NOW()
      `);
    }
    async createGatewayConnection(params) {
        const result = await this.databaseService.query(`
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
      `, [params.name, params.baseUrl, params.authTokenEncrypted]);
        return this.mapGatewayConnectionRow(result.rows[0]);
    }
    mapModelPresetSettingsRow(row, defaults) {
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
    mapGatewayConnectionRow(row) {
        return {
            id: Number(row.id),
            name: row.name,
            base_url: row.base_url,
            auth_token_encrypted: row.auth_token_encrypted,
            status: row.status,
            last_checked_at: this.toIsoString(row.last_checked_at),
            last_error: row.last_error,
            is_default: Boolean(row.is_default),
            created_at: this.toIsoString(row.created_at),
            updated_at: this.toIsoString(row.updated_at),
        };
    }
    toIsoString(value) {
        if (!value) {
            return null;
        }
        return new Date(value).toISOString();
    }
};
exports.SettingsRepository = SettingsRepository;
exports.SettingsRepository = SettingsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], SettingsRepository);
