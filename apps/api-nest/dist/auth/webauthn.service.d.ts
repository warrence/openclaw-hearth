import { DatabaseService } from '../database/database.service';
export declare class WebAuthnService {
    private readonly db;
    private readonly rpID;
    private readonly origin;
    private readonly rpName;
    constructor(db: DatabaseService);
    ensureTable(): Promise<void>;
    getRegistrationOptions(userId: number, userName: string): Promise<import("@simplewebauthn/server").PublicKeyCredentialCreationOptionsJSON>;
    verifyRegistration(userId: number, body: unknown): Promise<{
        verified: boolean;
    }>;
    getAuthenticationOptions(userId: number): Promise<import("@simplewebauthn/server").PublicKeyCredentialRequestOptionsJSON>;
    verifyAuthentication(userId: number, body: unknown): Promise<{
        verified: boolean;
    }>;
    listCredentials(userId: number): Promise<{
        id: number;
        credential_id: string;
        device_type: string | null;
        backed_up: boolean;
        created_at: Date;
    }[]>;
    deleteCredential(userId: number, credentialId: string): Promise<void>;
}
