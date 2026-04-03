import { ConversationsRepository } from '../conversations/conversations.repository';
import { AttachmentsService, UploadedFileLike } from './attachments.service';
import { TemporaryAttachmentPayload } from './attachments.types';
export declare class ConversationAttachmentsService {
    private readonly conversationsRepository;
    private readonly attachmentsService;
    constructor(conversationsRepository: ConversationsRepository, attachmentsService: AttachmentsService);
    uploadAttachment(actorUserId: number, conversationId: number, file?: UploadedFileLike): Promise<TemporaryAttachmentPayload>;
    finalizeUploads(actorUserId: number, conversationId: number, tokens: string[]): Promise<import("./attachments.types").AttachmentPayload[]>;
    private requireOwnedConversation;
}
