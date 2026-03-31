import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { ConversationAttachmentsService } from '../src/attachments/conversation-attachments.service';
import { ConversationAssistantExecutionService } from '../src/conversations/conversation-assistant-execution.service';
import { ConversationMessageStreamingService } from '../src/conversations/conversation-message-streaming.service';
import { ConversationsController } from '../src/conversations/conversations.controller';
import {
  ConversationRecord,
  ConversationsRepository,
  MessageRecord,
} from '../src/conversations/conversations.repository';
import { ConversationsService } from '../src/conversations/conversations.service';

describe('Conversation read routes', () => {
  let controller: ConversationsController;
  let service: ConversationsService;

  const conversations: ConversationRecord[] = [
    {
      id: 10,
      user_id: 1,
      title: 'Tokyo itinerary ideas',
      agent_id: 'aeris',
      mode: 'household',
      model_preset: 'auto',
      openclaw_session_key: 'app:search:conv:title-match',
      status: 'active',
      archived_at: null,
      last_message_at: '2026-03-23T01:00:00.000Z',
      created_at: '2026-03-22T01:00:00.000Z',
      updated_at: '2026-03-23T01:00:00.000Z',
      messages_count: 1,
      user: {
        id: 1,
        name: 'Search Tester',
        slug: 'search-tester',
        avatar: null,
        memory_namespace: 'person:search-tester',
        default_agent_id: null,
        is_active: true,
        role: 'member',
        pin_set_at: null,
        last_login_at: null,
        requires_pin: true,
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
        has_pin: false,
      },
    },
    {
      id: 11,
      user_id: 1,
      title: 'Weekend planning',
      agent_id: 'aeris',
      mode: 'household',
      model_preset: 'auto',
      openclaw_session_key: 'app:search:conv:message-match',
      status: 'archived',
      archived_at: '2026-03-23T00:00:00.000Z',
      last_message_at: '2026-03-23T02:00:00.000Z',
      created_at: '2026-03-22T02:00:00.000Z',
      updated_at: '2026-03-23T02:00:00.000Z',
      messages_count: 2,
      search_match: {
        matched_fields: ['message'],
        preview: 'Can you help me compare Tokyo and Kyoto neighborhoods?',
        message_id: 101,
        message_created_at: '2026-03-23T02:00:00.000Z',
      },
      user: {
        id: 1,
        name: 'Search Tester',
        slug: 'search-tester',
        avatar: null,
        memory_namespace: 'person:search-tester',
        default_agent_id: null,
        is_active: true,
        role: 'member',
        pin_set_at: null,
        last_login_at: null,
        requires_pin: true,
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
        has_pin: false,
      },
    },
    {
      id: 12,
      user_id: 2,
      title: 'Tokyo hidden',
      agent_id: 'aeris',
      mode: 'household',
      model_preset: 'auto',
      openclaw_session_key: 'app:search:conv:other-user',
      status: 'active',
      archived_at: null,
      last_message_at: '2026-03-23T03:00:00.000Z',
      created_at: '2026-03-22T03:00:00.000Z',
      updated_at: '2026-03-23T03:00:00.000Z',
      messages_count: 1,
      user: {
        id: 2,
        name: 'Other Person',
        slug: 'other-person',
        avatar: null,
        memory_namespace: 'person:other-person',
        default_agent_id: null,
        is_active: true,
        role: 'member',
        pin_set_at: null,
        last_login_at: null,
        requires_pin: true,
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z',
        has_pin: false,
      },
    },
  ];

  const messages: Record<number, MessageRecord[]> = {
    11: [
      {
        id: 100,
        conversation_id: 11,
        role: 'user',
        content: 'Hello',
        model: null,
        metadata_json: null,
        source: null,
        channel: 'app',
        contract_event: 'message.inbound',
        channel_message_id: 'msg_100',
        person_identity: 'person:search-tester',
        agent_id: 'aeris',
        reply_to_message_id: null,
        sent_at: '2026-03-23T01:59:00.000Z',
        contract_json: { channelMessageId: 'msg_100' },
        created_at: '2026-03-23T01:59:00.000Z',
        updated_at: '2026-03-23T01:59:00.000Z',
      },
      {
        id: 101,
        conversation_id: 11,
        role: 'assistant',
        content: 'Can you help me compare Tokyo and Kyoto neighborhoods?',
        model: 'openai-codex/gpt-5.4',
        metadata_json: { transport: 'app' },
        source: 'openclaw',
        channel: 'app',
        contract_event: 'message.outbound',
        channel_message_id: 'msg_101',
        person_identity: 'person:search-tester',
        agent_id: 'aeris',
        reply_to_message_id: 'msg_100',
        sent_at: '2026-03-23T02:00:00.000Z',
        contract_json: { messageId: 'msg_101' },
        created_at: '2026-03-23T02:00:00.000Z',
        updated_at: '2026-03-23T02:00:00.000Z',
      },
    ],
  };

  const repositoryMock: Pick<
    ConversationsRepository,
    | 'listUserConversations'
    | 'findConversationById'
    | 'listConversationMessages'
    | 'createConversation'
    | 'updateConversation'
    | 'createUserMessage'
    | 'createAssistantMessage'
  > = {
    listUserConversations: jest.fn(
      ({
        userId,
        scope,
        search,
        limit,
      }: {
        userId: number;
        scope?: 'active' | 'archived';
        search?: string;
        limit?: number;
      }) => {
        let result = conversations.filter(
          (conversation) => conversation.user_id === userId,
        );

        if (scope === 'active') {
          result = result.filter(
            (conversation) => conversation.status !== 'archived',
          );
        } else if (scope === 'archived') {
          result = result.filter(
            (conversation) => conversation.status === 'archived',
          );
        }

        const trimmedSearch = search?.trim() ?? '';

        if (trimmedSearch !== '') {
          const loweredSearch = trimmedSearch.toLowerCase();
          result = result
            .filter(
              (conversation) =>
                conversation.title.toLowerCase().includes(loweredSearch) ||
                messages[conversation.id]?.some((message) =>
                  message.content.toLowerCase().includes(loweredSearch),
                ),
            )
            .map((conversation) => ({
              ...conversation,
              search_match:
                conversation.search_match ??
                ({
                  matched_fields: ['title'],
                  preview: conversation.title,
                  message_id: null,
                  message_created_at: null,
                } satisfies ConversationRecord['search_match']),
            }))
            .slice(0, limit ?? 40);
        } else {
          result = result.map((conversation) => {
            const { search_match: searchMatch, ...rest } = conversation;
            void searchMatch;

            return rest;
          });
        }

        return Promise.resolve(result.sort((left, right) => {
          const leftLastMessageAt = left.last_message_at ?? '';
          const rightLastMessageAt = right.last_message_at ?? '';

          return rightLastMessageAt.localeCompare(leftLastMessageAt);
        }));
      },
    ),
    findConversationById: jest.fn((conversationId: number) => {
      return Promise.resolve(
        conversations.find((conversation) => conversation.id === conversationId) ??
          null,
      );
    }),
    listConversationMessages: jest.fn(
      (conversationId: number) =>
        Promise.resolve(messages[conversationId] ?? []),
    ),
    createConversation: jest.fn(
      ({
        userId,
        title,
        agentId,
        modelPreset,
      }: {
        userId: number;
        title: string;
        agentId?: string;
        modelPreset?: 'auto' | 'fast' | 'deep';
      }) =>
        Promise.resolve({
          id: 13,
          user_id: userId,
          title,
          agent_id: agentId ?? 'aeris',
          mode: 'household',
          model_preset: modelPreset ?? 'auto',
          openclaw_session_key: 'app:search-tester:conv:new-conversation',
          status: 'active',
          archived_at: null,
          last_message_at: null,
          created_at: '2026-03-24T00:00:00.000Z',
          updated_at: '2026-03-24T00:00:00.000Z',
        }),
    ),
    updateConversation: jest.fn(
      (
        conversationId: number,
        updates: {
          title?: string;
          agentId?: string;
          modelPreset?: 'auto' | 'fast' | 'deep';
          status?: 'active' | 'archived';
        },
      ) => {
        const conversation = conversations.find((item) => item.id === conversationId)!;
        const nextStatus = updates.status ?? conversation.status;

        return Promise.resolve({
          ...conversation,
          title: updates.title ?? conversation.title,
          agent_id: updates.agentId ?? conversation.agent_id,
          model_preset: updates.modelPreset ?? conversation.model_preset,
          status: nextStatus,
          archived_at:
            updates.status === undefined
              ? conversation.archived_at
              : nextStatus === 'archived'
                ? '2026-03-24T00:00:00.000Z'
                : null,
          updated_at: '2026-03-24T00:00:00.000Z',
        });
      },
    ),
    createUserMessage: jest.fn(
      ({
        conversationId,
        content,
        attachments,
      }: {
        conversationId: number;
        content: string;
        attachments?: Array<Record<string, unknown>>;
      }) => {
        const conversation = conversations.find((item) => item.id === conversationId)!;
        const createdAt = '2026-03-24T00:00:00.000Z';
        const message: MessageRecord = {
          id: 102,
          conversation_id: conversationId,
          role: 'user',
          content,
          model: null,
          metadata_json:
            attachments && attachments.length > 0 ? { attachments } : null,
          source: 'app',
          channel: null,
          contract_event: null,
          channel_message_id: null,
          person_identity: null,
          agent_id: null,
          reply_to_message_id: null,
          sent_at: null,
          contract_json: null,
          created_at: createdAt,
          updated_at: createdAt,
        };

        return Promise.resolve({
          userMessage: message,
          conversation: {
            ...conversation,
            last_message_at: createdAt,
            updated_at: createdAt,
          },
        });
      },
    ),
    createAssistantMessage: jest.fn(),
  };

  const conversationAttachmentsServiceMock = {
    finalizeUploads: jest.fn(),
  } satisfies Pick<ConversationAttachmentsService, 'finalizeUploads'>;

  const conversationAssistantExecutionServiceMock = {
    streamAssistantReply: jest.fn(
      async (
        prepared: {
          userMessage: MessageRecord;
          persistedConversation: ConversationRecord;
        },
        emit: (event: { event: string; data: Record<string, unknown> }) => void,
      ) => {
        emit({
          event: 'message.created',
          data: {
            message: prepared.userMessage,
          },
        });
        emit({
          event: 'assistant.placeholder',
          data: {
            message: {
              id: 'pending-assistant-102',
              role: 'assistant',
              content: '',
            },
          },
        });
        emit({
          event: 'status',
          data: {
            state: 'queued',
            label: 'Queued for OpenClaw',
            stream_mode: 'openclaw-responses-http-sse',
          },
        });
        emit({
          event: 'error',
          data: {
            code: 'gateway_not_configured',
            message: 'OpenClaw base URL is not configured for Nest.',
            stream_mode: 'openclaw-responses-http-sse',
          },
        });
      },
    ),
  } satisfies Pick<
    ConversationAssistantExecutionService,
    'streamAssistantReply'
  >;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        ConversationsService,
        ConversationMessageStreamingService,
        {
          provide: ConversationsRepository,
          useValue: repositoryMock,
        },
        {
          provide: ConversationAttachmentsService,
          useValue: conversationAttachmentsServiceMock,
        },
        {
          provide: ConversationAssistantExecutionService,
          useValue: conversationAssistantExecutionServiceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get(ConversationsController);
    service = moduleRef.get(ConversationsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists owner conversations with Laravel-like ordering and counts', async () => {
    await expect(
      controller.listUserConversations(1, 1, {}),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 11,
        title: 'Weekend planning',
        messages_count: 2,
      }),
      expect.objectContaining({
        id: 10,
        title: 'Tokyo itinerary ideas',
        messages_count: 1,
      }),
    ]);
  });

  it('supports archived scope and search metadata', async () => {
    await expect(
      controller.listUserConversations(1, 1, {
        scope: 'archived',
        search: 'tokyo',
        limit: 1,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 11,
        title: 'Weekend planning',
        search_match: {
          matched_fields: ['message'],
          preview: 'Can you help me compare Tokyo and Kyoto neighborhoods?',
          message_id: 101,
          message_created_at: '2026-03-23T02:00:00.000Z',
        },
      }),
    ]);

    expect(repositoryMock.listUserConversations).toHaveBeenCalledWith({
      userId: 1,
      scope: 'archived',
      search: 'tokyo',
      limit: 1,
    });
  });

  it('blocks cross-user conversation list access', async () => {
    await expect(
      controller.listUserConversations(2, 1, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns conversation detail with nested user', async () => {
    await expect(controller.getConversation(1, 10)).resolves.toMatchObject({
      id: 10,
      title: 'Tokyo itinerary ideas',
      user: {
        id: 1,
        slug: 'search-tester',
        has_pin: false,
      },
    });
  });

  it('authorizes detail reads when the repository returns bigint-like string owner ids', async () => {
    const baseConversation = conversations[0]!;

    const bigintLikeRepository = {
      findConversationById: jest.fn().mockResolvedValue({
        ...baseConversation,
        user_id: '1',
        user: {
          ...(baseConversation.user ?? {}),
          id: 1,
        },
      }),
      listUserConversations: jest.fn(),
      listConversationMessages: jest.fn(),
    } as unknown as ConversationsRepository;

    const bigintLikeService = new ConversationsService(
      bigintLikeRepository,
      conversationAttachmentsServiceMock as unknown as ConversationAttachmentsService,
      conversationAssistantExecutionServiceMock as unknown as ConversationAssistantExecutionService,
    );

    await expect(bigintLikeService.getConversation(1, 10)).resolves.toMatchObject({
      id: 10,
      user_id: '1',
    });
  });

  it('blocks cross-user conversation detail access', async () => {
    await expect(controller.getConversation(2, 10)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates conversations for the owning user with Laravel-like defaults', async () => {
    await expect(
      controller.createConversation(1, 1, {
        title: 'New chat',
      }),
    ).resolves.toMatchObject({
      id: 13,
      user_id: 1,
      title: 'New chat',
      agent_id: 'aeris',
      model_preset: 'auto',
      status: 'active',
      archived_at: null,
    });

    expect(repositoryMock.createConversation).toHaveBeenCalledWith({
      userId: 1,
      title: 'New chat',
      agentId: undefined,
      modelPreset: undefined,
    });
  });

  it('blocks cross-user conversation creation', async () => {
    await expect(
      controller.createConversation(2, 1, {
        title: 'Nope',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns ordered conversation messages', async () => {
    await expect(controller.listConversationMessages(1, 11)).resolves.toEqual([
      expect.objectContaining({
        id: 100,
        contract_event: 'message.inbound',
      }),
      expect.objectContaining({
        id: 101,
        contract_event: 'message.outbound',
        reply_to_message_id: 'msg_100',
      }),
    ]);
  });

  it('persists a trimmed text-only user message and returns the local-persist runtime shape', async () => {
    await expect(
      controller.sendConversationMessage(1, 10, {
        content: '  hello from nest  ',
      } as never, {} as never),
    ).resolves.toEqual({
      user_message: expect.objectContaining({
        id: 102,
        conversation_id: 10,
        role: 'user',
        content: 'hello from nest',
        metadata_json: null,
        source: 'app',
      }),
      assistant_message: null,
      conversation: expect.objectContaining({
        id: 10,
        last_message_at: '2026-03-24T00:00:00.000Z',
      }),
      runtime: {
        transport_mode: 'nest-local-persist',
        contract_shaped: false,
      },
    });

    expect(conversationAttachmentsServiceMock.finalizeUploads).not.toHaveBeenCalled();
    expect(repositoryMock.createUserMessage).toHaveBeenCalledWith({
      conversationId: 10,
      content: 'hello from nest',
      attachments: undefined,
    });
  });

  it('finalizes attachment tokens before persisting the user message', async () => {
    conversationAttachmentsServiceMock.finalizeUploads.mockResolvedValue([
      {
        id: 'att_1',
        name: 'notes.txt',
        mime_type: 'text/plain',
        size_bytes: 12,
        extension: 'txt',
        category: 'text',
        uploaded_at: '2026-03-24T00:00:00.000Z',
        url: 'http://localhost:3001/storage/attachments/messages/10/notes.txt',
        internal_url:
          'http://127.0.0.1:3001/storage/attachments/messages/10/notes.txt',
        text_excerpt: 'hello world',
        text_content: 'hello world',
        extraction_note: null,
        path: 'attachments/messages/10/notes.txt',
      },
    ]);

    await expect(
      controller.sendConversationMessage(1, 10, {
        content: 'See attachment',
        attachments: ['opaque-token'],
      } as never, {} as never),
    ).resolves.toEqual(
      expect.objectContaining({
        user_message: expect.objectContaining({
          metadata_json: {
            attachments: [
              expect.objectContaining({
                id: 'att_1',
                name: 'notes.txt',
              }),
            ],
          },
        }),
      }),
    );

    expect(conversationAttachmentsServiceMock.finalizeUploads).toHaveBeenCalledWith(
      1,
      10,
      ['opaque-token'],
    );
    expect(repositoryMock.createUserMessage).toHaveBeenCalledWith({
      conversationId: 10,
      content: 'See attachment',
      attachments: [
        expect.objectContaining({
          id: 'att_1',
          name: 'notes.txt',
        }),
      ],
    });
  });

  it('authorizes message reads when the repository returns bigint-like string owner ids', async () => {
    const baseConversation = conversations[1]!;

    const bigintLikeRepository = {
      findConversationById: jest.fn().mockResolvedValue({
        ...baseConversation,
        user_id: '1',
      }),
      listUserConversations: jest.fn(),
      listConversationMessages: jest.fn().mockResolvedValue(messages[11]),
    } as unknown as ConversationsRepository;

    const bigintLikeService = new ConversationsService(
      bigintLikeRepository,
      conversationAttachmentsServiceMock as unknown as ConversationAttachmentsService,
      conversationAssistantExecutionServiceMock as unknown as ConversationAssistantExecutionService,
    );

    await expect(bigintLikeService.listConversationMessages(1, 11)).resolves.toHaveLength(2);
  });

  it('updates conversation title, agent, preset, and status', async () => {
    await expect(
      controller.updateConversation(1, 10, {
        title: 'Renamed chat',
        agent_id: 'daughter-aeris',
        model_preset: 'deep',
        status: 'archived',
      }),
    ).resolves.toMatchObject({
      id: 10,
      title: 'Renamed chat',
      agent_id: 'daughter-aeris',
      model_preset: 'deep',
      status: 'archived',
      archived_at: '2026-03-24T00:00:00.000Z',
    });

    expect(repositoryMock.updateConversation).toHaveBeenCalledWith(10, {
      title: 'Renamed chat',
      agentId: 'daughter-aeris',
      modelPreset: 'deep',
      status: 'archived',
    });
  });

  it('archives and restores owned conversations via dedicated routes', async () => {
    await expect(controller.archiveConversation(1, 10)).resolves.toMatchObject({
      id: 10,
      status: 'archived',
      archived_at: '2026-03-24T00:00:00.000Z',
    });

    await expect(controller.restoreConversation(1, 11)).resolves.toMatchObject({
      id: 11,
      status: 'active',
      archived_at: null,
    });

    expect(repositoryMock.updateConversation).toHaveBeenNthCalledWith(1, 10, {
      status: 'archived',
    });
    expect(repositoryMock.updateConversation).toHaveBeenNthCalledWith(2, 11, {
      status: 'active',
    });
  });

  it('blocks cross-user write access to existing conversations', async () => {
    await expect(
      controller.updateConversation(2, 10, { title: 'Nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.sendConversationMessage(
        2,
        10,
        { content: 'Nope' } as never,
        {} as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.archiveConversation(2, 10)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(controller.restoreConversation(2, 10)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns not found for unknown conversations', async () => {
    await expect(service.getConversation(1, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.listConversationMessages(1, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateConversation(1, 999, { title: 'Missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.archiveConversation(1, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.restoreConversation(1, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns a Laravel-like 422 when both content and attachments are missing', async () => {
    await expect(
      controller.sendConversationMessage(1, 10, {
        content: '   ',
        attachments: [],
      } as never, {} as never),
    ).rejects.toMatchObject({
      response: {
        message: 'A message or at least one attachment is required.',
        errors: {
          content: ['A message or at least one attachment is required.'],
        },
      },
      status: 422,
    });
  });

  it('returns a Laravel-like 422 when attachment finalization fails', async () => {
    conversationAttachmentsServiceMock.finalizeUploads.mockRejectedValue(
      new Error('One of the selected attachments is no longer available.'),
    );

    await expect(
      controller.sendConversationMessage(1, 10, {
        attachments: ['opaque-token'],
      } as never, {} as never),
    ).rejects.toMatchObject({
      response: {
        message: 'One of the selected attachments is no longer available.',
        errors: {
          attachments: ['One of the selected attachments is no longer available.'],
        },
      },
      status: 422,
    });
  });

  it('returns local SSE events in order when stream=true is requested', async () => {
    const response = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    await expect(
      controller.sendConversationMessage(
        1,
        10,
        {
          content: '  hello from stream  ',
          stream: true,
        },
        response as never,
      ),
    ).resolves.toBeUndefined();

    expect(response.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    expect(response.write.mock.calls).toEqual([
      [
        expect.stringContaining(
          'event: message.created\ndata: {"message":{"id":102,"conversation_id":10,"role":"user","content":"hello from stream"',
        ),
      ],
      [
        expect.stringContaining(
          'event: assistant.placeholder\ndata: {"message":{"id":"pending-assistant-102","role":"assistant","content":""}}',
        ),
      ],
      [
        expect.stringContaining(
          'event: status\ndata: {"state":"queued","label":"Queued for OpenClaw","stream_mode":"openclaw-responses-http-sse"}',
        ),
      ],
      [
        expect.stringContaining(
          'event: error\ndata: {"code":"gateway_not_configured","message":"OpenClaw base URL is not configured for Nest.","stream_mode":"openclaw-responses-http-sse"}',
        ),
      ],
    ]);
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('prepares stream execution from a real persisted user message without inventing an assistant reply', async () => {
    await expect(
      service.prepareConversationMessageStream(1, 10, {
        content: 'stream payload',
        stream: true,
      }),
    ).resolves.toEqual({
      conversation: expect.objectContaining({
        id: 10,
        user: expect.objectContaining({
          id: 1,
        }),
      }),
      persistedConversation: expect.objectContaining({
        id: 10,
        last_message_at: '2026-03-24T00:00:00.000Z',
      }),
      userMessage: expect.objectContaining({
        role: 'user',
        content: 'stream payload',
      }),
      content: 'stream payload',
      attachments: [],
    });

    expect(
      conversationAssistantExecutionServiceMock.streamAssistantReply,
    ).not.toHaveBeenCalled();
  });
});

describe('Conversation message SSE writer', () => {
  it('returns an SSE-capable response shape for the local stream foundation', () => {
    const streamingService = new ConversationMessageStreamingService();
    const response = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    streamingService.startSse(response);
    streamingService.writeEvent(response, {
      event: 'message.created',
      data: {
        message: {
          id: 201,
          role: 'user',
          content: 'hello over http',
        },
      },
    });
    streamingService.writeEvent(response, {
      event: 'status',
      data: {
        state: 'completed',
      },
    });
    streamingService.writeEvent(response, {
      event: 'done',
      data: {
        conversation: {
          id: 10,
        },
        partial_available: false,
      },
    });
    streamingService.endSse(response);

    expect(response.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    expect(response.write.mock.calls).toEqual([
      [
        'event: message.created\ndata: {"message":{"id":201,"role":"user","content":"hello over http"}}\n\n',
      ],
      ['event: status\ndata: {"state":"completed"}\n\n'],
      [
        'event: done\ndata: {"conversation":{"id":10},"partial_available":false}\n\n',
      ],
    ]);
    expect(response.end).toHaveBeenCalledTimes(1);
  });
});
