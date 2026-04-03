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
exports.ConversationsRepository = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const database_service_1 = require("../database/database.service");
let ConversationsRepository = class ConversationsRepository {
    databaseService;
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async findUserBySlug(slug) {
        const result = await this.databaseService.query(`SELECT id, name, slug FROM users WHERE LOWER(slug) = LOWER($1) LIMIT 1`, [slug]);
        return result.rows[0] ?? null;
    }
    async listAllUsers() {
        const result = await this.databaseService.query(`SELECT id, name, slug FROM users WHERE slug IS NOT NULL ORDER BY id`);
        return result.rows;
    }
    async listUserConversations(params) {
        const values = [params.userId];
        let whereClause = 'WHERE c.user_id = $1';
        if (params.scope === 'active') {
            values.push('archived');
            whereClause += ` AND c.status != $${values.length}`;
        }
        else if (params.scope === 'archived') {
            values.push('archived');
            whereClause += ` AND c.status = $${values.length}`;
        }
        const trimmedSearch = params.search?.trim() ?? '';
        const hasSearch = trimmedSearch !== '';
        if (!hasSearch) {
            const result = await this.databaseService.query(`
          SELECT
            c.id,
            c.user_id,
            c.title,
            c.agent_id,
            c.mode,
            c.model_preset,
            c.openclaw_session_key,
            c.status,
            c.archived_at,
            c.last_message_at,
            c.created_at,
            c.updated_at,
            COUNT(m.id)::int AS messages_count
          FROM conversations c
          LEFT JOIN messages m ON m.conversation_id = c.id
          ${whereClause}
          GROUP BY c.id
          ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC
        `, values);
            return result.rows.map((row) => this.mapConversationRow(row));
        }
        values.push(`%${trimmedSearch}%`);
        const searchPlaceholder = `$${values.length}`;
        values.push(params.limit ?? 40);
        const limitPlaceholder = `$${values.length}`;
        const result = await this.databaseService.query(`
        SELECT
          c.id,
          c.user_id,
          c.title,
          c.agent_id,
          c.mode,
          c.model_preset,
          c.openclaw_session_key,
          c.status,
          c.archived_at,
          c.last_message_at,
          c.created_at,
          c.updated_at,
          COUNT(m.id)::int AS messages_count,
          ARRAY_REMOVE(
            ARRAY[
              CASE WHEN c.title ILIKE ${searchPlaceholder} THEN 'title' END,
              CASE WHEN matched_message.id IS NOT NULL THEN 'message' END
            ],
            NULL
          ) AS search_matched_fields,
          COALESCE(
            matched_message.preview,
            c.title
          ) AS search_preview,
          matched_message.id AS search_message_id,
          matched_message.created_at AS search_message_created_at
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        LEFT JOIN LATERAL (
          SELECT
            inner_m.id,
            inner_m.created_at,
            inner_m.content,
            CASE
              WHEN POSITION(LOWER(${searchPlaceholder}) IN LOWER(REGEXP_REPLACE(inner_m.content, '\\s+', ' ', 'g'))) = 0
                THEN LEFT(REGEXP_REPLACE(inner_m.content, '\\s+', ' ', 'g'), 120)
              ELSE (
                CASE
                  WHEN GREATEST(POSITION(LOWER(${searchPlaceholder}) IN LOWER(REGEXP_REPLACE(inner_m.content, '\\s+', ' ', 'g'))) - 36, 1) > 1
                    THEN '…'
                  ELSE ''
                END
              ) || SUBSTRING(
                REGEXP_REPLACE(inner_m.content, '\\s+', ' ', 'g')
                FROM GREATEST(POSITION(LOWER(${searchPlaceholder}) IN LOWER(REGEXP_REPLACE(inner_m.content, '\\s+', ' ', 'g'))) - 36, 1)
                FOR 120
              ) || (
                CASE
                  WHEN LENGTH(REGEXP_REPLACE(inner_m.content, '\\s+', ' ', 'g')) >
                    GREATEST(POSITION(LOWER(${searchPlaceholder}) IN LOWER(REGEXP_REPLACE(inner_m.content, '\\s+', ' ', 'g'))) - 36, 1) + 119
                    THEN '…'
                  ELSE ''
                END
              ) AS preview
          FROM messages inner_m
          WHERE inner_m.conversation_id = c.id
            AND inner_m.content ILIKE ${searchPlaceholder}
          ORDER BY inner_m.id DESC
          LIMIT 1
        ) matched_message ON TRUE
        ${whereClause}
          AND (
            c.title ILIKE ${searchPlaceholder}
            OR EXISTS (
              SELECT 1
              FROM messages search_m
              WHERE search_m.conversation_id = c.id
                AND search_m.content ILIKE ${searchPlaceholder}
            )
          )
        GROUP BY c.id, matched_message.id, matched_message.created_at, matched_message.preview
        ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC
        LIMIT ${limitPlaceholder}
      `, values);
        return result.rows.map((row) => this.mapConversationRow(row, true));
    }
    async createConversation(params) {
        const userResult = await this.databaseService.query(`
        SELECT id, slug, default_agent_id
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [params.userId]);
        const user = userResult.rows[0];
        if (!user) {
            throw new common_1.NotFoundException();
        }
        const sessionKey = this.buildAppSessionKey(user.slug, (0, node_crypto_1.randomUUID)());
        const result = await this.databaseService.query(`
        INSERT INTO conversations (
          user_id,
          title,
          agent_id,
          model_preset,
          openclaw_session_key,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING
          id,
          user_id,
          title,
          agent_id,
          mode,
          model_preset,
          openclaw_session_key,
          status,
          archived_at,
          last_message_at,
          created_at,
          updated_at
      `, [
            params.userId,
            params.title,
            params.agentId ?? user.default_agent_id ?? 'main',
            params.modelPreset ?? 'fast',
            sessionKey,
        ]);
        return this.mapConversationRow(result.rows[0]);
    }
    async findConversationById(conversationId) {
        const result = await this.databaseService.query(`
        SELECT
          c.id,
          c.user_id,
          c.title,
          c.agent_id,
          c.mode,
          c.model_preset,
          c.openclaw_session_key,
          c.status,
          c.archived_at,
          c.last_message_at,
          c.created_at,
          c.updated_at,
          u.name AS user_name,
          u.slug AS user_slug,
          u.avatar AS user_avatar,
          u.memory_namespace AS user_memory_namespace,
          u.default_agent_id AS user_default_agent_id,
          u.is_active AS user_is_active,
          u.role AS user_role,
          u.pin_set_at AS user_pin_set_at,
          u.last_login_at AS user_last_login_at,
          u.requires_pin AS user_requires_pin,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at,
          (u.pin_hash IS NOT NULL) AS user_has_pin
        FROM conversations c
        INNER JOIN users u ON u.id = c.user_id
        WHERE c.id = $1
        LIMIT 1
      `, [conversationId]);
        const row = result.rows[0];
        return row ? this.mapConversationDetailRow(row) : null;
    }
    async updateConversation(conversationId, params) {
        const assignments = [];
        const values = [];
        if (params.title !== undefined) {
            values.push(params.title);
            assignments.push(`title = $${values.length}`);
        }
        if (params.agentId !== undefined) {
            values.push(params.agentId);
            assignments.push(`agent_id = $${values.length}`);
        }
        if (params.modelPreset !== undefined) {
            values.push(params.modelPreset);
            assignments.push(`model_preset = $${values.length}`);
        }
        if (params.status !== undefined) {
            values.push(params.status);
            assignments.push(`status = $${values.length}`);
            assignments.push(`archived_at = ${params.status === 'archived' ? 'CURRENT_TIMESTAMP' : 'NULL'}`);
        }
        assignments.push('updated_at = CURRENT_TIMESTAMP');
        values.push(conversationId);
        const result = await this.databaseService.query(`
        UPDATE conversations
        SET ${assignments.join(', ')}
        WHERE id = $${values.length}
        RETURNING
          id,
          user_id,
          title,
          agent_id,
          mode,
          model_preset,
          openclaw_session_key,
          status,
          archived_at,
          last_message_at,
          created_at,
          updated_at
      `, values);
        return this.mapConversationRow(result.rows[0]);
    }
    async findConversationBySessionKey(sessionKey) {
        const result = await this.databaseService.query(`
        SELECT
          id,
          user_id,
          title,
          agent_id,
          mode,
          model_preset,
          openclaw_session_key,
          status,
          archived_at,
          last_message_at,
          created_at,
          updated_at
        FROM conversations
        WHERE openclaw_session_key = $1
        LIMIT 1
      `, [sessionKey]);
        const row = result.rows[0];
        return row ? this.mapConversationRow(row) : null;
    }
    async findLatestActiveConversationByUserSlug(slug) {
        const result = await this.databaseService.query(`
        SELECT
          c.id,
          c.user_id,
          c.title,
          c.agent_id,
          c.mode,
          c.model_preset,
          c.openclaw_session_key,
          c.status,
          c.archived_at,
          c.last_message_at,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN users u ON u.id = c.user_id
        WHERE u.slug = $1
          AND c.status != 'archived'
        ORDER BY c.last_message_at DESC NULLS LAST, c.id DESC
        LIMIT 1
      `, [slug]);
        const row = result.rows[0];
        return row ? this.mapConversationRow(row) : null;
    }
    async deleteConversation(conversationId) {
        await this.databaseService.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);
        await this.databaseService.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
    }
    async listConversationMessages(conversationId) {
        const result = await this.databaseService.query(`
        SELECT
          id,
          conversation_id,
          role,
          content,
          model,
          metadata_json,
          source,
          channel,
          contract_event,
          channel_message_id,
          person_identity,
          agent_id,
          reply_to_message_id,
          sent_at,
          contract_json,
          created_at,
          updated_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY id ASC
      `, [conversationId]);
        return result.rows.map((row) => this.mapMessageRow(row));
    }
    async findLastImageAttachment(conversationId) {
        const result = await this.databaseService.query(`
        SELECT metadata_json
        FROM messages
        WHERE conversation_id = $1
          AND metadata_json IS NOT NULL
        ORDER BY id DESC
        LIMIT 20
      `, [conversationId]);
        for (const row of result.rows) {
            const attachments = row.metadata_json?.attachments;
            if (!Array.isArray(attachments))
                continue;
            const img = attachments.find((a) => a?.category === 'image' && (a?.path || a?.url));
            if (img)
                return img;
        }
        return null;
    }
    async createUserMessage(params) {
        const messageResult = await this.databaseService.query(`
        INSERT INTO messages (
          conversation_id,
          role,
          content,
          metadata_json,
          source,
          created_at,
          updated_at
        )
        VALUES ($1, 'user', $2, $3, 'app', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING
          id,
          conversation_id,
          role,
          content,
          model,
          metadata_json,
          source,
          channel,
          contract_event,
          channel_message_id,
          person_identity,
          agent_id,
          reply_to_message_id,
          sent_at,
          contract_json,
          created_at,
          updated_at
      `, [
            params.conversationId,
            params.content,
            params.attachments && params.attachments.length > 0
                ? { attachments: params.attachments }
                : null,
        ]);
        const userMessage = this.mapMessageRow(messageResult.rows[0]);
        const conversationResult = await this.databaseService.query(`
        UPDATE conversations
        SET
          last_message_at = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          user_id,
          title,
          agent_id,
          mode,
          model_preset,
          openclaw_session_key,
          status,
          archived_at,
          last_message_at,
          created_at,
          updated_at
      `, [params.conversationId, userMessage.created_at]);
        return {
            userMessage,
            conversation: this.mapConversationRow(conversationResult.rows[0]),
        };
    }
    async createAssistantMessage(params) {
        const messageResult = await this.databaseService.query(`
        INSERT INTO messages (
          conversation_id,
          role,
          content,
          model,
          metadata_json,
          source,
          channel,
          contract_event,
          channel_message_id,
          person_identity,
          agent_id,
          reply_to_message_id,
          sent_at,
          contract_json,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          'assistant',
          $2,
          $3,
          $4,
          'openclaw',
          'app',
          'message.outbound',
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING
          id,
          conversation_id,
          role,
          content,
          model,
          metadata_json,
          source,
          channel,
          contract_event,
          channel_message_id,
          person_identity,
          agent_id,
          reply_to_message_id,
          sent_at,
          contract_json,
          created_at,
          updated_at
      `, [
            params.conversationId,
            params.content,
            params.model ?? null,
            params.metadata ?? null,
            params.messageId,
            params.personIdentity ?? null,
            params.agentId ?? null,
            params.replyToMessageId ?? null,
            params.sentAt ?? null,
            params.contractJson ?? null,
        ]);
        const assistantMessage = this.mapMessageRow(messageResult.rows[0]);
        const conversationResult = await this.databaseService.query(`
        UPDATE conversations
        SET
          last_message_at = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          user_id,
          title,
          agent_id,
          mode,
          model_preset,
          openclaw_session_key,
          status,
          archived_at,
          last_message_at,
          created_at,
          updated_at
      `, [params.conversationId, assistantMessage.created_at]);
        return {
            assistantMessage,
            conversation: this.mapConversationRow(conversationResult.rows[0]),
        };
    }
    mapConversationRow(row, includeSearchMatch = false) {
        return {
            id: this.toNumber(row.id),
            user_id: this.toNumber(row.user_id),
            title: row.title,
            agent_id: row.agent_id,
            mode: row.mode,
            model_preset: row.model_preset,
            openclaw_session_key: row.openclaw_session_key,
            status: row.status,
            archived_at: this.toIsoString(row.archived_at),
            last_message_at: this.toIsoString(row.last_message_at),
            created_at: this.toRequiredIsoString(row.created_at),
            updated_at: this.toRequiredIsoString(row.updated_at),
            messages_count: row.messages_count === undefined
                ? undefined
                : Number.parseInt(String(row.messages_count), 10),
            ...(includeSearchMatch
                ? {
                    search_match: {
                        matched_fields: row.search_matched_fields ?? [],
                        preview: row.search_preview ?? row.title,
                        message_id: row.search_message_id === null || row.search_message_id === undefined
                            ? null
                            : this.toNumber(row.search_message_id),
                        message_created_at: this.toIsoString(row.search_message_created_at ?? null),
                    },
                }
                : {}),
        };
    }
    mapConversationDetailRow(row) {
        return {
            ...this.mapConversationRow(row),
            user: {
                id: this.toNumber(row.user_id),
                name: row.user_name,
                slug: row.user_slug,
                avatar: row.user_avatar,
                memory_namespace: row.user_memory_namespace,
                default_agent_id: row.user_default_agent_id,
                is_active: row.user_is_active,
                role: row.user_role,
                pin_set_at: this.toIsoString(row.user_pin_set_at),
                last_login_at: this.toIsoString(row.user_last_login_at),
                requires_pin: row.user_requires_pin,
                created_at: this.toRequiredIsoString(row.user_created_at),
                updated_at: this.toRequiredIsoString(row.user_updated_at),
                has_pin: row.user_has_pin,
            },
        };
    }
    mapMessageRow(row) {
        return {
            id: this.toNumber(row.id),
            conversation_id: this.toNumber(row.conversation_id),
            role: row.role,
            content: row.content,
            model: row.model,
            metadata_json: row.metadata_json,
            source: row.source,
            channel: row.channel,
            contract_event: row.contract_event,
            channel_message_id: row.channel_message_id,
            person_identity: row.person_identity,
            agent_id: row.agent_id,
            reply_to_message_id: row.reply_to_message_id,
            sent_at: this.toIsoString(row.sent_at),
            contract_json: row.contract_json,
            created_at: this.toRequiredIsoString(row.created_at),
            updated_at: this.toRequiredIsoString(row.updated_at),
        };
    }
    buildAppSessionKey(userSlug, conversationKey) {
        return `app:${userSlug.trim().toLowerCase()}:conv:${conversationKey.trim().toLowerCase()}`;
    }
    toNumber(value) {
        return Number.parseInt(String(value), 10);
    }
    toIsoString(value) {
        if (value === null) {
            return null;
        }
        return this.formatLaravelTimestamp(value);
    }
    toRequiredIsoString(value) {
        return this.formatLaravelTimestamp(value);
    }
    formatLaravelTimestamp(value) {
        const date = value instanceof Date ? value : new Date(value);
        const pad = (part, length = 2) => String(part).padStart(length, '0');
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}000Z`;
    }
};
exports.ConversationsRepository = ConversationsRepository;
exports.ConversationsRepository = ConversationsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ConversationsRepository);
