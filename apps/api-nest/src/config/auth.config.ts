import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  sessionSecret:
    process.env.AUTH_SESSION_SECRET ?? 'hearth-api-nest:session:dev-secret',
  sessionCookieName:
    process.env.AUTH_SESSION_COOKIE_NAME ?? 'hearth_nest_session',
  sessionCookieSecure: String(
    process.env.AUTH_SESSION_COOKIE_SECURE ?? 'false',
  ).toLowerCase() === 'true',
  sessionMaxAgeSeconds: Number(
    process.env.AUTH_SESSION_MAX_AGE_SECONDS ?? 60 * 60 * 24 * 30,
  ),
}));
