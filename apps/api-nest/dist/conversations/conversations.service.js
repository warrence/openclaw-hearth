"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const conversation_attachments_service_1 = require("../attachments/conversation-attachments.service");
const conversation_assistant_execution_service_1 = require("./conversation-assistant-execution.service");
const conversations_repository_1 = require("./conversations.repository");
const image_generation_service_1 = require("./image-generation.service");
let ConversationsService = class ConversationsService {
    repository;
    conversationAttachmentsService;
    conversationAssistantExecutionService;
    imageGenerationService;
    constructor(repository, conversationAttachmentsService, conversationAssistantExecutionService, imageGenerationService) {
        this.repository = repository;
        this.conversationAttachmentsService = conversationAttachmentsService;
        this.conversationAssistantExecutionService = conversationAssistantExecutionService;
        this.imageGenerationService = imageGenerationService;
    }
    async listUserConversations(actorUserId, userId, query) {
        this.assertOwner(actorUserId, userId);
        return this.repository.listUserConversations({
            userId,
            scope: query.scope,
            search: query.search,
            limit: query.limit,
        });
    }
    async getConversation(actorUserId, conversationId) {
        const conversation = await this.repository.findConversationById(conversationId);
        if (!conversation) {
            throw new common_1.NotFoundException();
        }
        this.assertOwner(actorUserId, conversation.user_id);
        return conversation;
    }
    async createConversation(actorUserId, userId, payload) {
        this.assertOwner(actorUserId, userId);
        return this.repository.createConversation({
            userId,
            title: payload.title,
            agentId: payload.agent_id,
            modelPreset: payload.model_preset,
        });
    }
    async listConversationMessages(actorUserId, conversationId) {
        const conversation = await this.repository.findConversationById(conversationId);
        if (!conversation) {
            throw new common_1.NotFoundException();
        }
        this.assertOwner(actorUserId, conversation.user_id);
        return this.repository.listConversationMessages(conversationId);
    }
    async sendConversationMessage(actorUserId, conversationId, payload) {
        const prepared = await this.prepareConversationMessageStream(actorUserId, conversationId, payload);
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
    async prepareConversationMessageStream(actorUserId, conversationId, payload) {
        return this.persistConversationMessage(actorUserId, conversationId, payload);
    }
    async executePreparedConversationMessageStream(prepared, emit) {
        await this.conversationAssistantExecutionService.streamAssistantReply(prepared, emit);
    }
    async executeImageRequest(prepared, intent, emit) {
        const isEdit = intent === 'edit';
        const streamMode = isEdit ? 'image-edit' : 'image-generation';
        const placeholderLabel = isEdit ? 'Editing image…' : 'Generating image…';
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
                ? await this.imageGenerationService.editForConversation(prepared.conversation.id, prepared.content, prepared.attachments)
                : await this.imageGenerationService.generateForConversation(prepared.conversation.id, prepared.content);
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
                messageId: `img_${(0, node_crypto_1.randomUUID)()}`,
                replyToMessageId: prepared.userMessage.channel_message_id ??
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
        }
        catch (err) {
            const message = err instanceof image_generation_service_1.ImageGenerationException
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
    async updateConversation(actorUserId, conversationId, payload) {
        const conversation = await this.requireOwnedConversation(actorUserId, conversationId);
        return this.repository.updateConversation(conversation.id, {
            title: payload.title,
            agentId: payload.agent_id,
            modelPreset: payload.model_preset,
            status: payload.status,
        });
    }
    async archiveConversation(actorUserId, conversationId) {
        const conversation = await this.requireOwnedConversation(actorUserId, conversationId);
        return this.repository.updateConversation(conversation.id, {
            status: 'archived',
        });
    }
    async deleteConversation(actorUserId, conversationId) {
        const conversation = await this.requireOwnedConversation(actorUserId, conversationId);
        try {
            await this.purgeOpenClawSession(conversation.openclaw_session_key, conversation.agent_id);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn('[Hearth] Failed to purge OpenClaw session:', msg);
        }
        await this.repository.deleteConversation(conversation.id);
    }
    async purgeOpenClawSession(sessionKey, agentId) {
        const home = process.env.HOME ?? '/root';
        const agentSlug = agentId?.trim().toLowerCase() || 'main';
        const sessionsDir = (0, node_path_1.join)(home, '.openclaw', 'agents', agentSlug, 'sessions');
        const sessionsJsonPath = (0, node_path_1.join)(sessionsDir, 'sessions.json');
        const storeKey = sessionKey.toLowerCase().startsWith('agent:')
            ? sessionKey.toLowerCase()
            : `agent:${agentSlug}:${sessionKey}`.toLowerCase();
        let sessions = {};
        try {
            const raw = await (0, promises_1.readFile)(sessionsJsonPath, 'utf8');
            sessions = JSON.parse(raw);
        }
        catch {
            return;
        }
        const entry = sessions[storeKey];
        if (!entry)
            return;
        const sessionId = entry.sessionId;
        delete sessions[storeKey];
        await (0, promises_1.writeFile)(sessionsJsonPath, JSON.stringify(sessions, null, 2), 'utf8');
        if (sessionId) {
            const transcriptPath = (0, node_path_1.join)(sessionsDir, `${sessionId}.jsonl`);
            try {
                await (0, promises_1.unlink)(transcriptPath);
            }
            catch { }
        }
    }
    async restoreConversation(actorUserId, conversationId) {
        const conversation = await this.requireOwnedConversation(actorUserId, conversationId);
        return this.repository.updateConversation(conversation.id, {
            status: 'active',
        });
    }
    async requireOwnedConversation(actorUserId, conversationId) {
        const conversation = await this.repository.findConversationById(conversationId);
        if (!conversation) {
            throw new common_1.NotFoundException();
        }
        this.assertOwner(actorUserId, conversation.user_id);
        return conversation;
    }
    assertOwner(actorUserId, ownerUserId) {
        if (actorUserId !== Number.parseInt(String(ownerUserId), 10)) {
            throw new common_1.ForbiddenException();
        }
    }
    async persistConversationMessage(actorUserId, conversationId, payload) {
        const conversation = await this.requireOwnedConversation(actorUserId, conversationId);
        const content = payload.content?.trim() ?? '';
        const attachmentTokens = payload.attachments ?? [];
        if (content === '' && attachmentTokens.length === 0) {
            throw new common_1.UnprocessableEntityException({
                message: 'A message or at least one attachment is required.',
                errors: {
                    content: ['A message or at least one attachment is required.'],
                },
            });
        }
        let attachments = [];
        if (attachmentTokens.length > 0) {
            try {
                attachments = await this.conversationAttachmentsService.finalizeUploads(actorUserId, conversationId, attachmentTokens);
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Attachment finalization failed.';
                throw new common_1.UnprocessableEntityException({
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
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [conversations_repository_1.ConversationsRepository,
        conversation_attachments_service_1.ConversationAttachmentsService,
        conversation_assistant_execution_service_1.ConversationAssistantExecutionService,
        image_generation_service_1.ImageGenerationService])
], ConversationsService);
