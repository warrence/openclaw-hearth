export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'pdf',
  'txt',
  'md',
  'json',
  'csv',
] as const;

export const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
export const MAX_TEXT_CONTENT_CHARS = 12_000;
export const MAX_TEXT_EXCERPT_CHARS = 2_000;
