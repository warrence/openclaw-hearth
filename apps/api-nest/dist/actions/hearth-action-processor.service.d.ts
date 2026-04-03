import { ConversationsRepository } from '../conversations/conversations.repository';
import { RemindersService } from '../reminders/reminders.service';
import { RemindersRepository } from '../reminders/reminders.repository';
import type { HearthAction } from './hearth-action.types';
export declare class HearthActionProcessorService {
    private readonly remindersService;
    private readonly remindersRepository;
    private readonly conversationsRepository;
    private readonly logger;
    constructor(remindersService: RemindersService, remindersRepository: RemindersRepository, conversationsRepository: ConversationsRepository);
    parseActions(text: string): {
        cleanedText: string;
        actions: HearthAction[];
    };
    processActions(actions: HearthAction[], context: {
        userId: number;
        conversationId: number;
        messageId: string;
    }): Promise<void>;
    private dispatchAction;
    private handleReminder;
    private detectCriticalFromText;
    private handleListReminders;
    private handleCancelReminder;
}
