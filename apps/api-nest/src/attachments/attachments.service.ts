import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { extname } from 'node:path';

import { AttachmentsConfig } from '../config/attachments.config';
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  MAX_TEXT_CONTENT_CHARS,
  MAX_TEXT_EXCERPT_CHARS,
} from './attachments.constants';
import { AttachmentsRepository } from './attachments.repository';
import {
  AttachmentCategory,
  AttachmentPayload,
  AttachmentTokenPayload,
  TemporaryAttachmentPayload,
} from './attachments.types';

const execFileAsync = promisify(execFile);
const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'rst',
  'json',
  'jsonl',
  'csv',
  'tsv',
  'yaml',
  'yml',
  'xml',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'env',
  'ini',
  'conf',
  'config',
  'properties',
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  'php',
  'phtml',
  'py',
  'pyw',
  'pyi',
  'rb',
  'erb',
  'java',
  'c',
  'cpp',
  'cc',
  'cxx',
  'h',
  'hpp',
  'cs',
  'swift',
  'kt',
  'go',
  'rs',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ps1',
  'bat',
  'cmd',
  'vue',
  'svelte',
  'astro',
  'sql',
  'graphql',
  'gql',
  'tex',
  'bib',
]);

export type UploadedFileLike = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class AttachmentsService {
  private readonly config: AttachmentsConfig;

  constructor(
    configService: ConfigService,
    private readonly repository: AttachmentsRepository,
  ) {
    this.config = configService.getOrThrow<AttachmentsConfig>('attachments', {
      infer: true,
    });
  }

  async storeTemporaryUpload(
    conversationId: number,
    file: UploadedFileLike | undefined,
  ): Promise<TemporaryAttachmentPayload> {
    this.assertValidUpload(file);
    const uploadedFile = file as UploadedFileLike;
    const extension = this.getExtension(uploadedFile.originalname);
    const tempPath = `attachments/tmp/${conversationId}/${randomUUID()}${extension ? `.${extension}` : ''}`;
    const uploadedAt = new Date().toISOString();

    await this.repository.write(tempPath, uploadedFile.buffer);

    // Note: tempPath stays keyed by conversationId (short-lived, cleaned on finalize or profile delete)

    const metadata: AttachmentTokenPayload = {
      conversation_id: conversationId,
      path: tempPath,
      name: uploadedFile.originalname,
      mime_type: uploadedFile.mimetype || 'application/octet-stream',
      size_bytes: uploadedFile.size,
      extension,
      category: this.detectCategory(uploadedFile.mimetype, extension),
      uploaded_at: uploadedAt,
      issued_at: uploadedAt,
    };

    return {
      ...this.formatAttachmentPayload(metadata),
      token: this.encryptToken(metadata),
    };
  }

  async finalizeUploads(
    userId: number,
    conversationId: number,
    tokens: string[],
  ): Promise<AttachmentPayload[]> {
    const attachments: AttachmentPayload[] = [];

    for (const token of tokens) {
      const payload = this.decryptToken(token);

      if (payload.conversation_id !== conversationId) {
        throw new BadRequestException(
          'Attachment token does not belong to this conversation.',
        );
      }

      if (!(await this.repository.exists(payload.path))) {
        throw new BadRequestException(
          'One of the selected attachments is no longer available.',
        );
      }

      const safeBaseName = this.toSlug(payload.name.replace(/\.[^.]+$/, ''));
      const finalFileName = `${randomUUID()}-${safeBaseName || 'attachment'}${payload.extension ? `.${payload.extension}` : ''}`;
      // New structure: users/<userId>/<conversationId>/<file>
      const finalPath = `attachments/users/${userId}/${conversationId}/${finalFileName}`;

      await this.repository.move(payload.path, finalPath);

      const extraction = await this.extractAttachmentText(
        finalPath,
        payload.mime_type,
        payload.extension,
      );

      attachments.push(
        this.formatAttachmentPayload({
          ...payload,
          id: randomUUID(),
          path: finalPath,
          url: `${this.config.publicBaseUrl}/${finalPath}`,
          internal_url: `${this.config.internalBaseUrl}/${finalPath}`,
          text_excerpt: extraction.text_excerpt,
          text_content: extraction.text_content,
          extraction_note: extraction.extraction_note,
        }),
      );
    }

    return attachments;
  }

  private assertValidUpload(file: UploadedFileLike | undefined): void {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_ATTACHMENT_BYTES} bytes.`,
      );
    }

    const extension = this.getExtension(file.originalname);

    if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(extension as (typeof ATTACHMENT_ALLOWED_EXTENSIONS)[number])) {
      throw new BadRequestException(
        'Invalid file type. Allowed types: jpg, jpeg, png, gif, webp, pdf, txt, md, json, csv.',
      );
    }
  }

  private getExtension(filename: string): string {
    return extname(filename).replace(/^\./, '').toLowerCase();
  }

  private formatAttachmentPayload(
    metadata: Partial<AttachmentPayload> &
      Pick<
        AttachmentTokenPayload,
        | 'name'
        | 'mime_type'
        | 'size_bytes'
        | 'extension'
        | 'category'
        | 'uploaded_at'
        | 'path'
      >,
  ): AttachmentPayload {
    return {
      id: metadata.id ?? null,
      name: metadata.name,
      mime_type: metadata.mime_type,
      size_bytes: metadata.size_bytes,
      extension: metadata.extension,
      category: metadata.category,
      uploaded_at: metadata.uploaded_at,
      url: metadata.url ?? null,
      internal_url: metadata.internal_url ?? null,
      text_excerpt: metadata.text_excerpt ?? null,
      text_content: metadata.text_content ?? null,
      extraction_note: metadata.extraction_note ?? null,
      path: metadata.path ?? null,
    };
  }

  private detectCategory(mimeType: string, extension: string): AttachmentCategory {
    const normalizedMime = mimeType.toLowerCase();

    if (normalizedMime.startsWith('image/')) {
      return 'image';
    }

    if (normalizedMime === 'application/pdf' || extension === 'pdf') {
      return 'pdf';
    }

    if (normalizedMime.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) {
      return 'text';
    }

    return 'file';
  }

  private encryptToken(payload: AttachmentTokenPayload): string {
    const iv = randomBytes(12);
    const key = createHash('sha256').update(this.config.tokenSecret).digest();
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  private decryptToken(token: string): AttachmentTokenPayload {
    const [version, ivEncoded, tagEncoded, ciphertextEncoded] = token.split('.');

    if (
      version !== 'v1' ||
      !ivEncoded ||
      !tagEncoded ||
      !ciphertextEncoded
    ) {
      throw new BadRequestException('Invalid attachment token.');
    }

    try {
      const key = createHash('sha256').update(this.config.tokenSecret).digest();
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(ivEncoded, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));

      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      const payload = JSON.parse(plaintext) as AttachmentTokenPayload;
      const issuedAtMs = Date.parse(payload.issued_at);

      if (
        !Number.isFinite(issuedAtMs) ||
        Date.now() - issuedAtMs > this.config.tokenTtlSeconds * 1000
      ) {
        throw new BadRequestException('Attachment token has expired.');
      }

      return payload;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Invalid attachment token.');
    }
  }

  private async extractAttachmentText(
    relativePath: string,
    mimeType: string,
    extension: string,
  ): Promise<{
    text_excerpt: string | null;
    text_content: string | null;
    extraction_note: string | null;
  }> {
    const normalizedMime = mimeType.toLowerCase();

    if (normalizedMime === 'application/pdf' || extension === 'pdf') {
      const content = await this.extractPdfText(relativePath);

      if (content === null) {
        return {
          text_excerpt: null,
          text_content: null,
          extraction_note:
            'PDF text extraction failed (possibly scanned/image-only or restricted).',
        };
      }

      return {
        text_excerpt: content.slice(0, MAX_TEXT_EXCERPT_CHARS) || null,
        text_content: content.slice(0, MAX_TEXT_CONTENT_CHARS) || null,
        extraction_note: null,
      };
    }

    if (!normalizedMime.startsWith('text/') && !TEXT_EXTENSIONS.has(extension)) {
      return {
        text_excerpt: null,
        text_content: null,
        extraction_note: null,
      };
    }

    try {
      const content = await this.repository.read(relativePath);

      if (!this.isValidText(content)) {
        return {
          text_excerpt: null,
          text_content: null,
          extraction_note: null,
        };
      }

      const normalized = this.normalizeExtractedText(content.toString('utf8'));

      if (!normalized) {
        return {
          text_excerpt: null,
          text_content: null,
          extraction_note: null,
        };
      }

      return {
        text_excerpt: normalized.slice(0, MAX_TEXT_EXCERPT_CHARS),
        text_content: normalized.slice(0, MAX_TEXT_CONTENT_CHARS),
        extraction_note: null,
      };
    } catch {
      return {
        text_excerpt: null,
        text_content: null,
        extraction_note: null,
      };
    }
  }

  private async extractPdfText(relativePath: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('pdftotext', [
        '-layout',
        '-enc',
        'UTF-8',
        this.repository.resolve(relativePath),
        '-',
      ]);
      const normalized = this.normalizeExtractedText(stdout);
      return normalized || null;
    } catch {
      return null;
    }
  }

  private normalizeExtractedText(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private isValidText(content: Buffer): boolean {
    if (content.length === 0) {
      return false;
    }

    if (content.includes(0)) {
      return false;
    }

    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(
        content.subarray(0, 1024),
      );
      return decoded.length >= 0;
    } catch {
      return false;
    }
  }

  private toSlug(value: string): string {
    const normalized = value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase();

    return normalized.replace(/[-\s]+/g, '-');
  }
}
