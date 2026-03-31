import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ConversationsRepository } from '../src/conversations/conversations.repository';
import { DatabaseService } from '../src/database/database.service';

describe('ConversationsRepository parity mapping', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const fixtureRoot = join(
    __dirname,
    '..',
    '..',
    '..',
    'docs',
    'parity-fixtures',
    'laravel-first-slice',
  );

  const readFixture = <T>(name: string): T =>
    JSON.parse(readFileSync(join(fixtureRoot, name), 'utf8')) as T;

  it('creates conversations with Laravel-like defaults and session key shape', async () => {
    const databaseServiceMock = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: '1',
              slug: 'alex',
              default_agent_id: 'daughter-aeris',
            },
          ],
        })
        .mockImplementationOnce((sql: string, params: unknown[]) => {
          expect(sql).toContain('INSERT INTO conversations');
          expect(params[0]).toBe(1);
          expect(params[1]).toBe('Meal planning');
          expect(params[2]).toBe('daughter-aeris');
          expect(params[3]).toBe('fast');
          expect(String(params[4])).toMatch(
            /^app:alex:conv:[0-9a-f-]{36}$/,
          );

          return Promise.resolve({
            rows: [
              {
                id: '3',
                user_id: '1',
                title: 'Meal planning',
                agent_id: 'daughter-aeris',
                openclaw_session_key: String(params[4]),
                status: 'active',
                archived_at: null,
                last_message_at: null,
                created_at: '2026-03-23T02:17:52.000Z',
                updated_at: '2026-03-23T02:17:52.000Z',
                model_preset: 'fast',
                mode: 'household',
              },
            ],
          });
        }),
    } satisfies Pick<DatabaseService, 'query'>;

    const repository = new ConversationsRepository(
      databaseServiceMock as unknown as DatabaseService,
    );

    await expect(
      repository.createConversation({
        userId: 1,
        title: 'Meal planning',
        modelPreset: 'fast',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 3,
        user_id: 1,
        title: 'Meal planning',
        agent_id: 'daughter-aeris',
        mode: 'household',
        model_preset: 'fast',
        status: 'active',
        archived_at: null,
        last_message_at: null,
        created_at: '2026-03-23T02:17:52.000000Z',
        updated_at: '2026-03-23T02:17:52.000000Z',
      }),
    );
  });

  it('maps conversation detail with Laravel-like timestamps and nested user shape', async () => {
    const databaseServiceMock = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: '3',
            user_id: '1',
            title: 'Meal planning',
            agent_id: 'aeris',
            openclaw_session_key: 'app:alex:conv:meal-planning',
            status: 'active',
            archived_at: null,
            last_message_at: '2026-03-23T02:00:01.000Z',
            created_at: '2026-03-23T02:17:52.000Z',
            updated_at: '2026-03-23T02:17:52.000Z',
            model_preset: 'fast',
            mode: 'private',
            user_name: 'Alex',
            user_slug: 'alex',
            user_avatar: null,
            user_memory_namespace: 'person:alex',
            user_default_agent_id: 'daughter-aeris',
            user_is_active: true,
            user_role: 'owner',
            user_pin_set_at: null,
            user_last_login_at: null,
            user_requires_pin: true,
            user_created_at: '2026-03-23T02:17:52.000Z',
            user_updated_at: '2026-03-23T02:17:52.000Z',
            user_has_pin: false,
          },
        ],
      }),
    } satisfies Pick<DatabaseService, 'query'>;

    const repository = new ConversationsRepository(
      databaseServiceMock as unknown as DatabaseService,
    );

    await expect(repository.findConversationById(3)).resolves.toEqual(
      readFixture('conversation-detail.json'),
    );
  });

  it('updates conversations and mirrors archive timestamp toggling', async () => {
    const databaseServiceMock = {
      query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
        expect(sql).toContain('UPDATE conversations');
        expect(sql).toContain('archived_at = CURRENT_TIMESTAMP');
        expect(params).toEqual(['Renamed', 'deep', 'archived', 3]);

        return Promise.resolve({
          rows: [
            {
              id: '3',
              user_id: '1',
              title: 'Renamed',
              agent_id: 'daughter-aeris',
              openclaw_session_key: 'app:alex:conv:meal-planning',
              status: 'archived',
              archived_at: '2026-03-24T02:17:52.000Z',
              last_message_at: '2026-03-23T02:00:01.000Z',
              created_at: '2026-03-23T02:17:52.000Z',
              updated_at: '2026-03-24T02:17:52.000Z',
              model_preset: 'deep',
              mode: 'household',
            },
          ],
        });
      }),
    } satisfies Pick<DatabaseService, 'query'>;

    const repository = new ConversationsRepository(
      databaseServiceMock as unknown as DatabaseService,
    );

    await expect(
      repository.updateConversation(3, {
        title: 'Renamed',
        modelPreset: 'deep',
        status: 'archived',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 3,
        title: 'Renamed',
        model_preset: 'deep',
        status: 'archived',
        archived_at: '2026-03-24T02:17:52.000000Z',
      }),
    );
  });

  it('maps conversation messages with Laravel-like timestamps and contract fields', async () => {
    const databaseServiceMock = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: '2',
            conversation_id: '3',
            role: 'user',
            content: 'Can you help me plan meals for next week?',
            model: null,
            metadata_json: {
              person_identity: 'person:alex',
              openclaw_session_key:
                'agent:daughter-aeris:person:alex:app:alex:conv:meal-planning',
              attachments: [],
            },
            source: 'app',
            channel: 'app',
            contract_event: 'message.inbound',
            channel_message_id: 'msg_fixture_1',
            person_identity: 'person:alex',
            agent_id: 'daughter-aeris',
            reply_to_message_id: null,
            sent_at: '2026-03-23T02:00:00.000Z',
            contract_json: {
              channel: 'app',
              channelMessageId: 'msg_fixture_1',
              conversationId: 'app:alex:conv:meal-planning',
              personIdentity: 'person:alex',
              profile: {
                name: 'Alex',
                slug: 'alex',
              },
              agentId: 'daughter-aeris',
              role: 'user',
              text: 'Can you help me plan meals for next week?',
              attachments: [],
              sentAt: '2026-03-23T10:00:00Z',
              metadata: {
                source: 'openclaw-family-app',
                uiConversationId: 3,
                openclawSessionKey:
                  'agent:daughter-aeris:person:alex:app:alex:conv:meal-planning',
                transportMode: 'bridge-compatible-app-channel',
              },
            },
            created_at: '2026-03-23T02:17:52.000Z',
            updated_at: '2026-03-23T02:17:52.000Z',
          },
          {
            id: '3',
            conversation_id: '3',
            role: 'assistant',
            content: 'Absolutely — here is a simple meal plan.',
            model: 'openai-codex/gpt-5.4',
            metadata_json: {
              person_identity: 'person:alex',
              openclaw_session_key:
                'agent:daughter-aeris:person:alex:app:alex:conv:meal-planning',
              openclaw_session_id: 'sess-fixture-1',
              usage: {
                total: 99,
              },
              transport: 'bridge-compatible-app-channel',
            },
            source: 'openclaw',
            channel: 'app',
            contract_event: 'message.outbound',
            channel_message_id: 'asst_fixture_1',
            person_identity: 'person:alex',
            agent_id: 'daughter-aeris',
            reply_to_message_id: 'msg_fixture_1',
            sent_at: '2026-03-23T02:00:01.000Z',
            contract_json: {
              channel: 'app',
              conversationId: 'app:alex:conv:meal-planning',
              personIdentity: 'person:alex',
              agentId: 'daughter-aeris',
              role: 'assistant',
              text: 'Absolutely — here is a simple meal plan.',
              messageId: 'asst_fixture_1',
              replyToMessageId: 'msg_fixture_1',
              completed: true,
              sentAt: '2026-03-23T10:00:01Z',
              metadata: {
                model: 'openai-codex/gpt-5.4',
                openclawSessionId: 'sess-fixture-1',
                usage: {
                  total: 99,
                },
                transportMode: 'bridge-compatible-app-channel',
              },
            },
            created_at: '2026-03-23T02:17:52.000Z',
            updated_at: '2026-03-23T02:17:52.000Z',
          },
        ],
      }),
    } satisfies Pick<DatabaseService, 'query'>;

    const repository = new ConversationsRepository(
      databaseServiceMock as unknown as DatabaseService,
    );

    await expect(repository.listConversationMessages(3)).resolves.toEqual(
      readFixture('messages-list.json'),
    );
  });

  it('persists a user message, stores finalized attachments in metadata, and touches last_message_at', async () => {
    const databaseServiceMock = {
      query: jest
        .fn()
        .mockImplementationOnce((sql: string, params: unknown[]) => {
          expect(sql).toContain('INSERT INTO messages');
          expect(params).toEqual([
            3,
            'hello from nest',
            {
              attachments: [
                {
                  id: 'att_1',
                  name: 'notes.txt',
                  mime_type: 'text/plain',
                  size_bytes: 12,
                  extension: 'txt',
                  category: 'text',
                  uploaded_at: '2026-03-24T00:00:00.000Z',
                  url: 'http://localhost:3001/storage/attachments/messages/3/notes.txt',
                  internal_url:
                    'http://127.0.0.1:3001/storage/attachments/messages/3/notes.txt',
                  text_excerpt: 'hello world',
                  text_content: 'hello world',
                  extraction_note: null,
                  path: 'attachments/messages/3/notes.txt',
                },
              ],
            },
          ]);

          return Promise.resolve({
            rows: [
              {
                id: '4',
                conversation_id: '3',
                role: 'user',
                content: 'hello from nest',
                model: null,
                metadata_json: params[2],
                source: 'app',
                channel: null,
                contract_event: null,
                channel_message_id: null,
                person_identity: null,
                agent_id: null,
                reply_to_message_id: null,
                sent_at: null,
                contract_json: null,
                created_at: '2026-03-24T02:17:52.000Z',
                updated_at: '2026-03-24T02:17:52.000Z',
              },
            ],
          });
        })
        .mockImplementationOnce((sql: string, params: unknown[]) => {
          expect(sql).toContain('UPDATE conversations');
          expect(params).toEqual([3, '2026-03-24T02:17:52.000000Z']);

          return Promise.resolve({
            rows: [
              {
                id: '3',
                user_id: '1',
                title: 'Meal planning',
                agent_id: 'aeris',
                openclaw_session_key: 'app:alex:conv:meal-planning',
                status: 'active',
                archived_at: null,
                last_message_at: '2026-03-24T02:17:52.000Z',
                created_at: '2026-03-23T02:17:52.000Z',
                updated_at: '2026-03-24T02:17:52.000Z',
                model_preset: 'auto',
                mode: 'household',
              },
            ],
          });
        }),
    } satisfies Pick<DatabaseService, 'query'>;

    const repository = new ConversationsRepository(
      databaseServiceMock as unknown as DatabaseService,
    );

    await expect(
      repository.createUserMessage({
        conversationId: 3,
        content: 'hello from nest',
        attachments: [
          {
            id: 'att_1',
            name: 'notes.txt',
            mime_type: 'text/plain',
            size_bytes: 12,
            extension: 'txt',
            category: 'text',
            uploaded_at: '2026-03-24T00:00:00.000Z',
            url: 'http://localhost:3001/storage/attachments/messages/3/notes.txt',
            internal_url:
              'http://127.0.0.1:3001/storage/attachments/messages/3/notes.txt',
            text_excerpt: 'hello world',
            text_content: 'hello world',
            extraction_note: null,
            path: 'attachments/messages/3/notes.txt',
          },
        ],
      }),
    ).resolves.toEqual({
      userMessage: expect.objectContaining({
        id: 4,
        role: 'user',
        content: 'hello from nest',
        metadata_json: {
          attachments: [
            expect.objectContaining({
              id: 'att_1',
              name: 'notes.txt',
            }),
          ],
        },
        source: 'app',
        created_at: '2026-03-24T02:17:52.000000Z',
      }),
      conversation: expect.objectContaining({
        id: 3,
        last_message_at: '2026-03-24T02:17:52.000000Z',
      }),
    });
  });
});
