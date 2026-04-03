import { DatabaseService } from '../database/database.service';
export type ProfileRecord = {
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
};
export type ProfileRecordWithPinHash = ProfileRecord & {
    pin_hash: string | null;
};
export type CreateProfileInput = {
    name: string;
    slug: string;
    avatar?: string | null;
    memory_namespace: string;
    default_agent_id: string | null;
    is_active: boolean;
    role: 'owner' | 'member';
};
export type UpdateProfileInput = Partial<{
    name: string;
    slug: string;
    avatar: string | null;
    default_agent_id: string | null;
    is_active: boolean;
    role: 'owner' | 'member';
}>;
export declare class ProfilesRepository {
    private readonly databaseService;
    constructor(databaseService: DatabaseService);
    listProfiles(): Promise<ProfileRecord[]>;
    findProfileById(profileId: number): Promise<ProfileRecordWithPinHash | null>;
    slugExists(slug: string, excludeProfileId?: number): Promise<boolean>;
    createProfile(input: CreateProfileInput): Promise<ProfileRecord>;
    updateProfile(profileId: number, input: UpdateProfileInput): Promise<ProfileRecord>;
    setPinHash(profileId: number, pinHash: string): Promise<ProfileRecord>;
    resetPin(profileId: number): Promise<void>;
    private mapRow;
    listProfileConversations(profileId: number): Promise<{
        id: number;
        openclaw_session_key: string | null;
    }[]>;
    deleteProfile(profileId: number): Promise<void>;
    private toProfileRecord;
    private toIsoString;
}
