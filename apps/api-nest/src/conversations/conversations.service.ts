import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ConversationAttachmentsService } from '../attachments/conversation-attachments.service';
import { AttachmentPayload } from '../attachments/attachments.types';
import { ConversationAssistantExecutionService } from './conversation-assistant-execution.service';
import {
  ConversationRecord,
  ConversationScope,
  ConversationsRepository,
  MessageRecord,
} from './conversations.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import {
  ConversationMessageStreamEvent,
  SendConversationMessageDto,
  SendConversationMessageResponse,
} from './dto/send-conversation-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import {
  detectImageIntent,
  ImageGenerationException,
  ImageGenerationService,
} from './image-generation.service';

export type PreparedConversationMessageStream = {
  conversation: ConversationRecord;
  persistedConversation: ConversationRecord;
  userMessage: MessageRecord;
  content: string;
  attachments: AttachmentPayload[];
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly repository: ConversationsRepository,
    private readonly conversationAttachmentsService: ConversationAttachmentsService,
    private readonly conversationAssistantExecutionService: ConversationAssistantExecutionService,
    private readonly imageGenerationService: ImageGenerationService,
  ) {}

  async listUserConversations(
    actorUserId: number,
    userId: number,
    query: ListConversationsQueryDto,
  ): Promise<ConversationRecord[]> {
    this.assertOwner(actorUserId, userId);

    return this.repository.listUserConversations({
      userId,
      scope: query.scope as ConversationScope | undefined,
      search: query.search,
      limit: query.limit,
    });
  }

  async getConversation(
    actorUserId: number,
    conversationId: number,
  ): Promise<ConversationRecord> {
    const conversation = await this.repository.findConversationById(conversationId);

    if (!conversation) {
      throw new NotFoundException();
    }

    this.assertOwner(actorUserId, conversation.user_id);

    return conversation;
  }

  async createConversation(
    actorUserId: number,
    userId: number,
    payload: CreateConversationDto,
  ): Promise<ConversationRecord> {
    this.assertOwner(actorUserId, userId);

    return this.repository.createConversation({
      userId,
      title: payload.title,
      agentId: payload.agent_id,
      modelPreset: payload.model_preset,
    });
  }

  async listConversationMessages(
    actorUserId: number,
    conversationId: number,
  ): Promise<MessageRecord[]> {
    const conversation = await this.repository.findConversationById(conversationId);

    if (!conversation) {
      throw new NotFoundException();
    }

    this.assertOwner(actorUserId, conversation.user_id);

    return this.repository.listConversationMessages(conversationId);
  }

  async sendConversationMessage(
    actorUserId: number,
    conversationId: number,
    payload: SendConversationMessageDto,
  ): Promise<SendConversationMessageResponse> {
    const prepared = await this.prepareConversationMessageStream(
      actorUserId,
      conversationId,
      payload,
    );

    return {
      user_message: prepared.userMessage,
      assistant_message: null,
      conversation: prepared.persistedConversation,
      runtime: {
        transport_mode: 'nest-local-persist',
        contract_shaped: false,
      },
    };
  }

  async prepareConversationMessageStream(
    actorUserId: number,
    conversationId: number,
    payload: SendConversationMessageDto,
  ): Promise<PreparedConversationMessageStream> {
    return this.persistConversationMessage(
      actorUserId,
      conversationId,
      payload,
    );
  }

  async executePreparedConversationMessageStream(
    prepared: PreparedConversationMessageStream,
    emit: (event: ConversationMessageStreamEvent) => void,
  ): Promise<void> {
    // All messages (including image gen/edit) go through Aeris via the native channel.
    // Aeris uses the image_generate tool and returns media via the callback payload.
    await this.conversationAssistantExecutionService.streamAssistantReply(
      prepared,
      emit,
    );
  }

  private async executeImageRequest(
    prepared: PreparedConversationMessageStream,
    intent: 'generate' | 'edit',
    emit: (event: ConversationMessageStreamEvent) => void,
  ): Promise<void> {
    const isEdit = intent === 'edit';
    const streamMode = isEdit ? 'image-edit' : 'image-generation';
    const placeholderLabel = isEdit ? 'Editing image…' : 'Generating image…';

    // Send placeholder with isGeneratingImage so the UI shows the right indicator
    emit({
      event: 'assistant.placeholder',
      data: {
        message: {
          id: `pending-image-${prepared.userMessage.id}`,
          role: 'assistant',
          content: placeholderLabel,
          created_at: new Date().toISOString(),
          metadata: { kind: streamMode },
        },
      },
    });

    emit({
      event: 'status',
      data: {
        state: 'running',
        label: placeholderLabel,
        elapsed_ms: 0,
        stream_mode: streamMode,
      },
    });

    const startedAt = Date.now();

    try {
      const result = isEdit
        ? await this.imageGenerationService.editForConversation(
            prepared.conversation.id,
            prepared.content,
            prepared.attachments,
          )
        : await this.imageGenerationService.generateForConversation(
            prepared.conversation.id,
            prepared.content,
          );

      // Persist assistant message with attachments in metadata_json
      const persisted = await this.repository.createAssistantMessage({
        conversationId: prepared.conversation.id,
        content: result.assistant_text,
        model: result.model,
        metadata: {
          attachments: result.attachments,
          image_generation: {
            provider: result.provider,
            size: result.size,
            quality: result.quality,
            operation: result.operation,
            revised_prompt: result.revised_prompt,
          },
        },
        messageId: `img_${randomUUID()}`,
        replyToMessageId:
          prepared.userMessage.channel_message_id ??
          `msg_${prepared.userMessage.id}`,
        sentAt: new Date().toISOString(),
      });

      const elapsedMs = Date.now() - startedAt;

      emit({
        event: 'assistant.message',
        data: {
          message: persisted.assistantMessage,
          text: persisted.assistantMessage.content,
          stream_mode: streamMode,
        },
      });

      emit({
        event: 'status',
        data: {
          state: 'completed',
          label: isEdit ? 'Edited image ready' : 'Image ready',
          elapsed_ms: elapsedMs,
          stream_mode: streamMode,
        },
      });

      emit({
        event: 'done',
        data: {
          conversation: persisted.conversation,
          assistant_message_id: persisted.assistantMessage.id,
          stream_mode: streamMode,
          partial_available: false,
        },
      });
    } catch (err) {
      const message =
        err instanceof ImageGenerationException
          ? err.message
          : 'Image request failed. Please try again.';

      emit({
        event: 'error',
        data: {
          message,
          elapsed_ms: Date.now() - startedAt,
          code: 'image_generation_failed',
        },
      });
    }
  }

  async updateConversation(
    actorUserId: number,
    conversationId: number,
    payload: UpdateConversationDto,
  ): Promise<ConversationRecord> {
    const conversation = await this.requireOwnedConversation(
      actorUserId,
      conversationId,
    );

    return this.repository.updateConversation(conversation.id, {
      title: payload.title,
      agentId: payload.agent_id,
      modelPreset: payload.model_preset,
      status: payload.status,
    });
  }

  async archiveConversation(
    actorUserId: number,
    conversationId: number,
  ): Promise<ConversationRecord> {
    const conversation = await this.requireOwnedConversation(
      actorUserId,
      conversationId,
    );

    return this.repository.updateConversation(conversation.id, {
      status: 'archived',
    });
  }

  async deleteConversation(
    actorUserId: number,
    conversationId: number,
  ): Promise<void> {
    const conversation = await this.requireOwnedConversation(
      actorUserId,
      conversationId,
    );

    // Delete OpenClaw session data (best-effort — don't fail the delete if this errors)
    try {
      await this.purgeOpenClawSession(conversation.openclaw_session_key, conversation.agent_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Hearth] Failed to purge OpenClaw session:', msg);
    }

    // Hard delete from DB
    await this.repository.deleteConversation(conversation.id);
  }

  private async purgeOpenClawSession(
    sessionKey: string,
    agentId: string,
  ): Promise<void> {
    const home = process.env.HOME ?? '/root';
    const agentSlug = agentId?.trim().toLowerCase() || 'daughter-aeris';
    const sessionsDir = join(home, '.openclaw', 'agents', agentSlug, 'sessions');
    const sessionsJsonPath = join(sessionsDir, 'sessions.json');

    // Build the full OpenClaw session store key
    const storeKey = sessionKey.toLowerCase().startsWith('agent:')
      ? sessionKey.toLowerCase()
      : `agent:${agentSlug}:${sessionKey}`.toLowerCase();

    let sessions: Record<string, { sessionId?: string }> = {};
    try {
      const raw = await readFile(sessionsJsonPath, 'utf8');
      sessions = JSON.parse(raw);
    } catch {
      return; // No sessions file — nothing to clean up
    }

    const entry = sessions[storeKey];
    if (!entry) return; // Key not found — nothing to do

    const sessionId = entry.sessionId;

    // Remove from sessions.json
    delete sessions[storeKey];
    await writeFile(sessionsJsonPath, JSON.stringify(sessions, null, 2), 'utf8');

    // Delete the .jsonl transcript file
    if (sessionId) {
      const transcriptPath = join(sessionsDir, `${sessionId}.jsonl`);
      try { await unlink(transcriptPath); } catch { /* already gone */ }
    }
  }

  async restoreConversation(
    actorUserId: number,
    conversationId: number,
  ): Promise<ConversationRecord> {
    const conversation = await this.requireOwnedConversation(
      actorUserId,
      conversationId,
    );

    return this.repository.updateConversation(conversation.id, {
      status: 'active',
    });
  }

  private async requireOwnedConversation(
    actorUserId: number,
    conversationId: number,
  ): Promise<ConversationRecord> {
    const conversation = await this.repository.findConversationById(conversationId);

    if (!conversation) {
      throw new NotFoundException();
    }

    this.assertOwner(actorUserId, conversation.user_id);

    return conversation;
  }

  private assertOwner(actorUserId: number, ownerUserId: number | string): void {
    if (actorUserId !== Number.parseInt(String(ownerUserId), 10)) {
      throw new ForbiddenException();
    }
  }

  private async persistConversationMessage(
    actorUserId: number,
    conversationId: number,
    payload: SendConversationMessageDto,
  ): Promise<PreparedConversationMessageStream> {
    const conversation = await this.requireOwnedConversation(
      actorUserId,
      conversationId,
    );

    const content = payload.content?.trim() ?? '';
    const attachmentTokens = payload.attachments ?? [];

    if (content === '' && attachmentTokens.length === 0) {
      throw new UnprocessableEntityException({
        message: 'A message or at least one attachment is required.',
        errors: {
          content: ['A message or at least one attachment is required.'],
        },
      });
    }

    let attachments: AttachmentPayload[] = [];

    if (attachmentTokens.length > 0) {
      try {
        attachments = await this.conversationAttachmentsService.finalizeUploads(
          actorUserId,
          conversationId,
          attachmentTokens,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Attachment finalization failed.';

        throw new UnprocessableEntityException({
          message,
          errors: {
            attachments: [message],
          },
        });
      }
    }

    const result = await this.repository.createUserMessage({
      conversationId,
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    return {
      conversation,
      persistedConversation: result.conversation,
      userMessage: result.userMessage,
      content,
      attachments,
    };
  }
}
