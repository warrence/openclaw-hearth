import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class OwnerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.authUser;

    if (!user) {
      throw new UnauthorizedException('Unauthenticated.');
    }

    if (user.role !== 'owner') {
      throw new ForbiddenException('Owner access required.');
    }

    return true;
  }
}
