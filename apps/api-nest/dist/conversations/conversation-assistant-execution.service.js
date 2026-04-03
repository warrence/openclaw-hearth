"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationAssistantExecutionService = exports.OpenClawExecutionError = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const conversations_repository_1 = require("./conversations.repository");
const conversation_stream_registry_service_1 = require("./conversation-stream-registry.service");
const event_bus_service_1 = require("../events/event-bus.service");
const hearth_action_processor_service_1 = require("../actions/hearth-action-processor.service");
const reminders_service_1 = require("../reminders/reminders.service");
const reminders_repository_1 = require("../reminders/reminders.repository");
const openclaw_config_writer_service_1 = require("../settings/openclaw-config-writer.service");
const image_generation_service_1 = require("./image-generation.service");
class OpenClawExecutionError extends Error {
    code;
    constructor(message, code = 'openclaw_execution_failed') {
        super(message);
        this.code = code;
    }
}
exports.OpenClawExecutionError = OpenClawExecutionError;
let ConversationAssistantExecutionService = class ConversationAssistantExecutionService {
    configService;
    repository;
    streamRegistry;
    remindersService;
    remindersRepository;
    actionProcessor;
    openClawConfigWriter;
    imageGenerationService;
    eventBus;
    constructor(configService, repository, streamRegistry, remindersService, remindersRepository, actionProcessor, openClawConfigWriter, imageGenerationService, eventBus) {
        this.configService = configService;
        this.repository = repository;
        this.streamRegistry = streamRegistry;
        this.remindersService = remindersService;
        this.remindersRepository = remindersRepository;
        this.actionProcessor = actionProcessor;
        this.openClawConfigWriter = openClawConfigWriter;
        this.imageGenerationService = imageGenerationService;
        this.eventBus = eventBus;
    }
    async streamAssistantReply(params, emit) {
        const config = this.configService.getOrThrow('openclaw', {
            infer: true,
        });
        emit({
            event: 'message.created',
            data: { message: params.userMessage },
        });
        emit({
            event: 'assistant.placeholder',
            data: {
                message: {
                    id: `pending-assistant-${params.userMessage.id}`,
                    role: 'assistant',
                    content: '',
                    source: 'hearth-channel-pending',
                    created_at: new Date().toISOString(),
                    metadata: {
                        state: 'queued',
                        label: 'Queued for OpenClaw',
                    },
                },
            },
        });
        const imageIntent = (0, image_generation_service_1.detectImageIntent)(params.content, params.attachments);
        if (imageIntent === 'edit') {
            emit({
                event: 'status',
                data: { state: 'running', label: '✏️ Editing image', elapsed_ms: 0 },
            });
            try {
                const result = await this.imageGenerationService.editForConversation(params.conversation.id, params.content, params.attachments);
                const persisted = await this.repository.createAssistantMessage({
                    conversationId: params.conversation.id,
                    content: result.revised_prompt || result.assistant_text || '',
                    model: result.model,
                    metadata: {
                        transport: 'nest-image-edit',
                        attachments: result.attachments,
                    },
                    messageId: `img-edit-${(0, node_crypto_1.randomUUID)()}`,
                    replyToMessageId: params.userMessage.channel_message_id ?? `msg_${params.userMessage.id}`,
                    personIdentity: this.resolvePersonIdentity(params.conversation),
                    agentId: this.resolveOpenClawAgentId(params.conversation.agent_id),
                    sentAt: new Date().toISOString(),
                });
                emit({
                    event: 'assistant.message',
                    data: { message: persisted.assistantMessage, stream_mode: 'nest-image-edit' },
                });
                emit({
                    event: 'done',
                    data: { conversation: persisted.conversation, assistant_message_id: persisted.assistantMessage.id },
                });
                return;
            }
            catch (err) {
                emit({
                    event: 'error',
                    data: { message: err instanceof Error ? err.message : 'Image edit failed', code: 'image_edit_failed' },
                });
                return;
            }
        }
        emit({
            event: 'status',
            data: {
                state: 'queued',
                label: 'Queued for OpenClaw',
                elapsed_ms: 0,
                stream_mode: 'hearth-channel-callback',
            },
        });
        const token = (0, node_crypto_1.randomUUID)();
        const callbackUrl = `${config.hearthCallbackBaseUrl}/api/channel/hearth-app/callback/${token}`;
        try {
            const inboundEvent = await this.buildHearthInboundEvent(params, token, callbackUrl, config);
            const waitForStream = this.streamRegistry.register(token, params, emit, config.agentTimeoutMs);
            try {
                await this.postHearthChannelInbound(inboundEvent, config);
            }
            catch (error) {
                this.streamRegistry.cancel(token);
                throw error;
            }
            await waitForStream;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'OpenClaw execution failed.';
            const code = error instanceof OpenClawExecutionError
                ? error.code
                : 'openclaw_execution_failed';
            emit({
                event: 'error',
                data: {
                    code,
                    message,
                    elapsed_ms: 0,
                    stream_mode: 'hearth-channel-callback',
                },
            });
        }
    }
    async processHearthCallback(token, event) {
        const entry = this.streamRegistry.getEntry(token);
        if (!entry) {
            return false;
        }
        const { params, emit, startedAt } = entry;
        const elapsedMs = Date.now() - startedAt;
        switch (event.event) {
            case 'assistant.placeholder': {
                emit({
                    event: 'assistant.placeholder',
                    data: {
                        message: event.message ?? {
                            id: `pending-assistant-${params.userMessage.id}`,
                            role: 'assistant',
                            content: '',
                            created_at: new Date().toISOString(),
                            metadata: { state: 'queued', label: 'OpenClaw is working…' },
                        },
                        stream_mode: 'hearth-channel-callback',
                    },
                });
                break;
            }
            case 'assistant.delta': {
                if (event.delta) {
                    entry.partialText += event.delta.text;
                    emit({
                        event: 'assistant.delta',
                        data: {
                            delta: event.delta.text,
                            text: entry.partialText,
                            partial_available: true,
                            elapsed_ms: event.delta.elapsed_ms ?? elapsedMs,
                            stream_mode: 'hearth-channel-callback',
                        },
                    });
                }
                break;
            }
            case 'assistant.message': {
                const rawText = event.message?.content?.trim() ?? '';
                const messageId = event.messageId ?? event.message?.id ?? `asst_${(0, node_crypto_1.randomUUID)()}`;
                const model = event.message?.model ?? null;
                const { cleanedText: textAfterActionStrip, actions } = this.actionProcessor.parseActions(rawText);
                const { cleanedText, attachments: mediaAttachments, extractedUrls } = await this.extractMediaAttachments(textAfterActionStrip, params.conversation.id);
                const extractedUrlSet = new Set(extractedUrls ?? []);
                const dedupedMediaUrls = (event.mediaUrls ?? []).filter((url) => !extractedUrlSet.has(url));
                const agentMediaAttachments = dedupedMediaUrls.length > 0
                    ? await this.stageAgentMediaUrls(dedupedMediaUrls, params.conversation.id)
                    : [];
                const allAttachments = [...agentMediaAttachments, ...mediaAttachments];
                const persisted = await this.repository.createAssistantMessage({
                    conversationId: params.conversation.id,
                    content: cleanedText,
                    model,
                    metadata: {
                        openclaw_session_key: this.normalizeSessionKey(params.conversation),
                        transport: 'hearth-channel-callback',
                        ...(allAttachments.length > 0
                            ? { attachments: allAttachments }
                            : {}),
                    },
                    messageId,
                    replyToMessageId: params.userMessage.channel_message_id ??
                        `msg_${params.userMessage.id}`,
                    personIdentity: this.resolvePersonIdentity(params.conversation),
                    agentId: this.resolveOpenClawAgentId(params.conversation.agent_id),
                    sentAt: event.message?.created_at ?? new Date().toISOString(),
                    contractJson: this.buildOutboundAssistantReplyEvent(params.conversation, cleanedText, { model, session_id: null, transport: 'hearth-channel-callback', usage: null }, params.userMessage.channel_message_id ??
                        `msg_${params.userMessage.id}`, messageId),
                });
                if (actions.length > 0) {
                    void this.actionProcessor.processActions(actions, {
                        userId: params.conversation.user_id,
                        conversationId: params.conversation.id,
                        messageId: String(persisted.assistantMessage.id),
                    });
                }
                entry.persistedConversation = persisted.conversation;
                this.eventBus.emit({
                    type: 'message.created',
                    userId: params.conversation.user_id,
                    conversationId: params.conversation.id,
                    data: {
                        conversationId: params.conversation.id,
                        message: persisted.assistantMessage,
                        conversation: persisted.conversation,
                    },
                });
                void this.maybeGenerateTitle(persisted.conversation, params.userMessage.content ?? "", emit);
                entry.persistedMessageId =
                    typeof persisted.assistantMessage.id === 'number'
                        ? persisted.assistantMessage.id
                        : Number(persisted.assistantMessage.id);
                emit({
                    event: 'assistant.message',
                    data: {
                        message: persisted.assistantMessage,
                        text: persisted.assistantMessage.content,
                        stream_mode: 'hearth-channel-callback',
                        contract: persisted.assistantMessage.contract_json,
                    },
                });
                break;
            }
            case 'status': {
                emit({
                    event: 'status',
                    data: {
                        state: event.status?.state ?? 'running',
                        label: event.status?.label ?? '',
                        elapsed_ms: event.status?.elapsed_ms ?? elapsedMs,
                        stream_mode: 'hearth-channel-callback',
                    },
                });
                break;
            }
            case 'done': {
                const doneConversation = entry.persistedConversation ?? params.persistedConversation;
                emit({
                    event: 'status',
                    data: {
                        state: 'completed',
                        label: 'Reply ready',
                        elapsed_ms: elapsedMs,
                        stream_mode: 'hearth-channel-callback',
                    },
                });
                emit({
                    event: 'done',
                    data: {
                        conversation: doneConversation,
                        assistant_message_id: entry.persistedMessageId ?? null,
                        partial_available: entry.persistedMessageId != null || entry.partialText.trim() !== '',
                        stream_mode: 'hearth-channel-callback',
                    },
                });
                this.streamRegistry.complete(token);
                break;
            }
            case 'error': {
                emit({
                    event: 'error',
                    data: {
                        code: 'hearth_channel_error',
                        message: event.error ?? 'Hearth channel returned an error.',
                        elapsed_ms: elapsedMs,
                        stream_mode: 'hearth-channel-callback',
                    },
                });
                this.streamRegistry.fail(token, event.error ?? 'Hearth channel error');
                break;
            }
        }
        return true;
    }
    async buildHearthInboundEvent(params, token, callbackUrl, config) {
        const conversation = (await this.repository.findConversationById(params.conversation.id)) ??
            params.conversation;
        const agentId = this.resolveOpenClawAgentId(conversation.agent_id);
        const profileSlug = conversation.user?.slug?.trim().toLowerCase() ?? 'guest';
        const conversationUuid = this.extractConversationUuid(conversation.openclaw_session_key);
        const attachments = params.attachments.map((a) => ({
            id: a.id ?? (0, node_crypto_1.randomUUID)(),
            name: a.name,
            url: a.url ?? '',
            internal_url: a.internal_url ?? undefined,
            mime_type: a.mime_type,
            extension: a.extension,
            category: a.category === 'image'
                ? 'image'
                : a.category === 'pdf' || a.category === 'text' || a.category === 'file'
                    ? 'document'
                    : 'other',
            size_bytes: a.size_bytes,
            text_excerpt: a.text_excerpt ?? undefined,
        }));
        return {
            token: config.hearthChannelToken,
            callbackUrl,
            profileId: conversation.user_id,
            profileSlug,
            profileName: conversation.user?.name?.trim() ?? profileSlug,
            personIdentity: this.resolvePersonIdentity(conversation),
            agentId,
            conversationId: conversation.id,
            conversationUuid,
            messageId: params.userMessage.channel_message_id ??
                `msg_${params.userMessage.id}`,
            text: params.content.trim(),
            attachments: attachments.length > 0 ? attachments : undefined,
            sentAt: new Date().toISOString(),
            userRole: conversation.user?.role ?? 'member',
            householdMembers: await this.getHouseholdMembers(),
            pendingReminders: await this.getPendingReminders(conversation.user_id, conversation.user?.role),
            modelPreset: conversation.model_preset ??
                undefined,
            ...this.resolvePresetDirectives(conversation, config),
        };
    }
    async getHouseholdMembers() {
        try {
            const result = await this.repository.listAllUsers();
            return result
                .filter((u) => u.slug && u.name)
                .map((u) => ({ name: u.name, slug: u.slug }));
        }
        catch {
            return [];
        }
    }
    async getPendingReminders(userId, userRole) {
        try {
            const isOwner = userRole === 'owner';
            const reminders = await this.remindersRepository.listReminders({
                userId: isOwner ? undefined : userId,
                status: 'pending',
            });
            return reminders.map((r) => ({
                id: r.id,
                text: r.message_text,
                fire_at: r.fire_at instanceof Date ? r.fire_at.toISOString() : String(r.fire_at),
                critical: r.critical,
                user_id: r.user_id,
            }));
        }
        catch {
            return [];
        }
    }
    resolvePresetDirectives(conversation, config) {
        const preset = conversation.model_preset;
        if (!preset)
            return {};
        const fromJson = this.openClawConfigWriter.get(`modelPresets.${preset}`);
        const model = (typeof fromJson === 'object' ? fromJson?.model : undefined)
            ?? (preset === 'fast' ? config.fastModel : config.deepModel);
        const thinkLevel = (typeof fromJson === 'object' ? fromJson?.thinkLevel : undefined) ?? undefined;
        const reasoningEnabled = (typeof fromJson === 'object' ? fromJson?.reasoningEnabled : undefined) ?? undefined;
        return {
            modelOverride: model || undefined,
            thinkLevel: thinkLevel ?? undefined,
            reasoningEnabled: reasoningEnabled ?? undefined,
        };
    }
    async postHearthChannelInbound(event, config) {
        const url = config.hearthChannelInboundUrl;
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
                signal: AbortSignal.timeout(10_000),
            });
        }
        catch (err) {
            throw new OpenClawExecutionError(`Hearth channel inbound POST failed: ${err instanceof Error ? err.message : String(err)}`, 'hearth_channel_inbound_failed');
        }
        if (!response.ok) {
            let detail = '';
            try {
                detail = await response.text();
            }
            catch {
            }
            throw new OpenClawExecutionError(`Hearth channel inbound rejected (${response.status}): ${detail.trim() || response.statusText}`, response.status === 401
                ? 'hearth_channel_unauthorized'
                : 'hearth_channel_inbound_failed');
        }
    }
    extractConversationUuid(sessionKey) {
        const match = /conv:([a-f0-9-]+)$/i.exec(sessionKey.trim());
        return match?.[1] ?? (0, node_crypto_1.randomUUID)();
    }
    async streamResponsesHttp(params, emit) {
        const config = this.configService.getOrThrow('openclaw', {
            infer: true,
        });
        if (!config.responsesHttpEnabled) {
            throw new OpenClawExecutionError('OpenClaw Responses HTTP transport is disabled for Nest.', 'responses_http_disabled');
        }
        if (!config.baseUrl) {
            throw new OpenClawExecutionError('OpenClaw base URL is not configured for Nest.', 'gateway_not_configured');
        }
        const agentId = this.resolveOpenClawAgentId(params.conversation.agent_id);
        const sessionKey = this.normalizeSessionKey(params.conversation, agentId);
        const response = await fetch(this.responsesHttpUrl(config), {
            method: 'POST',
            headers: {
                Accept: 'text/event-stream',
                'Content-Type': 'application/json',
                'x-openclaw-agent-id': agentId,
                'x-openclaw-session-key': sessionKey,
                ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
            },
            body: JSON.stringify({
                model: this.resolveResponsesModel(params.conversation, agentId, config),
                stream: true,
                input: [
                    await this.buildResponsesInput(params.conversation, params.content, params.attachments),
                ],
                user: sessionKey,
            }),
            signal: AbortSignal.timeout(config.agentTimeoutMs),
        });
        if (!response.ok || !response.body) {
            throw new OpenClawExecutionError(await this.extractErrorMessage(response), response.status === 404
                ? 'responses_http_unavailable'
                : 'responses_http_request_failed');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const state = {
            assistantText: '',
            responseId: null,
            model: null,
            usage: null,
            completedPayload: null,
        };
        const parse = this.createSseParser((message) => {
            this.handleResponsesEvent(message, state, emit);
        });
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            parse(decoder.decode(value, { stream: true }));
        }
        parse(decoder.decode());
        if (state.assistantText.trim() === '' &&
            state.completedPayload &&
            Array.isArray(state.completedPayload.output)) {
            state.assistantText = this.extractResponsesOutputText(state.completedPayload);
        }
        return {
            assistantText: state.assistantText,
            responseId: state.responseId,
            model: state.model,
            usage: state.usage,
            partialAvailable: state.assistantText.trim() !== '',
        };
    }
    handleResponsesEvent(message, state, emit) {
        if (message.data.length === 0) {
            return;
        }
        const raw = message.data.join('\n');
        if (raw.trim() === '[DONE]') {
            return;
        }
        let payload;
        try {
            payload = JSON.parse(raw);
        }
        catch {
            return;
        }
        const eventName = message.event === 'message'
            ? this.readString(payload.type) ?? 'message'
            : message.event;
        const response = this.readObject(payload.response) ?? payload;
        state.responseId = this.readString(response.id) ?? state.responseId;
        state.model = this.readString(response.model) ?? state.model;
        state.usage = this.readObject(response.usage) ?? state.usage;
        if (eventName === 'response.created') {
            emit({
                event: 'status',
                data: {
                    state: 'queued',
                    label: 'Queued for agent',
                    stream_mode: 'openclaw-responses-http-sse',
                },
            });
            return;
        }
        if (eventName === 'response.in_progress') {
            emit({
                event: 'status',
                data: {
                    state: 'running',
                    label: 'Agent is responding…',
                    partial_available: state.assistantText.trim() !== '',
                    stream_mode: 'openclaw-responses-http-sse',
                },
            });
            return;
        }
        if (eventName === 'response.output_text.delta') {
            const delta = this.extractResponsesTextDelta(payload);
            if (delta === '') {
                return;
            }
            state.assistantText += delta;
            emit({
                event: 'assistant.delta',
                data: {
                    delta,
                    text: state.assistantText,
                    partial_available: true,
                    stream_mode: 'openclaw-responses-http-sse',
                },
            });
            return;
        }
        if (eventName === 'response.output_text.done') {
            const text = this.extractResponsesCompletedText(payload);
            if (text !== '') {
                state.assistantText = text;
            }
            return;
        }
        if (eventName === 'response.failed') {
            throw new OpenClawExecutionError(this.readString(this.readObject(response.error)?.message ?? payload.message) ?? 'OpenClaw streaming request failed.');
        }
        if (eventName === 'response.completed') {
            state.completedPayload = response;
        }
    }
    createSseParser(onMessage) {
        let buffer = '';
        let envelope = {
            event: 'message',
            data: [],
        };
        const emit = () => {
            if (envelope.data.length === 0) {
                envelope = {
                    event: 'message',
                    data: [],
                };
                return;
            }
            onMessage(envelope);
            envelope = {
                event: 'message',
                data: [],
            };
        };
        return (chunk) => {
            buffer += chunk;
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (line.startsWith(':')) {
                    continue;
                }
                if (line === '') {
                    emit();
                    continue;
                }
                if (line.startsWith('event:')) {
                    envelope.event = line.slice(6).trim() || 'message';
                    continue;
                }
                if (line.startsWith('data:')) {
                    envelope.data.push(line.slice(5).trimStart());
                }
            }
        };
    }
    async buildResponsesInput(conversation, message, attachments) {
        const content = [
            {
                type: 'input_text',
                text: await this.buildResponsesTextPart(conversation, message, attachments),
            },
        ];
        for (const attachment of attachments) {
            if (attachment.category !== 'image') {
                continue;
            }
            const imageSource = await this.resolveImageSource(attachment);
            content.push({ type: 'input_image', source: imageSource });
        }
        return {
            type: 'message',
            role: 'user',
            content,
        };
    }
    async resolveImageSource(attachment) {
        if (attachment.path) {
            const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
                ? (0, node_path_1.resolve)(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
                : (0, node_path_1.join)(process.cwd(), 'storage');
            const absolutePath = (0, node_path_1.join)(storageRoot, attachment.path);
            try {
                const data = await (0, promises_1.readFile)(absolutePath);
                return {
                    type: 'base64',
                    media_type: attachment.mime_type || 'image/jpeg',
                    data: data.toString('base64'),
                };
            }
            catch {
            }
        }
        const imageUrl = attachment.internal_url ?? attachment.url;
        if (!imageUrl) {
            throw new OpenClawExecutionError(`Image attachment "${attachment.name}" is unavailable for multimodal transport.`, 'attachment_unavailable');
        }
        return { type: 'url', url: imageUrl };
    }
    async extractMediaAttachments(rawText, conversationId) {
        const mediaRegex = /MEDIA:([^\s"'<>]+)/g;
        const matches = [...rawText.matchAll(mediaRegex)];
        if (matches.length === 0) {
            return { cleanedText: rawText, attachments: [], extractedUrls: [] };
        }
        const extractedUrls = [];
        const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
            ? (0, node_path_1.resolve)(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
            : (0, node_path_1.join)(process.cwd(), 'storage');
        const publicBaseUrl = (process.env.ATTACHMENTS_PUBLIC_BASE_URL ?? 'http://127.0.0.1:3001/storage').replace(/\/$/, '');
        const internalBaseUrl = (process.env.ATTACHMENTS_INTERNAL_BASE_URL ?? 'http://127.0.0.1:3001/storage').replace(/\/$/, '');
        const attachments = [];
        let cleanedText = rawText;
        for (const match of matches) {
            const rawPath = match[1];
            extractedUrls.push(rawPath);
            const resolvedPath = rawPath.startsWith('~/')
                ? (0, node_path_1.join)(process.env.HOME ?? '/root', rawPath.slice(2))
                : rawPath.startsWith('http')
                    ? null
                    : rawPath.startsWith('/')
                        ? rawPath
                        : (0, node_path_1.join)(process.cwd(), rawPath);
            if (!resolvedPath) {
                const ext = (0, node_path_1.extname)(rawPath).replace(/^\./, '').toLowerCase() || 'png';
                const mime = this.mimeFromExtension(ext);
                attachments.push({
                    id: (0, node_crypto_1.randomUUID)(),
                    name: (0, node_path_1.basename)(rawPath) || `generated-${Date.now()}.${ext}`,
                    mime_type: mime,
                    size_bytes: 0,
                    extension: ext,
                    category: 'image',
                    uploaded_at: new Date().toISOString(),
                    url: rawPath,
                    internal_url: rawPath,
                    text_excerpt: null,
                    text_content: null,
                    extraction_note: null,
                    path: null,
                });
                cleanedText = cleanedText.replace(match[0], '').trim();
                continue;
            }
            try {
                const ext = (0, node_path_1.extname)(resolvedPath).replace(/^\./, '').toLowerCase() || 'png';
                const mime = this.mimeFromExtension(ext);
                const destDir = (0, node_path_1.join)(storageRoot, 'attachments', 'messages', String(conversationId));
                const destFile = `${(0, node_crypto_1.randomUUID)()}-${(0, node_path_1.basename)(resolvedPath)}`;
                const destPath = (0, node_path_1.join)(destDir, destFile);
                const storagePath = `attachments/messages/${conversationId}/${destFile}`;
                await (0, promises_1.mkdir)(destDir, { recursive: true });
                await (0, promises_1.copyFile)(resolvedPath, destPath);
                attachments.push({
                    id: (0, node_crypto_1.randomUUID)(),
                    name: (0, node_path_1.basename)(resolvedPath),
                    mime_type: mime,
                    size_bytes: 0,
                    extension: ext,
                    category: 'image',
                    uploaded_at: new Date().toISOString(),
                    url: `${publicBaseUrl}/${storagePath}`,
                    internal_url: `${internalBaseUrl}/${storagePath}`,
                    text_excerpt: null,
                    text_content: null,
                    extraction_note: null,
                    path: storagePath,
                });
                cleanedText = cleanedText.replace(match[0], '').trim();
            }
            catch (err) {
                console.warn(`[Hearth] Failed to copy MEDIA attachment "${resolvedPath}":`, err);
            }
        }
        return { cleanedText, attachments, extractedUrls };
    }
    mimeFromExtension(ext) {
        const map = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
        };
        return map[ext] ?? 'image/png';
    }
    async stageAgentMediaUrls(mediaUrls, conversationId) {
        const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
            ? (0, node_path_1.resolve)(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
            : (0, node_path_1.join)(process.cwd(), 'storage');
        const publicBaseUrl = (process.env.ATTACHMENTS_PUBLIC_BASE_URL ?? 'http://127.0.0.1:3001/storage').replace(/\/$/, '');
        const internalBaseUrl = (process.env.ATTACHMENTS_INTERNAL_BASE_URL ?? 'http://127.0.0.1:3001/storage').replace(/\/$/, '');
        const results = [];
        for (const rawUrl of mediaUrls) {
            try {
                const isRemote = /^https?:\/\//i.test(rawUrl);
                if (isRemote) {
                    const ext = (0, node_path_1.extname)(rawUrl).replace(/^\./, '').toLowerCase() || 'png';
                    const mime = this.mimeFromExtension(ext);
                    results.push({
                        id: (0, node_crypto_1.randomUUID)(),
                        name: (0, node_path_1.basename)(rawUrl) || `generated-image.${ext}`,
                        mime_type: mime,
                        size_bytes: 0,
                        extension: ext,
                        category: 'image',
                        uploaded_at: new Date().toISOString(),
                        url: rawUrl,
                        internal_url: rawUrl,
                        text_excerpt: null,
                        text_content: null,
                        extraction_note: null,
                        path: null,
                    });
                }
                else {
                    const absoluteSrc = rawUrl.startsWith('~/')
                        ? (0, node_path_1.join)(process.env.HOME ?? '/tmp', rawUrl.slice(2))
                        : rawUrl;
                    const ext = (0, node_path_1.extname)(absoluteSrc).replace(/^\./, '').toLowerCase() || 'png';
                    const mime = this.mimeFromExtension(ext);
                    const destDir = (0, node_path_1.join)(storageRoot, 'attachments', 'messages', String(conversationId));
                    const destFile = `${(0, node_crypto_1.randomUUID)()}-generated-image.${ext}`;
                    const destPath = (0, node_path_1.join)(destDir, destFile);
                    const storagePath = `attachments/messages/${conversationId}/${destFile}`;
                    await (0, promises_1.mkdir)(destDir, { recursive: true });
                    await (0, promises_1.copyFile)(absoluteSrc, destPath);
                    const { size } = await Promise.resolve().then(() => __importStar(require('node:fs/promises'))).then((m) => m.stat(destPath));
                    results.push({
                        id: (0, node_crypto_1.randomUUID)(),
                        name: `generated-image.${ext}`,
                        mime_type: mime,
                        size_bytes: size,
                        extension: ext,
                        category: 'image',
                        uploaded_at: new Date().toISOString(),
                        url: `${publicBaseUrl}/${storagePath}`,
                        internal_url: `${internalBaseUrl}/${storagePath}`,
                        text_excerpt: null,
                        text_content: null,
                        extraction_note: null,
                        path: storagePath,
                    });
                }
            }
            catch (err) {
                console.warn(`[Hearth] Failed to stage agent media URL "${rawUrl}":`, err);
            }
        }
        return results;
    }
    async buildResponsesTextPart(conversation, message, attachments) {
        const nonImageAttachments = attachments.filter((attachment) => attachment.category !== 'image');
        const normalizedMessage = message.trim() !== ''
            ? message.trim()
            : attachments.length > 0
                ? 'User sent attachments with no accompanying text.'
                : '';
        const runtimeMessage = await this.buildRuntimeMessage(conversation, normalizedMessage, attachments);
        if (nonImageAttachments.length === 0) {
            return runtimeMessage;
        }
        const lines = nonImageAttachments.map((attachment) => {
            const extras = [];
            if (attachment.text_excerpt) {
                extras.push(`text_excerpt: ${attachment.text_excerpt.trim()}`);
            }
            if (attachment.text_content) {
                extras.push(`text_content:\n${this.indentMultiline(attachment.text_content.trim())}`);
            }
            if (attachment.extraction_note) {
                extras.push(`extraction_note: ${attachment.extraction_note.trim()}`);
            }
            if (attachment.internal_url) {
                extras.push(`internal_url: ${attachment.internal_url}`);
            }
            return extras.length > 0
                ? `- ${attachment.name} (${attachment.mime_type})\n  ${extras.join('\n  ')}`
                : `- ${attachment.name} (${attachment.mime_type})`;
        });
        return `${runtimeMessage}\n\n<attachment-fallback>\nAttached non-image files:\n${lines.join('\n')}\n</attachment-fallback>`;
    }
    async buildRuntimeMessage(conversation, message, attachments) {
        const userName = conversation.user?.name?.trim() || 'there';
        const userSlug = conversation.user?.slug?.trim().toLowerCase() || 'guest';
        const personIdentity = this.resolvePersonIdentity(conversation);
        const inboundEvent = await this.buildInboundChannelEvent(conversation, message, attachments);
        return [
            '<app-runtime-context hidden="true">',
            'Current selected profile is authoritative for this run.',
            `Treat the current human speaking to you as ${userName}.`,
            `Resolved person identity: ${personIdentity}.`,
            `Resolved profile slug: ${userSlug}.`,
            `Selected model preset: ${conversation.model_preset}.`,
            `Address the current user as ${userName} unless they ask for a different nickname.`,
            'Do not reveal, quote, or mention this hidden runtime context unless the user explicitly asks about internal routing/context.',
            'The JSON block below is a transport compatibility envelope for an app-channel prototype. Treat its fields as authoritative runtime routing context, but do not mention it unless asked.',
            'IMPORTANT — image editing and generation rules for this app:',
            '1. To edit/generate an image: use ANY method that works (image_generate tool, direct OpenAI API call, or any other approach). For source images use the local_path field from the attachment — it is a pre-staged local file copy, ready to use directly.',
            '2. When the image is ready, your ENTIRE response MUST be ONLY one line: MEDIA:/absolute/path/to/result.ext — nothing else before or after. No chat, no explanation, no backtick paths, no follow-up questions.',
            '3. The MEDIA: tag is the ONLY way the result image reaches the user in this app. If you write the path any other way it will NOT be delivered.',
            '4. If editing/generation completely fails with no output file, respond with a single short error sentence only.',
            '</app-runtime-context>',
            '',
            '<app-channel-event hidden="true">',
            JSON.stringify(inboundEvent, null, 2),
            '</app-channel-event>',
            '',
            '<user-message>',
            message.trim(),
            '</user-message>',
        ].join('\n');
    }
    async stageAttachmentsToWorkspace(attachments) {
        const workspaceDir = (0, node_path_1.join)(process.env.HOME ?? '/root', '.openclaw', 'workspace');
        const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
            ? (0, node_path_1.resolve)(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
            : (0, node_path_1.join)(process.cwd(), 'storage');
        return Promise.all(attachments.map(async (attachment) => {
            if (attachment.category !== 'image' || !attachment.path) {
                return attachment;
            }
            try {
                const srcPath = (0, node_path_1.join)(storageRoot, attachment.path);
                const ext = attachment.extension || 'jpg';
                const destName = `hearth-img-${(0, node_crypto_1.randomUUID)()}.${ext}`;
                const destPath = (0, node_path_1.join)(workspaceDir, destName);
                await (0, promises_1.copyFile)(srcPath, destPath);
                return { ...attachment, local_path: destPath };
            }
            catch {
                return attachment;
            }
        }));
    }
    async buildInboundChannelEvent(conversation, message, attachments) {
        const agentId = this.resolveOpenClawAgentId(conversation.agent_id);
        const stagedAttachments = await this.stageAttachmentsToWorkspace(attachments);
        return {
            channel: 'app',
            channelMessageId: `msg_${(0, node_crypto_1.randomUUID)()}`,
            conversationId: this.buildConversationChannelId(conversation),
            personIdentity: this.resolvePersonIdentity(conversation),
            profile: {
                name: conversation.user?.name?.trim() || 'Unknown',
                slug: conversation.user?.slug?.trim().toLowerCase() || 'guest',
            },
            agentId,
            role: 'user',
            text: message.trim(),
            attachments: stagedAttachments,
            sentAt: new Date().toISOString(),
            metadata: {
                source: 'openclaw-family-app',
                uiConversationId: conversation.id,
                openclawSessionKey: this.normalizeSessionKey(conversation, agentId),
                transportMode: 'bridge-compatible-app-channel',
            },
        };
    }
    buildOutboundAssistantReplyEvent(conversation, text, result, replyToMessageId, messageId) {
        return {
            channel: 'app',
            conversationId: this.buildConversationChannelId(conversation),
            personIdentity: this.resolvePersonIdentity(conversation),
            agentId: this.resolveOpenClawAgentId(conversation.agent_id),
            role: 'assistant',
            text,
            messageId,
            replyToMessageId,
            completed: true,
            sentAt: new Date().toISOString(),
            metadata: {
                model: result.model,
                openclawSessionId: result.session_id,
                usage: result.usage,
                transportMode: result.transport,
            },
        };
    }
    resolvePersonIdentity(conversation) {
        const namespace = conversation.user?.memory_namespace?.trim();
        if (namespace) {
            return namespace.toLowerCase();
        }
        return `person:${conversation.user?.slug?.trim().toLowerCase() || 'guest'}`;
    }
    normalizeSessionKey(conversation, agentId) {
        const resolvedAgentId = agentId ?? this.resolveOpenClawAgentId(conversation.agent_id);
        const raw = conversation.openclaw_session_key.trim();
        const prefix = `agent:${resolvedAgentId.toLowerCase()}:`;
        if (raw.toLowerCase().startsWith('agent:')) {
            return raw.toLowerCase();
        }
        return `${prefix}${this.resolvePersonIdentity(conversation)}:${raw}`.toLowerCase();
    }
    resolveOpenClawAgentId(appAgentId) {
        const config = this.configService.getOrThrow('openclaw', {
            infer: true,
        });
        const normalized = appAgentId.trim().toLowerCase() || 'main';
        if (normalized === 'main') {
            const fromJson = this.openClawConfigWriter.get('agentSettings.agent');
            if (fromJson)
                return fromJson;
        }
        return config.agentMap[normalized] ?? config.defaultAgentId;
    }
    resolveResponsesModel(conversation, agentId, config) {
        if (conversation.model_preset === 'fast') {
            return config.fastModel;
        }
        if (conversation.model_preset === 'deep') {
            return config.deepModel;
        }
        return `openclaw:${agentId}`;
    }
    responsesHttpUrl(config) {
        return `${this.normalizeGatewayHttpUrl(config.baseUrl ?? '')}/${config.responsesPath.replace(/^\/+/, '')}`;
    }
    normalizeGatewayHttpUrl(baseUrl) {
        const trimmed = baseUrl.trim().replace(/\/+$/, '');
        if (trimmed.startsWith('ws://')) {
            return `http://${trimmed.slice(5)}`;
        }
        if (trimmed.startsWith('wss://')) {
            return `https://${trimmed.slice(6)}`;
        }
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        return `http://${trimmed}`;
    }
    extractResponsesTextDelta(payload) {
        const candidates = [
            payload.delta,
            payload.text,
            this.readArray(payload.content)?.[0] &&
                this.readObject(this.readArray(payload.content)?.[0])?.text,
            this.readObject(payload.part)?.text,
        ];
        for (const candidate of candidates) {
            const value = this.readString(candidate);
            if (value) {
                return value;
            }
        }
        return '';
    }
    extractResponsesCompletedText(payload) {
        const candidates = [
            payload.text,
            this.readObject(payload.part)?.text,
            this.readArray(payload.content)?.[0] &&
                this.readObject(this.readArray(payload.content)?.[0])?.text,
        ];
        for (const candidate of candidates) {
            const value = this.readString(candidate);
            if (value) {
                return value.trim();
            }
        }
        return '';
    }
    extractResponsesOutputText(response) {
        const outputs = this.readArray(response.output) ?? [];
        const chunks = [];
        for (const output of outputs) {
            const outputObject = this.readObject(output);
            if (!outputObject) {
                continue;
            }
            for (const content of this.readArray(outputObject.content) ?? []) {
                const contentObject = this.readObject(content);
                if (!contentObject) {
                    continue;
                }
                const value = this.readString(contentObject.text) ??
                    this.readString(contentObject.value);
                if (value && value.trim() !== '') {
                    chunks.push(value);
                }
            }
        }
        return chunks.join('').trim();
    }
    async extractErrorMessage(response) {
        const raw = await response.text();
        try {
            const payload = JSON.parse(raw);
            const errorObject = this.readObject(payload.error);
            const message = this.readString(errorObject?.message) ??
                this.readString(payload.message) ??
                raw.trim();
            return message || `OpenClaw request failed with status ${response.status}.`;
        }
        catch {
            return (raw.trim() || `OpenClaw request failed with status ${response.status}.`);
        }
    }
    buildConversationChannelId(conversation) {
        const raw = conversation.openclaw_session_key.trim();
        if (raw.toLowerCase().startsWith('app:')) {
            return raw.toLowerCase();
        }
        const slug = conversation.user?.slug?.trim().toLowerCase() || 'guest';
        return `app:${slug}:conv:${conversation.id}`.toLowerCase();
    }
    indentMultiline(text) {
        return `    ${text.replace(/\n/g, '\n    ')}`;
    }
    readObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value
            : null;
    }
    readArray(value) {
        return Array.isArray(value) ? value : null;
    }
    readString(value) {
        return typeof value === 'string' ? value : null;
    }
    async maybeGenerateTitle(conversation, userMessageContent, emit) {
        if (conversation.title && conversation.title !== "New Chat")
            return;
        const text = userMessageContent?.trim();
        if (!text || text.length < 3)
            return;
        try {
            const config = this.configService.get('openclaw', { infer: true });
            const baseUrl = config?.baseUrl ?? 'http://127.0.0.1:18789';
            const token = config?.token ?? '';
            if (!token) {
                console.warn('[Hearth] Title generation skipped: no gateway token');
                return;
            }
            const prompt = text.length > 300 ? text.slice(0, 300) : text;
            const response = await fetch(`${baseUrl}/v1/responses`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: 'openclaw',
                    input: `Generate a short conversation title (3-6 words max) from this message. No quotes, no punctuation at the end. Just the title.\n\nMessage: ${prompt}`,
                    stream: false,
                    max_output_tokens: 20,
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) {
                const errBody = await response.text().catch(() => '');
                console.warn(`[Hearth] Title generation failed: ${response.status} ${response.statusText} — ${errBody}`);
                return;
            }
            const data = await response.json();
            const title = data.output?.[0]?.content?.[0]?.text?.trim();
            if (!title || title.length > 80)
                return;
            await this.repository.updateConversation(conversation.id, { title });
            if (emit) {
                emit({
                    event: 'conversation.updated',
                    data: { id: conversation.id, title },
                });
            }
        }
        catch (err) {
            console.warn('[Hearth] Title generation error:', err);
        }
    }
    async maybeScheduleReminder(conversation, text, sourceMessageId) {
        try {
            const parsed = this.remindersService.parseReminderFromText(text, conversation.openclaw_session_key ?? "");
            if (!parsed)
                return;
            await this.remindersService.scheduleReminder({
                userId: conversation.user_id,
                conversationId: conversation.id,
                messageText: parsed.reminderText,
                fireAt: parsed.fireAt,
                sourceMessageId,
            });
        }
        catch (err) {
            console.warn("[Hearth] Failed to schedule reminder:", err);
        }
    }
};
exports.ConversationAssistantExecutionService = ConversationAssistantExecutionService;
exports.ConversationAssistantExecutionService = ConversationAssistantExecutionService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => reminders_service_1.RemindersService))),
    __metadata("design:paramtypes", [config_1.ConfigService,
        conversations_repository_1.ConversationsRepository,
        conversation_stream_registry_service_1.ConversationStreamRegistryService,
        reminders_service_1.RemindersService,
        reminders_repository_1.RemindersRepository,
        hearth_action_processor_service_1.HearthActionProcessorService,
        openclaw_config_writer_service_1.OpenClawConfigWriterService,
        image_generation_service_1.ImageGenerationService,
        event_bus_service_1.EventBusService])
], ConversationAssistantExecutionService);
