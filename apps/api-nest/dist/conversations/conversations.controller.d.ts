import { ConversationsService } from './conversations.service';
import { ConversationRecord, MessageRecord } from './conversations.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { SendConversationMessageDto, SendConversationMessageResponse } from './dto/send-conversation-message.dto';
import { ConversationMessageStreamingService } from './conversation-message-streaming.service';
import { ConversationStreamRegistryService } from './conversation-stream-registry.service';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConfigService } from '@nestjs/config';
export declare class ConversationsController {
    private readonly conversationsService;
    private readonly conversationMessageStreamingService;
    private readonly streamRegistry;
    private readonly configService;
    constructor(conversationsService: ConversationsService, conversationMessageStreamingService: ConversationMessageStreamingService, streamRegistry: ConversationStreamRegistryService, configService: ConfigService);
    listUserConversations(actorUserId: number, userId: number, query: ListConversationsQueryDto): Promise<ConversationRecord[]>;
    getConversation(actorUserId: number, conversationId: number): Promise<ConversationRecord>;
    createConversation(actorUserId: number, userId: number, body: CreateConversationDto): Promise<ConversationRecord>;
    listConversationMessages(actorUserId: number, conversationId: number): Promise<MessageRecord[]>;
    sendConversationMessage(actorUserId: number, conversationId: number, body: SendConversationMessageDto, res: {
        writeHead(statusCode: number, headers: Record<string, string>): unknown;
        write(chunk: string): unknown;
        end(): unknown;
    }): Promise<SendConversationMessageResponse | void>;
    updateConversation(actorUserId: number, conversationId: number, body: UpdateConversationDto): Promise<ConversationRecord>;
    abortConversationReply(conversationId: number): Promise<{
        ok: boolean;
        cancelled: boolean;
        agentStopped: boolean;
    }>;
    archiveConversation(actorUserId: number, conversationId: number): Promise<ConversationRecord>;
    restoreConversation(actorUserId: number, conversationId: number): Promise<ConversationRecord>;
    deleteConversation(actorUserId: number, conversationId: number): Promise<void>;
}
