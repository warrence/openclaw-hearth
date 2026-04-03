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
exports.RemindersRepository = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let RemindersRepository = class RemindersRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async onModuleInit() {
        await this.db.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        message_text TEXT NOT NULL,
        fire_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        source_message_id TEXT,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fired_at TIMESTAMPTZ
      )
    `);
        await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_reminders_fire_at_status
        ON reminders(fire_at, status)
    `);
    }
    async createReminder(params) {
        const result = await this.db.query(`INSERT INTO reminders (user_id, conversation_id, message_text, fire_at, source_message_id, critical)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [
            params.userId,
            params.conversationId,
            params.messageText,
            params.fireAt,
            params.sourceMessageId ?? null,
            params.critical ?? false,
        ]);
        const row = result.rows[0];
        if (!row)
            throw new Error('Failed to insert reminder');
        return row;
    }
    async findDueReminders() {
        const result = await this.db.query(`SELECT * FROM reminders WHERE fire_at <= NOW() AND status = 'pending' ORDER BY fire_at ASC`);
        return result.rows;
    }
    async markFired(id) {
        await this.db.query(`UPDATE reminders SET status = 'fired', fired_at = NOW() WHERE id = $1`, [id]);
    }
    async markFailed(id, error) {
        await this.db.query(`UPDATE reminders SET status = 'failed', error = $2 WHERE id = $1`, [id, error]);
    }
    async findUnacknowledgedCritical() {
        const result = await this.db.query(`SELECT * FROM reminders 
       WHERE critical = true AND status = 'fired' AND acknowledged_at IS NULL
       ORDER BY fired_at ASC`);
        return result.rows;
    }
    async incrementRepeatCount(id) {
        await this.db.query(`UPDATE reminders SET repeat_count = repeat_count + 1, fired_at = NOW() WHERE id = $1`, [id]);
    }
    async markAcknowledged(id) {
        await this.db.query(`UPDATE reminders SET acknowledged_at = NOW(), status = 'acknowledged' WHERE id = $1`, [id]);
    }
    async listReminders(params) {
        const conditions = [];
        const values = [];
        let idx = 1;
        if (params.userId) {
            conditions.push(`user_id = $${idx++}`);
            values.push(params.userId);
        }
        if (params.status) {
            conditions.push(`status = $${idx++}`);
            values.push(params.status);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await this.db.query(`SELECT id, user_id, conversation_id, message_text, fire_at, status, critical, repeat_count, fired_at, acknowledged_at, created_at
       FROM reminders ${where}
       ORDER BY fire_at ASC`, values);
        return result.rows.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            conversation_id: r.conversation_id,
            message_text: r.message_text,
            fire_at: r.fire_at,
            status: r.status,
            source_message_id: null,
            error: null,
            created_at: r.created_at,
            fired_at: r.fired_at,
            critical: r.critical,
            repeat_count: r.repeat_count,
            acknowledged_at: r.acknowledged_at,
        }));
    }
    async cancelReminder(id, userId) {
        const conditions = ['id = $1', "status = 'pending'"];
        const values = [id];
        if (userId) {
            conditions.push('user_id = $2');
            values.push(userId);
        }
        const result = await this.db.query(`UPDATE reminders SET status = 'cancelled', updated_at = NOW() WHERE ${conditions.join(' AND ')}`, values);
        return (result.rowCount ?? 0) > 0;
    }
    async hasUserRepliedSince(conversationId, sinceDate) {
        const since = sinceDate instanceof Date ? sinceDate.toISOString() : String(sinceDate);
        const result = await this.db.query(`SELECT COUNT(*) as count FROM messages 
       WHERE conversation_id = $1 AND role = 'user' AND created_at > $2::timestamp`, [conversationId, since]);
        return Number(result.rows[0]?.count ?? 0) > 0;
    }
};
exports.RemindersRepository = RemindersRepository;
exports.RemindersRepository = RemindersRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], RemindersRepository);
