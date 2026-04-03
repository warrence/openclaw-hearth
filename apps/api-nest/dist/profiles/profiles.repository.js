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
exports.ProfilesRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let ProfilesRepository = class ProfilesRepository {
    databaseService;
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async listProfiles() {
        const result = await this.databaseService.query(`
        SELECT
          id,
          name,
          slug,
          avatar,
          memory_namespace,
          default_agent_id,
          is_active,
          role,
          pin_hash,
          pin_set_at,
          last_login_at,
          requires_pin,
          created_at,
          updated_at
        FROM users
        ORDER BY name ASC, id ASC
      `);
        return result.rows.map((row) => this.toProfileRecord(this.mapRow(row)));
    }
    async findProfileById(profileId) {
        const result = await this.databaseService.query(`
        SELECT
          id,
          name,
          slug,
          avatar,
          memory_namespace,
          default_agent_id,
          is_active,
          role,
          pin_hash,
          pin_set_at,
          last_login_at,
          requires_pin,
          created_at,
          updated_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [profileId]);
        const row = result.rows[0];
        return row ? this.mapRow(row) : null;
    }
    async slugExists(slug, excludeProfileId) {
        const result = await this.databaseService.query(excludeProfileId
            ? `
            SELECT EXISTS(
              SELECT 1
              FROM users
              WHERE slug = $1
                AND id <> $2
            ) AS exists
          `
            : `
            SELECT EXISTS(
              SELECT 1
              FROM users
              WHERE slug = $1
            ) AS exists
          `, excludeProfileId ? [slug, excludeProfileId] : [slug]);
        return Boolean(result.rows[0]?.exists);
    }
    async createProfile(input) {
        const result = await this.databaseService.query(`
        INSERT INTO users (
          name,
          slug,
          avatar,
          memory_namespace,
          default_agent_id,
          is_active,
          role,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING
          id,
          name,
          slug,
          avatar,
          memory_namespace,
          default_agent_id,
          is_active,
          role,
          pin_hash,
          pin_set_at,
          last_login_at,
          requires_pin,
          created_at,
          updated_at
      `, [
            input.name,
            input.slug,
            input.avatar ?? null,
            input.memory_namespace,
            input.default_agent_id,
            input.is_active,
            input.role,
        ]);
        const row = result.rows[0];
        if (!row) {
            throw new common_1.NotFoundException();
        }
        return this.toProfileRecord(this.mapRow(row));
    }
    async updateProfile(profileId, input) {
        const entries = Object.entries(input).filter(([, value]) => value !== undefined);
        if (entries.length === 0) {
            const profile = await this.findProfileById(profileId);
            if (!profile) {
                throw new common_1.NotFoundException();
            }
            return this.toProfileRecord(profile);
        }
        const assignments = entries.map(([column], index) => `${column} = $${index + 2}`);
        const values = entries.map(([, value]) => value);
        const result = await this.databaseService.query(`
        UPDATE users
        SET ${assignments.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          name,
          slug,
          avatar,
          memory_namespace,
          default_agent_id,
          is_active,
          role,
          pin_hash,
          pin_set_at,
          last_login_at,
          requires_pin,
          created_at,
          updated_at
      `, [profileId, ...values]);
        const row = result.rows[0];
        if (!row) {
            throw new common_1.NotFoundException();
        }
        return this.toProfileRecord(this.mapRow(row));
    }
    async setPinHash(profileId, pinHash) {
        const result = await this.databaseService.query(`
        UPDATE users
        SET pin_hash = $2, pin_set_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          name,
          slug,
          avatar,
          memory_namespace,
          default_agent_id,
          is_active,
          role,
          pin_hash,
          pin_set_at,
          last_login_at,
          requires_pin,
          created_at,
          updated_at
      `, [profileId, pinHash]);
        const row = result.rows[0];
        if (!row) {
            throw new common_1.NotFoundException();
        }
        return this.toProfileRecord(this.mapRow(row));
    }
    async resetPin(profileId) {
        const result = await this.databaseService.query(`
        UPDATE users
        SET pin_hash = NULL, pin_set_at = NULL, updated_at = NOW()
        WHERE id = $1
      `, [profileId]);
        if ((result.rowCount ?? 0) === 0) {
            throw new common_1.NotFoundException();
        }
    }
    mapRow(row) {
        return {
            id: Number.parseInt(String(row.id), 10),
            name: row.name,
            slug: row.slug,
            avatar: row.avatar,
            memory_namespace: row.memory_namespace,
            default_agent_id: row.default_agent_id,
            is_active: row.is_active,
            role: row.role,
            pin_hash: row.pin_hash,
            pin_set_at: this.toIsoString(row.pin_set_at),
            last_login_at: this.toIsoString(row.last_login_at),
            requires_pin: row.requires_pin,
            created_at: this.toIsoString(row.created_at) ?? new Date().toISOString(),
            updated_at: this.toIsoString(row.updated_at) ?? new Date().toISOString(),
            has_pin: row.pin_hash !== null,
        };
    }
    async listProfileConversations(profileId) {
        const result = await this.databaseService.query('SELECT id, openclaw_session_key FROM conversations WHERE user_id = $1', [profileId]);
        return result.rows;
    }
    async deleteProfile(profileId) {
        await this.databaseService.query(`DELETE FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE user_id = $1
      )`, [profileId]);
        await this.databaseService.query('DELETE FROM conversations WHERE user_id = $1', [profileId]);
        await this.databaseService.query('DELETE FROM users WHERE id = $1', [profileId]);
    }
    toProfileRecord(profile) {
        const { pin_hash: _pinHash, ...safeProfile } = profile;
        return safeProfile;
    }
    toIsoString(value) {
        if (!value) {
            return null;
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toISOString();
    }
};
exports.ProfilesRepository = ProfilesRepository;
exports.ProfilesRepository = ProfilesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ProfilesRepository);
