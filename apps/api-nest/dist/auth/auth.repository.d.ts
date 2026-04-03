import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from './auth.types';
export type UserAuthRecord = AuthenticatedUser & {
    pin_hash: string | null;
};
export declare class AuthRepository {
    private readonly databaseService;
    constructor(databaseService: DatabaseService);
    listActiveUsers(): Promise<AuthenticatedUser[]>;
    findUserForAuth(userId: number): Promise<UserAuthRecord | null>;
    updateLastLoginAt(userId: number): Promise<void>;
    private mapUserRow;
    private toAuthenticatedUser;
    private toIsoString;
}
