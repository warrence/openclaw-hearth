import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

type ProfileRow = {
  id: number | string;
  name: string;
  slug: string;
  avatar: string | null;
  memory_namespace: string;
  default_agent_id: string | null;
  is_active: boolean;
  role: string;
  pin_hash: string | null;
  pin_set_at: Date | string | null;
  last_login_at: Date | string | null;
  requires_pin: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ProfileRecord = {
  id: number;
  name: string;
  slug: string;
  avatar: string | null;
  memory_namespace: string;
  default_agent_id: string | null;
  is_active: boolean;
  role: string;
  pin_set_at: string | null;
  last_login_at: string | null;
  requires_pin: boolean;
  created_at: string;
  updated_at: string;
  has_pin: boolean;
};

export type ProfileRecordWithPinHash = ProfileRecord & {
  pin_hash: string | null;
};

export type CreateProfileInput = {
  name: string;
  slug: string;
  avatar?: string | null;
  memory_namespace: string;
  default_agent_id: string | null;
  is_active: boolean;
  role: 'owner' | 'member';
};

export type UpdateProfileInput = Partial<{
  name: string;
  slug: string;
  avatar: string | null;
  default_agent_id: string | null;
  is_active: boolean;
  role: 'owner' | 'member';
}>;

@Injectable()
export class ProfilesRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listProfiles(): Promise<ProfileRecord[]> {
    const result = await this.databaseService.query<ProfileRow>(
      `
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
      `,
    );

    return result.rows.map((row) => this.toProfileRecord(this.mapRow(row)));
  }

  async findProfileById(profileId: number): Promise<ProfileRecordWithPinHash | null> {
    const result = await this.databaseService.query<ProfileRow>(
      `
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
      `,
      [profileId],
    );

    const row = result.rows[0];

    return row ? this.mapRow(row) : null;
  }

  async slugExists(slug: string, excludeProfileId?: number): Promise<boolean> {
    const result = await this.databaseService.query<{ exists: boolean }>(
      excludeProfileId
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
          `,
      excludeProfileId ? [slug, excludeProfileId] : [slug],
    );

    return Boolean(result.rows[0]?.exists);
  }

  async createProfile(input: CreateProfileInput): Promise<ProfileRecord> {
    const result = await this.databaseService.query<ProfileRow>(
      `
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
      `,
      [
        input.name,
        input.slug,
        input.avatar ?? null,
        input.memory_namespace,
        input.default_agent_id,
        input.is_active,
        input.role,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException();
    }

    return this.toProfileRecord(this.mapRow(row));
  }

  async updateProfile(
    profileId: number,
    input: UpdateProfileInput,
  ): Promise<ProfileRecord> {
    const entries = Object.entries(input).filter(([, value]) => value !== undefined);

    if (entries.length === 0) {
      const profile = await this.findProfileById(profileId);

      if (!profile) {
        throw new NotFoundException();
      }

      return this.toProfileRecord(profile);
    }

    const assignments = entries.map(
      ([column], index) => `${column} = $${index + 2}`,
    );
    const values = entries.map(([, value]) => value);

    const result = await this.databaseService.query<ProfileRow>(
      `
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
      `,
      [profileId, ...values],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException();
    }

    return this.toProfileRecord(this.mapRow(row));
  }

  async setPinHash(profileId: number, pinHash: string): Promise<ProfileRecord> {
    const result = await this.databaseService.query<ProfileRow>(
      `
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
      `,
      [profileId, pinHash],
    );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException();
    }

    return this.toProfileRecord(this.mapRow(row));
  }

  async resetPin(profileId: number): Promise<void> {
    const result = await this.databaseService.query(
      `
        UPDATE users
        SET pin_hash = NULL, pin_set_at = NULL, updated_at = NOW()
        WHERE id = $1
      `,
      [profileId],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new NotFoundException();
    }
  }

  private mapRow(row: ProfileRow): ProfileRecordWithPinHash {
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

  async listProfileConversations(profileId: number): Promise<{ id: number; openclaw_session_key: string | null }[]> {
    const result = await this.databaseService.query<{ id: number; openclaw_session_key: string | null }>(
      'SELECT id, openclaw_session_key FROM conversations WHERE user_id = $1',
      [profileId],
    );
    return result.rows;
  }

  async deleteProfile(profileId: number): Promise<void> {
    // Delete all messages, then conversations, then the profile itself
    await this.databaseService.query(
      `DELETE FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE user_id = $1
      )`,
      [profileId],
    );
    await this.databaseService.query(
      'DELETE FROM conversations WHERE user_id = $1',
      [profileId],
    );
    await this.databaseService.query(
      'DELETE FROM users WHERE id = $1',
      [profileId],
    );
  }

  private toProfileRecord(profile: ProfileRecordWithPinHash): ProfileRecord {
    const { pin_hash: _pinHash, ...safeProfile } = profile;

    return safeProfile;
  }

  private toIsoString(value: Date | string | null): string | null {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.valueOf()) ? String(value) : parsed.toISOString();
  }
}
