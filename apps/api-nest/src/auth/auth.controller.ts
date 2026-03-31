import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from './current-user.decorator';
import { CurrentUserId } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionCookieService } from './session-cookie.service';
import { WebAuthnService } from './webauthn.service';

type ResponseWithHeader = {
  setHeader(name: string, value: string): unknown;
};

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authRepository: AuthRepository,
    private readonly sessionCookieService: SessionCookieService,
    private readonly webAuthnService: WebAuthnService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: ResponseWithHeader,
  ): Promise<AuthenticatedUser> {
    const user = await this.authService.login(body.profile_id, body.pin);

    response.setHeader(
      'Set-Cookie',
      this.sessionCookieService.createSessionCookie(user.id),
    );

    return user;
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @Res({ passthrough: true }) response: ResponseWithHeader,
  ): { ok: true } {
    response.setHeader(
      'Set-Cookie',
      this.sessionCookieService.clearSessionCookie(),
    );

    return { ok: true };
  }

  // ── WebAuthn ────────────────────────────────────────────────────────────────

  @Post('webauthn/register-options')
  @UseGuards(SessionAuthGuard)
  async webAuthnRegisterOptions(
    @CurrentUserId() userId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.webAuthnService.getRegistrationOptions(userId, user.name);
  }

  @Post('webauthn/register')
  @UseGuards(SessionAuthGuard)
  async webAuthnRegister(
    @CurrentUserId() userId: number,
    @Body() body: unknown,
  ) {
    return this.webAuthnService.verifyRegistration(userId, body);
  }

  @Get('webauthn/login-options')
  async webAuthnLoginOptions(@Query('profile_id') profileId: string) {
    const id = Number.parseInt(profileId, 10);
    if (!id) throw new BadRequestException('profile_id is required');
    const user = await this.authRepository.findUserForAuth(id);
    if (!user || !user.is_active) throw new UnauthorizedException('Profile not found.');
    return this.webAuthnService.getAuthenticationOptions(user.id);
  }

  @Post('webauthn/login')
  @HttpCode(HttpStatus.OK)
  async webAuthnLogin(
    @Body() body: { profile_id: number; response: unknown },
    @Res({ passthrough: true }) response: ResponseWithHeader,
  ) {
    const user = await this.authRepository.findUserForAuth(body.profile_id);
    if (!user || !user.is_active) throw new UnauthorizedException('Profile not found.');
    await this.webAuthnService.verifyAuthentication(user.id, body.response);
    await this.authRepository.updateLastLoginAt(user.id);
    const refreshed = await this.authRepository.findUserForAuth(user.id);
    if (!refreshed) throw new UnauthorizedException('Profile not found.');
    const { pin_hash: _ph, ...authUser } = refreshed;
    response.setHeader(
      'Set-Cookie',
      this.sessionCookieService.createSessionCookie(authUser.id),
    );
    return authUser;
  }

  @Get('webauthn/credentials')
  @UseGuards(SessionAuthGuard)
  async webAuthnListCredentials(@CurrentUserId() userId: number) {
    return this.webAuthnService.listCredentials(userId);
  }

  @Delete('webauthn/credentials/:credentialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionAuthGuard)
  async webAuthnDeleteCredential(
    @CurrentUserId() userId: number,
    @Param('credentialId') credentialId: string,
  ): Promise<void> {
    await this.webAuthnService.deleteCredential(userId, credentialId);
  }
}
