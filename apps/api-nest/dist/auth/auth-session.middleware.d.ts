import { NestMiddleware } from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import { AuthenticatedRequest } from './auth.types';
import { SessionCookieService } from './session-cookie.service';
export declare class AuthSessionMiddleware implements NestMiddleware {
    private readonly authRepository;
    private readonly sessionCookieService;
    constructor(authRepository: AuthRepository, sessionCookieService: SessionCookieService);
    use(request: AuthenticatedRequest, _response: unknown, next: () => void): Promise<void>;
}
