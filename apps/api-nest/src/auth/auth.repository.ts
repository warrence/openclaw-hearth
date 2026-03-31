import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './auth.types';

type UserRow = {
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

export type UserAuthRecord = AuthenticatedUser & {
  pin_hash: string | null;
};

@Injectable()
export class AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listActiveUsers(): Promise<AuthenticatedUser[]> {
    const result = await this.databaseService.query<UserRow>(
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
        WHERE is_active = TRUE
        ORDER BY id ASC
      `,
    );

    return result.rows.map((row) => this.toAuthenticatedUser(this.mapUserRow(row)));
  }

  async findUserForAuth(userId: number): Promise<UserAuthRecord | null> {
    const result = await this.databaseService.query<UserRow>(
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
      [userId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return this.mapUserRow(row);
  }

  async updateLastLoginAt(userId: number): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [userId],
    );
  }

  private mapUserRow(row: UserRow): UserAuthRecord {
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

  private toAuthenticatedUser(user: UserAuthRecord): AuthenticatedUser {
    const { pin_hash: _pinHash, ...authenticatedUser } = user;

    return authenticatedUser;
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
