import { UnauthorizedException } from '@nestjs/common';

import { AuthController } from '../src/auth/auth.controller';
import { AuthRepository, UserAuthRecord } from '../src/auth/auth.repository';
import { AuthService } from '../src/auth/auth.service';
import { AuthSessionMiddleware } from '../src/auth/auth-session.middleware';
import { AuthenticatedRequest } from '../src/auth/auth.types';
import { PinHashVerifierService } from '../src/auth/pin-hash-verifier.service';
import { SessionAuthGuard } from '../src/auth/session-auth.guard';
import { SessionCookieService } from '../src/auth/session-cookie.service';

const baseUser: UserAuthRecord = {
  id: 7,
  name: 'Tester',
  slug: 'tester',
  avatar: null,
  memory_namespace: 'person:tester',
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

describe('Nest auth/session slice', () => {
  let users: Map<number, UserAuthRecord>;
  let authRepository: Pick<AuthRepository, 'findUserForAuth' | 'updateLastLoginAt'>;
  let authService: AuthService;
  let authController: AuthController;
  let authSessionMiddleware: AuthSessionMiddleware;
  let sessionCookieService: SessionCookieService;
  let sessionAuthGuard: SessionAuthGuard;
  let updateLastLoginAtMock: jest.Mock<Promise<void>, [number]>;

  beforeEach(() => {
    users = new Map([[baseUser.id, { ...baseUser }]]);
    updateLastLoginAtMock = jest.fn(async (userId: number) => {
      const user = users.get(userId);

      if (user) {
        user.last_login_at = '2026-03-24T00:00:00.000Z';
      }
    });
    authRepository = {
      findUserForAuth: jest.fn(async (userId: number) => users.get(userId) ?? null),
      updateLastLoginAt: updateLastLoginAtMock,
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
    authService = new AuthService(authRepository as AuthRepository, {
      verify: jest.fn(async (pin: string, hash: string) => hash === `hash:${pin}`),
    } as PinHashVerifierService);
    authController = new AuthController(authService, sessionCookieService);
    authSessionMiddleware = new AuthSessionMiddleware(
      authRepository as AuthRepository,
      sessionCookieService,
    );
    sessionAuthGuard = new SessionAuthGuard();
  });

  it('logs in, sets a session cookie, updates last_login_at, and never exposes pin_hash', async () => {
    const response = {
      setHeader: jest.fn(),
    };

    const user = await authController.login(
      {
        profile_id: 7,
        pin: '1234',
      },
      response,
    );

    expect(user).toMatchObject({
      id: 7,
      role: 'member',
      last_login_at: '2026-03-24T00:00:00.000Z',
      has_pin: true,
    });
    expect(user).not.toHaveProperty('pin_hash');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('hearth_test_session='),
    );
    expect(updateLastLoginAtMock).toHaveBeenCalledWith(7);
  });

  it('rejects inactive and unknown profiles with an honest 401', async () => {
    users.set(8, {
      ...baseUser,
      id: 8,
      is_active: false,
    });

    await expect(
      authController.login(
        {
          profile_id: 8,
          pin: '1234',
        },
        { setHeader: jest.fn() },
      ),
    ).rejects.toMatchObject({
      message: 'Profile not found or inactive.',
      status: 401,
    });

    await expect(
      authController.login(
        {
          profile_id: 99999,
          pin: '1234',
        },
        { setHeader: jest.fn() },
      ),
    ).rejects.toMatchObject({
      message: 'Profile not found or inactive.',
      status: 401,
    });
  });

  it('rejects wrong PINs and profiles without a PIN with an honest 401', async () => {
    users.set(9, {
      ...baseUser,
      id: 9,
      pin_hash: null,
      has_pin: false,
    });

    await expect(
      authController.login(
        {
          profile_id: 7,
          pin: '9999',
        },
        { setHeader: jest.fn() },
      ),
    ).rejects.toMatchObject({
      message: 'Invalid PIN.',
      status: 401,
    });

    await expect(
      authController.login(
        {
          profile_id: 9,
          pin: '1234',
        },
        { setHeader: jest.fn() },
      ),
    ).rejects.toMatchObject({
      message: 'Invalid PIN.',
      status: 401,
    });
  });

  it('returns 401 for GET /api/auth/me when unauthenticated', () => {
    const request = {} satisfies AuthenticatedRequest;

    expect(() => sessionAuthGuard.canActivate(createHttpContext(request))).toThrow(
      new UnauthorizedException('Unauthenticated.'),
    );
  });

  it('returns the current user for GET /api/auth/me when authenticated', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        cookie: sessionCookieService.createSessionCookie(7),
      },
    };

    await runMiddleware(authSessionMiddleware, request);

    expect(sessionAuthGuard.canActivate(createHttpContext(request))).toBe(true);
    expect(authController.me(request.authUser!)).toMatchObject({
      id: 7,
      role: 'member',
    });
    expect(authController.me(request.authUser!)).not.toHaveProperty('pin_hash');
  });

  it('logs out, clears the session cookie, and invalidates GET /api/auth/me', async () => {
    const authenticatedRequest: AuthenticatedRequest = {
      headers: {
        cookie: sessionCookieService.createSessionCookie(7),
      },
    };

    await runMiddleware(authSessionMiddleware, authenticatedRequest);
    expect(sessionAuthGuard.canActivate(createHttpContext(authenticatedRequest))).toBe(true);

    const logoutResponse = {
      setHeader: jest.fn(),
    };

    expect(authController.logout(logoutResponse)).toEqual({ ok: true });
    expect(logoutResponse.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('Max-Age=0'),
    );

    const loggedOutRequest: AuthenticatedRequest = {
      headers: {
        cookie: sessionCookieService.clearSessionCookie(),
      },
    };

    await runMiddleware(authSessionMiddleware, loggedOutRequest);

    expect(() => sessionAuthGuard.canActivate(createHttpContext(loggedOutRequest))).toThrow(
      new UnauthorizedException('Unauthenticated.'),
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
