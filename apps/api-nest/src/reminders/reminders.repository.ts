import { Injectable, OnModuleInit } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

export type ReminderRecord = {
  id: number;
  user_id: number;
  conversation_id: number;
  message_text: string;
  fire_at: Date;
  status: string;
  source_message_id: string | null;
  error: string | null;
  created_at: Date;
  fired_at: Date | null;
  critical: boolean;
  repeat_count: number;
  acknowledged_at: Date | null;
};

@Injectable()
export class RemindersRepository implements OnModuleInit {
  constructor(private readonly db: DatabaseService) {}

  async onModuleInit(): Promise<void> {
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

  async createReminder(params: {
    userId: number;
    conversationId: number;
    messageText: string;
    fireAt: Date;
    sourceMessageId?: string;
    critical?: boolean;
  }): Promise<ReminderRecord> {
    const result = await this.db.query<ReminderRecord>(
      `INSERT INTO reminders (user_id, conversation_id, message_text, fire_at, source_message_id, critical)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.userId,
        params.conversationId,
        params.messageText,
        params.fireAt,
        params.sourceMessageId ?? null,
        params.critical ?? false,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Failed to insert reminder');
    return row;
  }

  async findDueReminders(): Promise<ReminderRecord[]> {
    const result = await this.db.query<ReminderRecord>(
      `SELECT * FROM reminders WHERE fire_at <= NOW() AND status = 'pending' ORDER BY fire_at ASC`,
    );
    return result.rows;
  }

  async markFired(id: number): Promise<void> {
    await this.db.query(
      `UPDATE reminders SET status = 'fired', fired_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async markFailed(id: number, error: string): Promise<void> {
    await this.db.query(
      `UPDATE reminders SET status = 'failed', error = $2 WHERE id = $1`,
      [id, error],
    );
  }

  /** Find critical reminders that fired but haven't been acknowledged */
  async findUnacknowledgedCritical(): Promise<ReminderRecord[]> {
    const result = await this.db.query<ReminderRecord>(
      `SELECT * FROM reminders 
       WHERE critical = true AND status = 'fired' AND acknowledged_at IS NULL
       ORDER BY fired_at ASC`,
    );
    return result.rows;
  }

  async incrementRepeatCount(id: number): Promise<void> {
    await this.db.query(
      `UPDATE reminders SET repeat_count = repeat_count + 1, fired_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async markAcknowledged(id: number): Promise<void> {
    await this.db.query(
      `UPDATE reminders SET acknowledged_at = NOW(), status = 'acknowledged' WHERE id = $1`,
      [id],
    );
  }

  /** Check if user has replied in the conversation after the reminder fired */
  async hasUserRepliedSince(conversationId: number, sinceDate: Date | string): Promise<boolean> {
    const since = sinceDate instanceof Date ? sinceDate.toISOString() : String(sinceDate);
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM messages 
       WHERE conversation_id = $1 AND role = 'user' AND created_at > $2::timestamp`,
      [conversationId, since],
    );
    return Number(result.rows[0]?.count ?? 0) > 0;
  }
}
