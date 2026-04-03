import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class OwnerAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
