import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AttachmentsController } from '../src/attachments/attachments.controller';
import { ConversationAttachmentsService } from '../src/attachments/conversation-attachments.service';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;

  const conversationAttachmentsServiceMock = {
    uploadAttachment: jest.fn(),
  } satisfies Pick<ConversationAttachmentsService, 'uploadAttachment'>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        {
          provide: ConversationAttachmentsService,
          useValue: conversationAttachmentsServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get(AttachmentsController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns { attachment } and omits the internal path after upload', async () => {
    conversationAttachmentsServiceMock.uploadAttachment.mockResolvedValue({
      id: null,
      name: 'hello.txt',
      mime_type: 'text/plain',
      size_bytes: 12,
      extension: 'txt',
      category: 'text',
      uploaded_at: '2026-03-24T00:00:00.000Z',
      url: null,
      internal_url: null,
      text_excerpt: null,
      text_content: null,
      extraction_note: null,
      path: 'attachments/tmp/10/abc.txt',
      token: 'opaque-token',
    });

    await expect(
      controller.uploadAttachment(42, 10, {
        originalname: 'hello.txt',
        mimetype: 'text/plain',
        size: 12,
        buffer: Buffer.from('hello upload'),
      }),
    ).resolves.toEqual({
      attachment: {
        id: null,
        name: 'hello.txt',
        mime_type: 'text/plain',
        size_bytes: 12,
        extension: 'txt',
        category: 'text',
        uploaded_at: '2026-03-24T00:00:00.000Z',
        url: null,
        internal_url: null,
        text_excerpt: null,
        text_content: null,
        extraction_note: null,
        token: 'opaque-token',
      },
    });

    expect(conversationAttachmentsServiceMock.uploadAttachment).toHaveBeenCalledWith(
      42,
      10,
      expect.objectContaining({
        originalname: 'hello.txt',
      }),
    );
  });

  it('surfaces ownership failures from the conversation attachment service', async () => {
    conversationAttachmentsServiceMock.uploadAttachment.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      controller.uploadAttachment(42, 10, {
        originalname: 'hello.txt',
        mimetype: 'text/plain',
        size: 12,
        buffer: Buffer.from('hello upload'),
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
