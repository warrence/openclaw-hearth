import { AuthRepository } from './auth.repository';
import { AuthenticatedUser } from './auth.types';
import { PinHashVerifierService } from './pin-hash-verifier.service';
export declare class AuthService {
    private readonly authRepository;
    private readonly pinHashVerifierService;
    constructor(authRepository: AuthRepository, pinHashVerifierService: PinHashVerifierService);
    login(profileId: number, pin: string): Promise<AuthenticatedUser>;
}
