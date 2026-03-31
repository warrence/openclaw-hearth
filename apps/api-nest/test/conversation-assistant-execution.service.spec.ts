import { ConfigService } from '@nestjs/config';

import {
  ConversationAssistantExecutionService,
  OpenClawExecutionError,
} from '../src/conversations/conversation-assistant-execution.service';
import {
  ConversationRecord,
  ConversationsRepository,
  MessageRecord,
} from '../src/conversations/conversations.repository';

describe('ConversationAssistantExecutionService', () => {
  const conversation: ConversationRecord = {
    id: 10,
    user_id: 1,
    title: 'Tokyo itinerary ideas',
    agent_id: 'aeris',
    mode: 'household',
    model_preset: 'auto',
    openclaw_session_key: 'app:search-tester:conv:title-match',
    status: 'active',
    archived_at: null,
    last_message_at: '2026-03-24T00:00:00.000Z',
    created_at: '2026-03-22T01:00:00.000Z',
    updated_at: '2026-03-24T00:00:00.000Z',
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
  };

  const userMessage: MessageRecord = {
    id: 102,
    conversation_id: 10,
    role: 'user',
    content: 'hello from stream',
    model: null,
    metadata_json: null,
    source: 'app',
    channel: null,
    contract_event: null,
    channel_message_id: 'msg_102',
    person_identity: null,
    agent_id: null,
    reply_to_message_id: null,
    sent_at: null,
    contract_json: null,
    created_at: '2026-03-24T00:00:00.000Z',
    updated_at: '2026-03-24T00:00:00.000Z',
  };

  const configService = {
    getOrThrow: jest.fn(),
  } satisfies Pick<ConfigService, 'getOrThrow'>;

  const repository = {
    createAssistantMessage: jest.fn(),
  } satisfies Pick<ConversationsRepository, 'createAssistantMessage'>;

  let service: ConversationAssistantExecutionService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationAssistantExecutionService(
      configService as unknown as ConfigService,
      repository as unknown as ConversationsRepository,
    );
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('streams responses SSE, persists a real assistant reply, and emits done', async () => {
    configService.getOrThrow.mockReturnValue({
      baseUrl: 'http://127.0.0.1:18789',
      token: 'secret',
      defaultAgentId: 'daughter-aeris',
      defaultModel: 'openai-codex/gpt-5.4',
      fastModel: 'openai-codex/gpt-5.4',
      deepModel: 'anthropic/claude-sonnet-4-5',
      agentTimeoutMs: 3000,
      responsesHttpEnabled: true,
      responsesPath: '/v1/responses',
      agentMap: {
        aeris: 'daughter-aeris',
      },
    });

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            [
              'event: response.created',
              'data: {"type":"response.created","response":{"id":"resp_1","model":"openclaw:daughter-aeris"}}',
              '',
              'event: response.in_progress',
              'data: {"type":"response.in_progress","response":{"id":"resp_1"}}',
              '',
              'event: response.output_text.delta',
              'data: {"type":"response.output_text.delta","delta":"Hello"}',
              '',
              'event: response.output_text.delta',
              'data: {"type":"response.output_text.delta","delta":" there"}',
              '',
              'event: response.completed',
              'data: {"type":"response.completed","response":{"id":"resp_1","model":"openclaw:daughter-aeris","usage":{"output_tokens":12},"output":[{"content":[{"text":"Hello there"}]}]}}',
              '',
            ].join('\n'),
          ),
        );
        controller.close();
      },
    });

    fetchMock.mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    );

    repository.createAssistantMessage.mockResolvedValue({
      assistantMessage: {
        id: 103,
        conversation_id: 10,
        role: 'assistant',
        content: 'Hello there',
        model: 'openclaw:daughter-aeris',
        metadata_json: {
          transport: 'responses-http-sse',
        },
        source: 'openclaw',
        channel: 'app',
        contract_event: 'message.outbound',
        channel_message_id: 'resp_1',
        person_identity: 'person:search-tester',
        agent_id: 'daughter-aeris',
        reply_to_message_id: 'msg_102',
        sent_at: '2026-03-24T00:00:02.000Z',
        contract_json: { messageId: 'resp_1' },
        created_at: '2026-03-24T00:00:02.000Z',
        updated_at: '2026-03-24T00:00:02.000Z',
      },
      conversation: {
        ...conversation,
        last_message_at: '2026-03-24T00:00:02.000Z',
        updated_at: '2026-03-24T00:00:02.000Z',
      },
    });

    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    await service.streamAssistantReply(
      {
        conversation,
        persistedConversation: conversation,
        userMessage,
        content: 'hello from stream',
        attachments: [],
      },
      (event) => {
        events.push(event);
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:18789/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          Authorization: 'Bearer secret',
          'x-openclaw-agent-id': 'daughter-aeris',
        }),
      }),
    );
    expect(repository.createAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 10,
        content: 'Hello there',
        model: 'openclaw:daughter-aeris',
        messageId: 'resp_1',
        replyToMessageId: 'msg_102',
      }),
    );
    expect(events.map((event) => event.event)).toEqual([
      'message.created',
      'assistant.placeholder',
      'status',
      'status',
      'status',
      'assistant.delta',
      'assistant.delta',
      'assistant.message',
      'status',
      'done',
    ]);
  });

  it('emits a truthful error event when Nest lacks gateway configuration', async () => {
    configService.getOrThrow.mockReturnValue({
      baseUrl: undefined,
      token: undefined,
      defaultAgentId: 'daughter-aeris',
      defaultModel: 'openai-codex/gpt-5.4',
      fastModel: 'openai-codex/gpt-5.4',
      deepModel: 'anthropic/claude-sonnet-4-5',
      agentTimeoutMs: 3000,
      responsesHttpEnabled: true,
      responsesPath: '/v1/responses',
      agentMap: {
        aeris: 'daughter-aeris',
      },
    });

    const events: Array<{ event: string; data: Record<string, unknown> }> = [];

    await service.streamAssistantReply(
      {
        conversation,
        persistedConversation: conversation,
        userMessage,
        content: 'hello from stream',
        attachments: [],
      },
      (event) => {
        events.push(event);
      },
    );

    expect(repository.createAssistantMessage).not.toHaveBeenCalled();
    expect(events.at(-1)).toEqual({
      event: 'error',
      data: expect.objectContaining({
        code: 'gateway_not_configured',
        message: 'OpenClaw base URL is not configured for Nest.',
      }),
    });
  });

  it('exposes OpenClaw execution errors as typed failures', () => {
    const error = new OpenClawExecutionError(
      'OpenClaw base URL is not configured for Nest.',
      'gateway_not_configured',
    );

    expect(error.code).toBe('gateway_not_configured');
    expect(error.message).toBe('OpenClaw base URL is not configured for Nest.');
  });
});
