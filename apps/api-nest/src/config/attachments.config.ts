import { registerAs } from '@nestjs/config';
import { resolve } from 'node:path';

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

export type AttachmentsConfig = {
  storageRoot: string;
  publicBaseUrl: string;
  internalBaseUrl: string;
  tokenSecret: string;
  tokenTtlSeconds: number;
};

export const attachmentsConfig = registerAs(
  'attachments',
  (): AttachmentsConfig => ({
    storageRoot: resolve(
      process.cwd(),
      process.env.ATTACHMENTS_STORAGE_ROOT ?? 'storage',
    ),
    publicBaseUrl: normalizeBaseUrl(
      process.env.ATTACHMENTS_PUBLIC_BASE_URL ?? 'http://localhost:3001/storage',
    ),
    internalBaseUrl: normalizeBaseUrl(
      process.env.ATTACHMENTS_INTERNAL_BASE_URL ??
        'http://127.0.0.1:3001/storage',
    ),
    tokenSecret:
      process.env.ATTACHMENTS_TOKEN_SECRET ??
      `${process.env.APP_NAME ?? 'hearth-api-nest'}:attachments:dev`,
    tokenTtlSeconds: Number(process.env.ATTACHMENTS_TOKEN_TTL_SECONDS ?? 86400),
  }),
);
