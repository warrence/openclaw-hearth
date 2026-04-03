import { LoginDto } from './dto/login.dto';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import { SessionCookieService } from './session-cookie.service';
import { WebAuthnService } from './webauthn.service';
type ResponseWithHeader = {
    setHeader(name: string, value: string): unknown;
};
export declare class AuthController {
    private readonly authService;
    private readonly authRepository;
    private readonly sessionCookieService;
    private readonly webAuthnService;
    constructor(authService: AuthService, authRepository: AuthRepository, sessionCookieService: SessionCookieService, webAuthnService: WebAuthnService);
    login(body: LoginDto, response: ResponseWithHeader): Promise<AuthenticatedUser>;
    me(user: AuthenticatedUser): AuthenticatedUser;
    logout(response: ResponseWithHeader): {
        ok: true;
    };
    webAuthnRegisterOptions(userId: number, user: AuthenticatedUser): Promise<import("@simplewebauthn/server").PublicKeyCredentialCreationOptionsJSON>;
    webAuthnRegister(userId: number, body: unknown): Promise<{
        verified: boolean;
    }>;
    webAuthnLoginOptions(profileId: string): Promise<import("@simplewebauthn/server").PublicKeyCredentialRequestOptionsJSON>;
    webAuthnLogin(body: {
        profile_id: number;
        response: unknown;
    }, response: ResponseWithHeader): Promise<{
        id: number;
        name: string;
        slug: string;
        avatar: string | null;
        memory_namespace: string;
        default_agent_id: string | null;
        is_active: boolean;
        role: string;
        pin_set_at: string | null;
        last_login_at: string | null;
        requires_pin: boolean;
        created_at: string;
        updated_at: string;
        has_pin: boolean;
    }>;
    webAuthnListCredentials(userId: number): Promise<{
        id: number;
        credential_id: string;
        device_type: string | null;
        backed_up: boolean;
        created_at: Date;
    }[]>;
    webAuthnDeleteCredential(userId: number, credentialId: string): Promise<void>;
}
export {};
