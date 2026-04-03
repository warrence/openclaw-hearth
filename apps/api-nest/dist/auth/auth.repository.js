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
exports.AuthRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let AuthRepository = class AuthRepository {
    databaseService;
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async listActiveUsers() {
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
        WHERE is_active = TRUE
        ORDER BY id ASC
      `);
        return result.rows.map((row) => this.toAuthenticatedUser(this.mapUserRow(row)));
    }
    async findUserForAuth(userId) {
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
      `, [userId]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return this.mapUserRow(row);
    }
    async updateLastLoginAt(userId) {
        await this.databaseService.query(`
        UPDATE users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [userId]);
    }
    mapUserRow(row) {
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
    toAuthenticatedUser(user) {
        const { pin_hash: _pinHash, ...authenticatedUser } = user;
        return authenticatedUser;
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
exports.AuthRepository = AuthRepository;
exports.AuthRepository = AuthRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AuthRepository);
