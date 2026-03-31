import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

type SessionConfig = {
  sessionSecret: string;
  sessionCookieName: string;
  sessionCookieSecure: boolean;
  sessionMaxAgeSeconds: number;
};

type SessionPayload = {
  uid: number;
  iat: number;
  exp: number;
};

@Injectable()
export class SessionCookieService {
  private readonly config: SessionConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.getOrThrow<SessionConfig>('auth', {
      infer: true,
    });
  }

  getCookieName(): string {
    return this.config.sessionCookieName;
  }

  createSessionCookie(userId: number): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      uid: userId,
      iat: now,
      exp: now + this.config.sessionMaxAgeSeconds,
    };
    const encodedPayload = this.toBase64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);

    return this.serializeCookie(`${encodedPayload}.${signature}`);
  }

  clearSessionCookie(): string {
    return this.serializeCookie('', 0);
  }

  readUserIdFromCookieHeader(cookieHeader?: string | string[]): number | null {
    const cookieValue = this.parseCookieHeader(cookieHeader)[this.getCookieName()];

    if (!cookieValue) {
      return null;
    }

    const [encodedPayload, signature] = cookieValue.split('.', 2);

    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = this.sign(encodedPayload);

    if (
      signature.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return null;
    }

    const payload = this.parsePayload(encodedPayload);

    if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload.uid;
  }

  private parsePayload(encodedPayload: string): SessionPayload | null {
    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as Partial<SessionPayload>;

      if (
        !Number.isInteger(payload.uid) ||
        !Number.isInteger(payload.iat) ||
        !Number.isInteger(payload.exp)
      ) {
        return null;
      }

      return payload as SessionPayload;
    } catch {
      return null;
    }
  }

  private sign(encodedPayload: string): string {
    return createHmac('sha256', this.config.sessionSecret)
      .update(encodedPayload)
      .digest('base64url');
  }

  private serializeCookie(value: string, maxAge = this.config.sessionMaxAgeSeconds): string {
    const parts = [
      `${this.getCookieName()}=${encodeURIComponent(value)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`,
    ];

    if (maxAge === 0) {
      parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }

    if (this.config.sessionCookieSecure) {
      parts.push('Secure');
    }

    return parts.join('; ');
  }

  private parseCookieHeader(cookieHeader?: string | string[]): Record<string, string> {
    const rawCookie = Array.isArray(cookieHeader)
      ? cookieHeader.join('; ')
      : cookieHeader ?? '';

    return rawCookie
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.includes('='))
      .reduce<Record<string, string>>((cookies, part) => {
        const separatorIndex = part.indexOf('=');
        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();

        cookies[key] = decodeURIComponent(value);

        return cookies;
      }, {});
  }

  private toBase64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
  }
}
