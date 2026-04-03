export interface ProfileCleanupOptions {
    profileId: number;
    sessionKeys: string[];
    conversationIds: (string | number)[];
}
export declare class ProfileCleanupService {
    private readonly logger;
    private get agentStorePath();
    private get storagePath();
    cleanupProfileData(options: ProfileCleanupOptions): Promise<void>;
    private cleanupOpenClawSessions;
    private cleanupAgentSessions;
    private cleanupStorageFiles;
}
