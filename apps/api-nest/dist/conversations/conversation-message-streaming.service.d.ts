import { ConversationMessageStreamEvent } from './dto/send-conversation-message.dto';
export declare class ConversationMessageStreamingService {
    startSse(res: {
        writeHead(statusCode: number, headers: Record<string, string>): unknown;
    }): void;
    writeEvent(res: {
        write(chunk: string): unknown;
    }, event: ConversationMessageStreamEvent): void;
    endSse(res: {
        end(): unknown;
    }): void;
    private serializeEvent;
}
