import { OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
export type ReminderRecord = {
    id: number;
    user_id: number;
    conversation_id: number;
    message_text: string;
    fire_at: Date;
    status: string;
    source_message_id: string | null;
    error: string | null;
    created_at: Date;
    fired_at: Date | null;
    critical: boolean;
    repeat_count: number;
    acknowledged_at: Date | null;
};
export declare class RemindersRepository implements OnModuleInit {
    private readonly db;
    constructor(db: DatabaseService);
    onModuleInit(): Promise<void>;
    createReminder(params: {
        userId: number;
        conversationId: number;
        messageText: string;
        fireAt: Date;
        sourceMessageId?: string;
        critical?: boolean;
    }): Promise<ReminderRecord>;
    findDueReminders(): Promise<ReminderRecord[]>;
    markFired(id: number): Promise<void>;
    markFailed(id: number, error: string): Promise<void>;
    findUnacknowledgedCritical(): Promise<ReminderRecord[]>;
    incrementRepeatCount(id: number): Promise<void>;
    markAcknowledged(id: number): Promise<void>;
    listReminders(params: {
        userId?: number;
        status?: string;
    }): Promise<ReminderRecord[]>;
    cancelReminder(id: number, userId?: number): Promise<boolean>;
    hasUserRepliedSince(conversationId: number, sinceDate: Date | string): Promise<boolean>;
}
