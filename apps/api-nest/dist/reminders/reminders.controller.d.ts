import type { AuthenticatedUser } from '../auth/auth.types';
import { RemindersRepository } from './reminders.repository';
export declare class RemindersController {
    private readonly repository;
    constructor(repository: RemindersRepository);
    listReminders(userId: number, status: string | undefined, user: AuthenticatedUser): Promise<{
        id: number;
        user_id: number;
        message_text: string;
        fire_at: Date;
        status: string;
        critical: boolean;
        repeat_count: number;
        created_at: Date;
    }[]>;
    cancelReminder(id: number, user: AuthenticatedUser): Promise<{
        ok: boolean;
        id: number;
    }>;
}
