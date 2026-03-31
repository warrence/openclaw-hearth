import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';

import { DatabaseService } from '../database/database.service';

interface StoredChallenge {
  challenge: string;
  expires: number;
}

const challengeStore = new Map<number, StoredChallenge>();

@Injectable()
export class WebAuthnService {
  private readonly rpID =
    process.env.WEBAUTHN_RP_ID ?? 'localhost';
  private readonly origin =
    process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:9100';
  private readonly rpName = 'Hearth';

  constructor(private readonly db: DatabaseService) {}

  async ensureTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        counter BIGINT NOT NULL DEFAULT 0,
        device_type TEXT,
        backed_up BOOLEAN DEFAULT FALSE,
        transports TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id
        ON webauthn_credentials(user_id)
    `);
  }

  async getRegistrationOptions(userId: number, userName: string) {
    const existing = await this.db.query<{ credential_id: string }>(
      'SELECT credential_id FROM webauthn_credentials WHERE user_id = $1',
      [userId],
    );
    const excludeCredentials = existing.rows.map((r) => ({
      id: r.credential_id,
      type: 'public-key' as const,
    }));
    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: new TextEncoder().encode(String(userId)),
      userName,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });
    challengeStore.set(userId, {
      challenge: options.challenge,
      expires: Date.now() + 300_000,
    });
    return options;
  }

  async verifyRegistration(
    userId: number,
    body: unknown,
  ): Promise<{ verified: boolean }> {
    const stored = challengeStore.get(userId);
    if (!stored || Date.now() > stored.expires) {
      throw new BadRequestException('Challenge expired. Please try again.');
    }
    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response: body as Parameters<typeof verifyRegistrationResponse>[0]['response'],
        expectedChallenge: stored.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
      });
    } catch {
      throw new BadRequestException('Registration verification failed.');
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Registration verification failed.');
    }
    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;
    await this.db.query(
      `INSERT INTO webauthn_credentials
         (user_id, credential_id, public_key, counter, device_type, backed_up, transports)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (credential_id) DO UPDATE
         SET counter = $4, updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        credential.id,
        Buffer.from(credential.publicKey).toString('base64'),
        credential.counter,
        credentialDeviceType ?? null,
        credentialBackedUp ?? false,
        credential.transports ?? null,
      ],
    );
    challengeStore.delete(userId);
    return { verified: true };
  }

  async getAuthenticationOptions(userId: number) {
    const credentials = await this.db.query<{
      credential_id: string;
      transports: string[] | null;
    }>(
      'SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1',
      [userId],
    );
    if (credentials.rows.length === 0) {
      throw new BadRequestException('No credentials registered for this profile.');
    }
    const allowCredentials = credentials.rows.map((r) => ({
      id: r.credential_id,
      type: 'public-key' as const,
      ...(r.transports ? { transports: r.transports as AuthenticatorTransport[] } : {}),
    }));
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials,
      userVerification: 'preferred',
    });
    challengeStore.set(userId, {
      challenge: options.challenge,
      expires: Date.now() + 300_000,
    });
    return options;
  }

  async verifyAuthentication(
    userId: number,
    body: unknown,
  ): Promise<{ verified: boolean }> {
    const stored = challengeStore.get(userId);
    if (!stored || Date.now() > stored.expires) {
      throw new UnauthorizedException('Challenge expired. Please try again.');
    }
    const bodyAny = body as Record<string, unknown>;
    const credResult = await this.db.query<{
      credential_id: string;
      public_key: string;
      counter: string;
      transports: string[] | null;
    }>(
      `SELECT credential_id, public_key, counter, transports
       FROM webauthn_credentials
       WHERE credential_id = $1 AND user_id = $2`,
      [bodyAny['id'], userId],
    );
    if (!credResult.rows[0]) {
      throw new UnauthorizedException('Credential not found.');
    }
    const cred = credResult.rows[0];
    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: body as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
        expectedChallenge: stored.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: cred.credential_id,
          publicKey: Buffer.from(cred.public_key, 'base64'),
          counter: Number(cred.counter),
          ...(cred.transports
            ? { transports: cred.transports as AuthenticatorTransport[] }
            : {}),
        },
      });
    } catch {
      throw new UnauthorizedException('Authentication verification failed.');
    }
    if (!verification.verified) {
      throw new UnauthorizedException('Authentication failed.');
    }
    await this.db.query(
      `UPDATE webauthn_credentials
       SET counter = $1, updated_at = CURRENT_TIMESTAMP
       WHERE credential_id = $2`,
      [verification.authenticationInfo.newCounter, cred.credential_id],
    );
    challengeStore.delete(userId);
    return { verified: true };
  }

  async listCredentials(userId: number) {
    const result = await this.db.query<{
      id: number;
      credential_id: string;
      device_type: string | null;
      backed_up: boolean;
      created_at: Date;
    }>(
      `SELECT id, credential_id, device_type, backed_up, created_at
       FROM webauthn_credentials
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async deleteCredential(userId: number, credentialId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM webauthn_credentials
       WHERE user_id = $1 AND credential_id = $2`,
      [userId, credentialId],
    );
  }
}
