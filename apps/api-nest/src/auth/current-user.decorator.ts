import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedRequest, AuthenticatedUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.authUser;
  },
);

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.authUser?.id;
  },
);
