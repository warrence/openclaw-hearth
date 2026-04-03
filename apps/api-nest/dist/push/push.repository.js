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
exports.PushRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let PushRepository = class PushRepository {
    databaseService;
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async saveSubscription(params) {
        const result = await this.databaseService.query(`
        INSERT INTO push_subscriptions (
          user_id,
          endpoint,
          public_key,
          auth_token,
          content_encoding,
          user_agent,
          last_used_at,
          presence_seen_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), NOW())
        ON CONFLICT (endpoint)
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          public_key = EXCLUDED.public_key,
          auth_token = EXCLUDED.auth_token,
          content_encoding = EXCLUDED.content_encoding,
          user_agent = EXCLUDED.user_agent,
          last_used_at = NOW(),
          presence_seen_at = NOW(),
          updated_at = NOW()
        RETURNING
          id,
          user_id,
          endpoint,
          current_conversation_id,
          public_key,
          auth_token,
          content_encoding,
          is_visible,
          user_agent,
          last_used_at,
          presence_seen_at,
          created_at,
          updated_at
      `, [
            params.userId,
            params.endpoint,
            params.publicKey,
            params.authToken,
            params.contentEncoding,
            params.userAgent,
        ]);
        return this.mapRow(result.rows[0]);
    }
    async updatePresenceExact(params) {
        const result = await this.databaseService.query(`
        UPDATE push_subscriptions
        SET
          current_conversation_id = $3,
          is_visible = $4,
          presence_seen_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
          AND endpoint = $2
        RETURNING
          id,
          user_id,
          endpoint,
          current_conversation_id,
          public_key,
          auth_token,
          content_encoding,
          is_visible,
          user_agent,
          last_used_at,
          presence_seen_at,
          created_at,
          updated_at
      `, [params.userId, params.endpoint, params.conversationId, params.isVisible]);
        const row = result.rows[0];
        return row ? this.mapRow(row) : null;
    }
    async findLatestSubscriptionForUser(userId) {
        const result = await this.databaseService.query(`
        SELECT
          id,
          user_id,
          endpoint,
          current_conversation_id,
          public_key,
          auth_token,
          content_encoding,
          is_visible,
          user_agent,
          last_used_at,
          presence_seen_at,
          created_at,
          updated_at
        FROM push_subscriptions
        WHERE user_id = $1
        ORDER BY last_used_at DESC, id DESC
        LIMIT 1
      `, [userId]);
        const row = result.rows[0];
        return row ? this.mapRow(row) : null;
    }
    async updatePresenceById(params) {
        const result = await this.databaseService.query(`
        UPDATE push_subscriptions
        SET
          current_conversation_id = $2,
          is_visible = $3,
          presence_seen_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          user_id,
          endpoint,
          current_conversation_id,
          public_key,
          auth_token,
          content_encoding,
          is_visible,
          user_agent,
          last_used_at,
          presence_seen_at,
          created_at,
          updated_at
      `, [params.id, params.conversationId, params.isVisible]);
        return this.mapRow(result.rows[0]);
    }
    async findAllSubscriptionsForUser(userId) {
        const result = await this.databaseService.query(`
        SELECT
          id,
          user_id,
          endpoint,
          current_conversation_id,
          public_key,
          auth_token,
          content_encoding,
          is_visible,
          user_agent,
          last_used_at,
          presence_seen_at,
          created_at,
          updated_at
        FROM push_subscriptions
        WHERE user_id = $1
      `, [userId]);
        return result.rows.map((row) => this.mapRow(row));
    }
    async deleteSubscription(userId, endpoint) {
        await this.databaseService.query(`
        DELETE FROM push_subscriptions
        WHERE user_id = $1
          AND endpoint = $2
      `, [userId, endpoint]);
    }
    mapRow(row) {
        return {
            id: Number(row.id),
            user_id: Number(row.user_id),
            endpoint: row.endpoint,
            current_conversation_id: row.current_conversation_id === null
                ? null
                : Number(row.current_conversation_id),
            public_key: row.public_key,
            auth_token: row.auth_token,
            content_encoding: row.content_encoding,
            is_visible: Boolean(row.is_visible),
            user_agent: row.user_agent,
            last_used_at: this.toIsoString(row.last_used_at),
            presence_seen_at: this.toIsoString(row.presence_seen_at),
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
exports.PushRepository = PushRepository;
exports.PushRepository = PushRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], PushRepository);
