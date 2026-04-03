import { AuthRepository } from './auth.repository';
import { AuthenticatedUser } from './auth.types';
export declare class UsersController {
    private readonly authRepository;
    constructor(authRepository: AuthRepository);
    listUsers(): Promise<AuthenticatedUser[]>;
}
