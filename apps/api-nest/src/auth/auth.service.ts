import { Injectable, UnauthorizedException } from '@nestjs/common';

import { AuthRepository } from './auth.repository';
import { AuthenticatedUser } from './auth.types';
import { PinHashVerifierService } from './pin-hash-verifier.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly pinHashVerifierService: PinHashVerifierService,
  ) {}

  async login(profileId: number, pin: string): Promise<AuthenticatedUser> {
    const user = await this.authRepository.findUserForAuth(profileId);

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Profile not found or inactive.');
    }

    if (
      !user.pin_hash ||
      !(await this.pinHashVerifierService.verify(pin, user.pin_hash))
    ) {
      throw new UnauthorizedException('Invalid PIN.');
    }

    await this.authRepository.updateLastLoginAt(user.id);

    const refreshedUser = await this.authRepository.findUserForAuth(user.id);

    if (!refreshedUser) {
      throw new UnauthorizedException('Profile not found or inactive.');
    }

    const { pin_hash: _pinHash, ...authUser } = refreshedUser;

    return authUser;
  }
}
