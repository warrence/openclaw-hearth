import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthSessionMiddleware } from './auth-session.middleware';
import { OwnerAuthGuard } from './owner-auth.guard';
import { PinHashService } from './pin-hash.service';
import { PinHashVerifierService } from './pin-hash-verifier.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionCookieService } from './session-cookie.service';
import { UsersController } from './users.controller';
import { WebAuthnService } from './webauthn.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, UsersController],
  providers: [
    AuthRepository,
    AuthService,
    AuthSessionMiddleware,
    OwnerAuthGuard,
    PinHashService,
    PinHashVerifierService,
    SessionAuthGuard,
    SessionCookieService,
    WebAuthnService,
  ],
  exports: [
    AuthRepository,
    AuthSessionMiddleware,
    OwnerAuthGuard,
    PinHashService,
    SessionAuthGuard,
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthSessionMiddleware).forRoutes('*');
  }
}
