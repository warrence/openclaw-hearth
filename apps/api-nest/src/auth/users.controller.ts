import { Controller, Get } from '@nestjs/common';

import { AuthRepository } from './auth.repository';
import { AuthenticatedUser } from './auth.types';

@Controller('api/users')
export class UsersController {
  constructor(private readonly authRepository: AuthRepository) {}

  @Get()
  listUsers(): Promise<AuthenticatedUser[]> {
    return this.authRepository.listActiveUsers();
  }
}
