import { Injectable, NestMiddleware } from '@nestjs/common';

import { AuthRepository } from './auth.repository';
import { AuthenticatedRequest } from './auth.types';
import { SessionCookieService } from './session-cookie.service';

@Injectable()
export class AuthSessionMiddleware implements NestMiddleware {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  async use(request: AuthenticatedRequest, _response: unknown, next: () => void): Promise<void> {
    const userId = this.sessionCookieService.readUserIdFromCookieHeader(
      request.headers?.cookie,
    );

    if (userId) {
      const user = await this.authRepository.findUserForAuth(userId);

      if (user?.is_active) {
        const { pin_hash: _pinHash, ...authUser } = user;
        request.authUser = authUser;
      }
    }

    next();
  }
}
