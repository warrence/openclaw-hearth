import { ConversationAttachmentsService } from '../attachments/conversation-attachments.service';
import { AttachmentPayload } from '../attachments/attachments.types';
import { ConversationAssistantExecutionService } from './conversation-assistant-execution.service';
import { ConversationRecord, ConversationsRepository, MessageRecord } from './conversations.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ConversationMessageStreamEvent, SendConversationMessageDto, SendConversationMessageResponse } from './dto/send-conversation-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ImageGenerationService } from './image-generation.service';
export type PreparedConversationMessageStream = {
    conversation: ConversationRecord;
    persistedConversation: ConversationRecord;
    userMessage: MessageRecord;
    content: string;
    attachments: AttachmentPayload[];
};
export declare class ConversationsService {
    private readonly repository;
    private readonly conversationAttachmentsService;
    private readonly conversationAssistantExecutionService;
    private readonly imageGenerationService;
    constructor(repository: ConversationsRepository, conversationAttachmentsService: ConversationAttachmentsService, conversationAssistantExecutionService: ConversationAssistantExecutionService, imageGenerationService: ImageGenerationService);
    listUserConversations(actorUserId: number, userId: number, query: ListConversationsQueryDto): Promise<ConversationRecord[]>;
    getConversation(actorUserId: number, conversationId: number): Promise<ConversationRecord>;
    createConversation(actorUserId: number, userId: number, payload: CreateConversationDto): Promise<ConversationRecord>;
    listConversationMessages(actorUserId: number, conversationId: number): Promise<MessageRecord[]>;
    sendConversationMessage(actorUserId: number, conversationId: number, payload: SendConversationMessageDto): Promise<SendConversationMessageResponse>;
    prepareConversationMessageStream(actorUserId: number, conversationId: number, payload: SendConversationMessageDto): Promise<PreparedConversationMessageStream>;
    executePreparedConversationMessageStream(prepared: PreparedConversationMessageStream, emit: (event: ConversationMessageStreamEvent) => void): Promise<void>;
    private executeImageRequest;
    updateConversation(actorUserId: number, conversationId: number, payload: UpdateConversationDto): Promise<ConversationRecord>;
    archiveConversation(actorUserId: number, conversationId: number): Promise<ConversationRecord>;
    deleteConversation(actorUserId: number, conversationId: number): Promise<void>;
    private purgeOpenClawSession;
    restoreConversation(actorUserId: number, conversationId: number): Promise<ConversationRecord>;
    private requireOwnedConversation;
    private assertOwner;
    private persistConversationMessage;
}
