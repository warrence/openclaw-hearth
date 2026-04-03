import { ConversationAssistantExecutionService } from './conversation-assistant-execution.service';
import { HearthAppOutboundEvent } from './hearth-channel.types';
export declare class HearthChannelCallbackController {
    private readonly executionService;
    constructor(executionService: ConversationAssistantExecutionService);
    handleCallback(token: string, body: HearthAppOutboundEvent): Promise<{
        ok: boolean;
    }>;
}
