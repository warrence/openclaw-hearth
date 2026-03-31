import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

@Injectable()
export class LaravelCryptoService {
  constructor(private readonly configService: ConfigService) {}

  encryptString(value: string): string {
    const cipherName = this.resolveCipherName();
    const key = this.resolveKey();
    const iv = randomBytes(this.resolveIvLength(cipherName));

    const cipher = createCipheriv(cipherName, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const ivBase64 = iv.toString('base64');
    const encryptedBase64 = encrypted.toString('base64');

    const mac = createHmac('sha256', key)
      .update(ivBase64 + encryptedBase64)
      .digest('hex');

    return Buffer.from(
      JSON.stringify({
        iv: ivBase64,
        value: encryptedBase64,
        mac,
        tag: '',
      }),
    ).toString('base64');
  }

  decryptString(payload: string): string {
    const cipherName = this.resolveCipherName();
    const key = this.resolveKey();
    const decoded = this.decodePayload(payload);
    const iv = Buffer.from(decoded.iv, 'base64');
    const encrypted = Buffer.from(decoded.value, 'base64');

    const expectedMac = createHmac('sha256', key)
      .update(decoded.iv + decoded.value)
      .digest('hex');

    if (!timingSafeEqual(Buffer.from(expectedMac), Buffer.from(decoded.mac))) {
      throw new Error('Laravel payload MAC verification failed.');
    }

    const decipher = createDecipheriv(cipherName, key, iv);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  tryDecryptString(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    try {
      return this.decryptString(value);
    } catch {
      return null;
    }
  }

  private decodePayload(payload: string): {
    iv: string;
    value: string;
    mac: string;
    tag: string;
  } {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64').toString('utf8'),
    ) as Partial<{
      iv: string;
      value: string;
      mac: string;
      tag: string;
    }>;

    if (!decoded.iv || !decoded.value) {
      throw new Error('Laravel payload is missing encryption fields.');
    }

    return {
      iv: decoded.iv,
      value: decoded.value,
      mac: decoded.mac ?? '',
      tag: decoded.tag ?? '',
    };
  }

  private resolveCipherName(): string {
    const cipher = String(
      this.configService.get<string>('APP_CIPHER') ?? 'AES-256-CBC',
    )
      .trim()
      .toLowerCase();

    if (cipher === 'aes-256-cbc') {
      return 'aes-256-cbc';
    }

    if (cipher === 'aes-128-cbc') {
      return 'aes-128-cbc';
    }

    throw new Error(`Unsupported Laravel cipher "${cipher}".`);
  }

  private resolveKey(): Buffer {
    const rawKey = this.configService.get<string>('APP_KEY');

    if (!rawKey || rawKey.trim() === '') {
      throw new Error('APP_KEY is required for Laravel-compatible encryption.');
    }

    const trimmed = rawKey.trim();

    return trimmed.startsWith('base64:')
      ? Buffer.from(trimmed.slice(7), 'base64')
      : Buffer.from(trimmed, 'utf8');
  }

  private resolveIvLength(cipherName: string): number {
    if (cipherName.includes('-cbc') || cipherName.includes('-gcm')) {
      return 16;
    }

    throw new Error(`Unable to resolve IV length for cipher "${cipherName}".`);
  }
}
