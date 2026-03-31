import { UnauthorizedException } from '@nestjs/common';

import { AuthRepository, UserAuthRecord } from '../src/auth/auth.repository';
import { AuthSessionMiddleware } from '../src/auth/auth-session.middleware';
import { AuthenticatedRequest } from '../src/auth/auth.types';
import { SessionAuthGuard } from '../src/auth/session-auth.guard';
import { SessionCookieService } from '../src/auth/session-cookie.service';
import { ConversationMessageStreamingService } from '../src/conversations/conversation-message-streaming.service';
import { ConversationsController } from '../src/conversations/conversations.controller';
import { ConversationsService } from '../src/conversations/conversations.service';

const authUser: UserAuthRecord = {
  id: 1,
  name: 'Conversation Tester',
  slug: 'conversation-tester',
  avatar: null,
  memory_namespace: 'person:conversation-tester',
  default_agent_id: null,
  is_active: true,
  role: 'member',
  pin_hash: 'hash:1234',
  pin_set_at: '2026-03-23T00:00:00.000Z',
  last_login_at: null,
  requires_pin: true,
  created_at: '2026-03-20T00:00:00.000Z',
  updated_at: '2026-03-20T00:00:00.000Z',
  has_pin: true,
};

describe('Migrated conversation route auth protection', () => {
  let conversationsController: ConversationsController;
  let conversationsServiceMock: {
    listUserConversations: jest.Mock;
  };
  let authSessionMiddleware: AuthSessionMiddleware;
  let sessionCookieService: SessionCookieService;
  let sessionAuthGuard: SessionAuthGuard;

  beforeEach(() => {
    conversationsServiceMock = {
      listUserConversations: jest.fn().mockResolvedValue([]),
    };
    sessionCookieService = new SessionCookieService({
      getOrThrow: (key: string) => {
        if (key !== 'auth') {
          throw new Error(`Unexpected config lookup: ${key}`);
        }

        return {
          sessionSecret: 'test-session-secret-1234',
          sessionCookieName: 'hearth_test_session',
          sessionCookieSecure: false,
          sessionMaxAgeSeconds: 3600,
        };
      },
    } as never);
    authSessionMiddleware = new AuthSessionMiddleware(
      {
        findUserForAuth: jest.fn(async (userId: number) =>
          userId === authUser.id ? authUser : null,
        ),
      } as unknown as AuthRepository,
      sessionCookieService,
    );
    sessionAuthGuard = new SessionAuthGuard();
    conversationsController = new ConversationsController(
      conversationsServiceMock as unknown as ConversationsService,
      {
        startSse: jest.fn(),
        writeEvent: jest.fn(),
        endSse: jest.fn(),
      } as unknown as ConversationMessageStreamingService,
    );
  });

  it('requires a valid Nest session cookie for migrated conversation routes', async () => {
    const unauthenticatedRequest = {} satisfies AuthenticatedRequest;

    expect(() =>
      sessionAuthGuard.canActivate(createHttpContext(unauthenticatedRequest)),
    ).toThrow(new UnauthorizedException('Unauthenticated.'));

    const authenticatedRequest: AuthenticatedRequest = {
      headers: {
        cookie: sessionCookieService.createSessionCookie(1),
      },
    };

    await runMiddleware(authSessionMiddleware, authenticatedRequest);

    expect(
      sessionAuthGuard.canActivate(createHttpContext(authenticatedRequest)),
    ).toBe(true);

    await expect(
      conversationsController.listUserConversations(
        authenticatedRequest.authUser!.id,
        1,
        {},
      ),
    ).resolves.toEqual([]);

    expect(conversationsServiceMock.listUserConversations).toHaveBeenCalledWith(
      1,
      1,
      {},
    );
  });
});

function createHttpContext(request: AuthenticatedRequest) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

async function runMiddleware(
  middleware: AuthSessionMiddleware,
  request: AuthenticatedRequest,
): Promise<void> {
  await new Promise<void>((resolve) => {
    void middleware.use(request, {}, resolve);
  });
}
