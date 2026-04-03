import { UploadedFileLike } from './attachments.service';
import { ConversationAttachmentsService } from './conversation-attachments.service';
export declare class AttachmentsController {
    private readonly conversationAttachmentsService;
    constructor(conversationAttachmentsService: ConversationAttachmentsService);
    uploadAttachment(actorUserId: number, conversationId: number, file?: UploadedFileLike): Promise<{
        attachment: Record<string, unknown>;
    }>;
}
