import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ConversationRecord,
  ConversationsRepository,
} from '../conversations/conversations.repository';
import { AttachmentsService, UploadedFileLike } from './attachments.service';
import { TemporaryAttachmentPayload } from './attachments.types';

@Injectable()
export class ConversationAttachmentsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  async uploadAttachment(
    actorUserId: number,
    conversationId: number,
    file?: UploadedFileLike,
  ): Promise<TemporaryAttachmentPayload> {
    await this.requireOwnedConversation(actorUserId, conversationId);

    return this.attachmentsService.storeTemporaryUpload(conversationId, file);
  }

  async finalizeUploads(
    actorUserId: number,
    conversationId: number,
    tokens: string[],
  ) {
    await this.requireOwnedConversation(actorUserId, conversationId);

    return this.attachmentsService.finalizeUploads(actorUserId, conversationId, tokens);
  }

  private async requireOwnedConversation(
    actorUserId: number,
    conversationId: number,
  ): Promise<ConversationRecord> {
    const conversation =
      await this.conversationsRepository.findConversationById(conversationId);

    if (!conversation) {
      throw new NotFoundException();
    }

    if (actorUserId !== Number.parseInt(String(conversation.user_id), 10)) {
      throw new ForbiddenException();
    }

    return conversation;
  }
}
