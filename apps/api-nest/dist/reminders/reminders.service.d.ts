import { OutboundMessageService } from '../conversations/outbound-message.service';
import { RemindersRepository } from './reminders.repository';
export declare class RemindersService {
    private readonly repository;
    private readonly outboundMessageService;
    private readonly logger;
    constructor(repository: RemindersRepository, outboundMessageService: OutboundMessageService);
    scheduleReminder(params: {
        userId: number;
        conversationId: number;
        messageText: string;
        fireAt: Date;
        sourceMessageId?: string;
        critical?: boolean;
    }): Promise<void>;
    processDue(): Promise<void>;
    processCriticalRepeats(): Promise<void>;
    private getCriticalConfig;
    parseReminderFromText(text: string, _conversationSessionKey: string): {
        fireAt: Date;
        reminderText: string;
    } | null;
    private parseHour;
}
