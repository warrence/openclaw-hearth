import { mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

import { AttachmentsRepository } from '../src/attachments/attachments.repository';
import { AttachmentsService } from '../src/attachments/attachments.service';
import { AttachmentsConfig } from '../src/config/attachments.config';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let repository: AttachmentsRepository;
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), 'api-nest-attachments-'));

    const config: AttachmentsConfig = {
      storageRoot,
      publicBaseUrl: 'http://localhost:3001/storage',
      internalBaseUrl: 'http://127.0.0.1:3001/storage',
      tokenSecret: 'attachments-service-test-secret',
      tokenTtlSeconds: 3600,
    };

    repository = new AttachmentsRepository(config);
    service = new AttachmentsService(
      {
        getOrThrow: jest.fn().mockReturnValue(config),
      } as unknown as ConfigService,
      repository,
    );
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('stores temp uploads and finalizes text attachments into message storage', async () => {
    const temporary = await service.storeTemporaryUpload(33, {
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength('hello\n\nworld'),
      buffer: Buffer.from('hello\n\nworld'),
    });

    expect(temporary).toMatchObject({
      id: null,
      name: 'notes.txt',
      mime_type: 'text/plain',
      size_bytes: 12,
      extension: 'txt',
      category: 'text',
      url: null,
      internal_url: null,
      text_excerpt: null,
      text_content: null,
      extraction_note: null,
      path: expect.stringMatching(/^attachments\/tmp\/33\//),
      token: expect.any(String),
    });

    const finalized = await service.finalizeUploads(33, [temporary.token]);
    const [finalizedAttachment] = finalized;
    expect(finalizedAttachment).toBeDefined();

    if (!finalizedAttachment) {
      throw new Error('Expected finalized attachment.');
    }

    expect(finalized).toHaveLength(1);
    expect(finalizedAttachment).toMatchObject({
      id: expect.any(String),
      name: 'notes.txt',
      mime_type: 'text/plain',
      size_bytes: 12,
      extension: 'txt',
      category: 'text',
      url: expect.stringMatching(
        /^http:\/\/localhost:3001\/storage\/attachments\/messages\/33\//,
      ),
      internal_url: expect.stringMatching(
        /^http:\/\/127.0.0.1:3001\/storage\/attachments\/messages\/33\//,
      ),
      text_excerpt: 'hello\n\nworld',
      text_content: 'hello\n\nworld',
      extraction_note: null,
      path: expect.stringMatching(/^attachments\/messages\/33\//),
    });

    expect(await repository.exists(temporary.path as string)).toBe(false);
    expect(await repository.exists(finalizedAttachment.path as string)).toBe(true);
    expect(readFileSync(repository.resolve(finalizedAttachment.path as string), 'utf8')).toBe(
      'hello\n\nworld',
    );
  });

  it('rejects finalize when the token conversation does not match', async () => {
    const temporary = await service.storeTemporaryUpload(33, {
      originalname: 'notes.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength('hello'),
      buffer: Buffer.from('hello'),
    });

    await expect(service.finalizeUploads(44, [temporary.token])).rejects.toThrow(
      new BadRequestException(
        'Attachment token does not belong to this conversation.',
      ),
    );
  });
});
