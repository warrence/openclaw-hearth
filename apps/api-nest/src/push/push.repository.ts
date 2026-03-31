import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

type PushSubscriptionRow = {
  id: number | string;
  user_id: number | string;
  endpoint: string;
  current_conversation_id: number | string | null;
  public_key: string;
  auth_token: string;
  content_encoding: string | null;
  is_visible: boolean;
  user_agent: string | null;
  last_used_at: Date | string | null;
  presence_seen_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PushSubscriptionRecord = {
  id: number;
  user_id: number;
  endpoint: string;
  current_conversation_id: number | null;
  public_key: string;
  auth_token: string;
  content_encoding: string | null;
  is_visible: boolean;
  user_agent: string | null;
  last_used_at: string | null;
  presence_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class PushRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async saveSubscription(params: {
    userId: number;
    endpoint: string;
    publicKey: string;
    authToken: string;
    contentEncoding: string;
    userAgent: string | null;
  }): Promise<PushSubscriptionRecord> {
    const result = await this.databaseService.query<PushSubscriptionRow>(
      `
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
      `,
      [
        params.userId,
        params.endpoint,
        params.publicKey,
        params.authToken,
        params.contentEncoding,
        params.userAgent,
      ],
    );

    return this.mapRow(result.rows[0]!);
  }

  async updatePresenceExact(params: {
    userId: number;
    endpoint: string;
    conversationId: number | null;
    isVisible: boolean;
  }): Promise<PushSubscriptionRecord | null> {
    const result = await this.databaseService.query<PushSubscriptionRow>(
      `
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
      `,
      [params.userId, params.endpoint, params.conversationId, params.isVisible],
    );

    const row = result.rows[0];
    return row ? this.mapRow(row) : null;
  }

  async findLatestSubscriptionForUser(
    userId: number,
  ): Promise<PushSubscriptionRecord | null> {
    const result = await this.databaseService.query<PushSubscriptionRow>(
      `
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
      `,
      [userId],
    );

    const row = result.rows[0];
    return row ? this.mapRow(row) : null;
  }

  async updatePresenceById(params: {
    id: number;
    conversationId: number | null;
    isVisible: boolean;
  }): Promise<PushSubscriptionRecord> {
    const result = await this.databaseService.query<PushSubscriptionRow>(
      `
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
      `,
      [params.id, params.conversationId, params.isVisible],
    );

    return this.mapRow(result.rows[0]!);
  }

  async findAllSubscriptionsForUser(
    userId: number,
  ): Promise<PushSubscriptionRecord[]> {
    const result = await this.databaseService.query<PushSubscriptionRow>(
      `
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
      `,
      [userId],
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async deleteSubscription(userId: number, endpoint: string): Promise<void> {
    await this.databaseService.query(
      `
        DELETE FROM push_subscriptions
        WHERE user_id = $1
          AND endpoint = $2
      `,
      [userId, endpoint],
    );
  }

  private mapRow(row: PushSubscriptionRow): PushSubscriptionRecord {
    return {
      id: Number(row.id),
      user_id: Number(row.user_id),
      endpoint: row.endpoint,
      current_conversation_id:
        row.current_conversation_id === null
          ? null
          : Number(row.current_conversation_id),
      public_key: row.public_key,
      auth_token: row.auth_token,
      content_encoding: row.content_encoding,
      is_visible: Boolean(row.is_visible),
      user_agent: row.user_agent,
      last_used_at: this.toIsoString(row.last_used_at),
      presence_seen_at: this.toIsoString(row.presence_seen_at),
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
