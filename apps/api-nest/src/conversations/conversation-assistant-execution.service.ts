import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';

import { AttachmentPayload } from '../attachments/attachments.types';
import { OpenClawConfig } from '../config/openclaw.config';
import {
  ConversationRecord,
  ConversationsRepository,
  MessageRecord,
} from './conversations.repository';
import { ConversationStreamRegistryService } from './conversation-stream-registry.service';
import {
  HearthAppInboundEvent,
  HearthAppOutboundEvent,
  HearthAttachment,
} from './hearth-channel.types';
import { ConversationMessageStreamEvent } from './dto/send-conversation-message.dto';
import { EventBusService } from '../events/event-bus.service';
import { HearthActionProcessorService } from '../actions/hearth-action-processor.service';
import { RemindersService } from '../reminders/reminders.service';
import { RemindersRepository } from '../reminders/reminders.repository';
import { OpenClawConfigWriterService } from '../settings/openclaw-config-writer.service';
import { detectImageIntent, ImageGenerationService } from './image-generation.service';

export type StreamExecutionParams = {
  conversation: ConversationRecord;
  persistedConversation: ConversationRecord;
  userMessage: MessageRecord;
  content: string;
  attachments: AttachmentPayload[];
};

type ResponsesStreamState = {
  assistantText: string;
  responseId: string | null;
  model: string | null;
  usage: Record<string, unknown> | null;
  completedPayload: Record<string, unknown> | null;
};

type SseEnvelope = {
  event: string;
  data: string[];
};

export class OpenClawExecutionError extends Error {
  constructor(
    message: string,
    readonly code: string = 'openclaw_execution_failed',
  ) {
    super(message);
  }
}

@Injectable()
export class ConversationAssistantExecutionService {
  constructor(
    private readonly configService: ConfigService,
    private readonly repository: ConversationsRepository,
    private readonly streamRegistry: ConversationStreamRegistryService,
    @Inject(forwardRef(() => RemindersService))
    private readonly remindersService: RemindersService,
    private readonly remindersRepository: RemindersRepository,
    private readonly actionProcessor: HearthActionProcessorService,
    private readonly openClawConfigWriter: OpenClawConfigWriterService,
    private readonly imageGenerationService: ImageGenerationService,
    private readonly eventBus: EventBusService,
  ) {}

  async streamAssistantReply(
    params: StreamExecutionParams,
    emit: (event: ConversationMessageStreamEvent) => void,
  ): Promise<void> {
    const config = this.configService.getOrThrow<OpenClawConfig>('openclaw', {
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

    // Intercept image edit requests — use Nest-side direct OpenAI call (OpenClaw's image_generate edit mode is broken)
    const imageIntent = detectImageIntent(params.content, params.attachments);
    if (imageIntent === 'edit') {
      emit({
        event: 'status',
        data: { state: 'running', label: '✏️ Editing image', elapsed_ms: 0 },
      });
      try {
        const result = await this.imageGenerationService.editForConversation(
          params.conversation.id,
          params.content,
          params.attachments,
        );
        const persisted = await this.repository.createAssistantMessage({
          conversationId: params.conversation.id,
          content: result.revised_prompt || result.assistant_text || '',
          model: result.model,
          metadata: {
            transport: 'nest-image-edit',
            attachments: result.attachments,
          },
          messageId: `img-edit-${randomUUID()}`,
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
      } catch (err) {
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

    const token = randomUUID();
    const callbackUrl = `${config.hearthCallbackBaseUrl}/api/channel/hearth-app/callback/${token}`;

    try {
      const inboundEvent = await this.buildHearthInboundEvent(
        params,
        token,
        callbackUrl,
        config,
      );

      // Register before POSTing so a fast callback cannot arrive before Nest is listening.
      const waitForStream = this.streamRegistry.register(
        token,
        params,
        emit,
        config.agentTimeoutMs,
      );

      try {
        await this.postHearthChannelInbound(inboundEvent, config);
      } catch (error) {
        this.streamRegistry.cancel(token);
        throw error;
      }

      await waitForStream;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'OpenClaw execution failed.';
      const code =
        error instanceof OpenClawExecutionError
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

  /**
   * Process a HearthAppOutboundEvent arriving from the plugin's callback POST.
   * Called by HearthChannelCallbackController.
   * Returns false if the token is not found (stale/unknown).
   */
  async processHearthCallback(
    token: string,
    event: HearthAppOutboundEvent,
  ): Promise<boolean> {
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
        const messageId = event.messageId ?? event.message?.id ?? `asst_${randomUUID()}`;
        const model = event.message?.model ?? null;

        const { cleanedText: textAfterActionStrip, actions } =
          this.actionProcessor.parseActions(rawText);

        const { cleanedText, attachments: mediaAttachments, extractedUrls } =
          await this.extractMediaAttachments(textAfterActionStrip, params.conversation.id);

        // Stage agent-produced mediaUrls, but skip any already extracted from text
        const extractedUrlSet = new Set(extractedUrls ?? []);
        const dedupedMediaUrls = (event.mediaUrls ?? []).filter(
          (url) => !extractedUrlSet.has(url),
        );
        const agentMediaAttachments =
          dedupedMediaUrls.length > 0
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
          replyToMessageId:
            params.userMessage.channel_message_id ??
            `msg_${params.userMessage.id}`,
          personIdentity: this.resolvePersonIdentity(params.conversation),
          agentId: this.resolveOpenClawAgentId(params.conversation.agent_id),
          sentAt: event.message?.created_at ?? new Date().toISOString(),
          contractJson: this.buildOutboundAssistantReplyEvent(
            params.conversation,
            cleanedText,
            { model, session_id: null, transport: 'hearth-channel-callback', usage: null },
            params.userMessage.channel_message_id ??
              `msg_${params.userMessage.id}`,
            messageId,
          ),
        });

        // Fire-and-forget: process structured action blocks
        if (actions.length > 0) {
          void this.actionProcessor.processActions(actions, {
            userId: params.conversation.user_id,
            conversationId: params.conversation.id,
            messageId: String(persisted.assistantMessage.id),
          });
        }

        // Regex fallback disabled — action blocks are now the primary reminder path
        // void this.maybeScheduleReminder(...)

        // Cache persisted data on entry for the subsequent done event
        entry.persistedConversation = persisted.conversation;

        // Broadcast to connected SSE clients for real-time sync
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
        const doneConversation =
          entry.persistedConversation ?? params.persistedConversation;

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
            partial_available:
              entry.persistedMessageId != null || entry.partialText.trim() !== '',
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

  private async buildHearthInboundEvent(
    params: StreamExecutionParams,
    token: string,
    callbackUrl: string,
    config: OpenClawConfig,
  ): Promise<HearthAppInboundEvent> {
    const conversation =
      (await this.repository.findConversationById(params.conversation.id)) ??
      params.conversation;

    const agentId = this.resolveOpenClawAgentId(conversation.agent_id);
    const profileSlug = conversation.user?.slug?.trim().toLowerCase() ?? 'guest';
    const conversationUuid = this.extractConversationUuid(
      conversation.openclaw_session_key,
    );

    // TODO: Stage image attachments to ~/.openclaw/workspace for the agent
    // when the native channel supports local_path forwarding.
    const attachments: HearthAttachment[] = params.attachments.map((a) => ({
      id: a.id ?? randomUUID(),
      name: a.name,
      url: a.url ?? '',
      internal_url: a.internal_url ?? undefined,
      mime_type: a.mime_type,
      extension: a.extension,
      category:
        a.category === 'image'
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
      messageId:
        params.userMessage.channel_message_id ??
        `msg_${params.userMessage.id}`,
      text: params.content.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      sentAt: new Date().toISOString(),
      userRole: conversation.user?.role ?? 'member',
      householdMembers: await this.getHouseholdMembers(),
      pendingReminders: await this.getPendingReminders(conversation.user_id, conversation.user?.role),
      modelPreset:
        (conversation.model_preset as 'fast' | 'deep' | null) ??
        undefined,
      ...this.resolvePresetDirectives(conversation, config),
    };
  }

  private async getHouseholdMembers(): Promise<Array<{ name: string; slug: string }>> {
    try {
      const result = await this.repository.listAllUsers();
      return result
        .filter((u) => u.slug && u.name)
        .map((u) => ({ name: u.name, slug: u.slug }));
    } catch {
      return [];
    }
  }

  private async getPendingReminders(
    userId: number,
    userRole?: string,
  ): Promise<Array<{ id: number; text: string; fire_at: string; critical: boolean; user_id: number }>> {
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
    } catch {
      return [];
    }
  }

  private resolvePresetDirectives(
    conversation: ConversationRecord,
    config: OpenClawConfig,
  ): { modelOverride?: string; thinkLevel?: string; reasoningEnabled?: boolean } {
    const preset = conversation.model_preset;
    if (!preset) return {};

    // Prefer hearth.json presets over .env fallbacks
    type PresetEntry = { model?: string; thinkLevel?: string | null; reasoningEnabled?: boolean | null };
    const fromJson = this.openClawConfigWriter.get<PresetEntry>(`modelPresets.${preset}`);

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

  private async postHearthChannelInbound(
    event: HearthAppInboundEvent,
    config: OpenClawConfig,
  ): Promise<void> {
    const url = config.hearthChannelInboundUrl;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new OpenClawExecutionError(
        `Hearth channel inbound POST failed: ${err instanceof Error ? err.message : String(err)}`,
        'hearth_channel_inbound_failed',
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        // ignore
      }
      throw new OpenClawExecutionError(
        `Hearth channel inbound rejected (${response.status}): ${detail.trim() || response.statusText}`,
        response.status === 401
          ? 'hearth_channel_unauthorized'
          : 'hearth_channel_inbound_failed',
      );
    }
  }

  private extractConversationUuid(sessionKey: string): string {
    // Expected format: app:{slug}:conv:{uuid}
    const match = /conv:([a-f0-9-]+)$/i.exec(sessionKey.trim());
    return match?.[1] ?? randomUUID();
  }

  private async streamResponsesHttp(
    params: StreamExecutionParams,
    emit: (event: ConversationMessageStreamEvent) => void,
  ): Promise<{
    assistantText: string;
    responseId: string | null;
    model: string | null;
    usage: Record<string, unknown> | null;
    partialAvailable: boolean;
  }> {
    const config = this.configService.getOrThrow<OpenClawConfig>('openclaw', {
      infer: true,
    });

    if (!config.responsesHttpEnabled) {
      throw new OpenClawExecutionError(
        'OpenClaw Responses HTTP transport is disabled for Nest.',
        'responses_http_disabled',
      );
    }

    if (!config.baseUrl) {
      throw new OpenClawExecutionError(
        'OpenClaw base URL is not configured for Nest.',
        'gateway_not_configured',
      );
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
          await this.buildResponsesInput(
            params.conversation,
            params.content,
            params.attachments,
          ),
        ],
        user: sessionKey,
      }),
      signal: AbortSignal.timeout(config.agentTimeoutMs),
    });

    if (!response.ok || !response.body) {
      throw new OpenClawExecutionError(
        await this.extractErrorMessage(response),
        response.status === 404
          ? 'responses_http_unavailable'
          : 'responses_http_request_failed',
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const state: ResponsesStreamState = {
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

    if (
      state.assistantText.trim() === '' &&
      state.completedPayload &&
      Array.isArray(state.completedPayload.output)
    ) {
      state.assistantText = this.extractResponsesOutputText(
        state.completedPayload,
      );
    }

    return {
      assistantText: state.assistantText,
      responseId: state.responseId,
      model: state.model,
      usage: state.usage,
      partialAvailable: state.assistantText.trim() !== '',
    };
  }

  private handleResponsesEvent(
    message: SseEnvelope,
    state: ResponsesStreamState,
    emit: (event: ConversationMessageStreamEvent) => void,
  ): void {
    if (message.data.length === 0) {
      return;
    }

    const raw = message.data.join('\n');

    if (raw.trim() === '[DONE]') {
      return;
    }

    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const eventName =
      message.event === 'message'
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
      throw new OpenClawExecutionError(
        this.readString(
          this.readObject(response.error)?.message ?? payload.message,
        ) ?? 'OpenClaw streaming request failed.',
      );
    }

    if (eventName === 'response.completed') {
      state.completedPayload = response;
    }
  }

  private createSseParser(
    onMessage: (message: SseEnvelope) => void,
  ): (chunk: string) => void {
    let buffer = '';
    let envelope: SseEnvelope = {
      event: 'message',
      data: [],
    };

    const emit = (): void => {
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

    return (chunk: string): void => {
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

  private async buildResponsesInput(
    conversation: ConversationRecord,
    message: string,
    attachments: AttachmentPayload[],
  ): Promise<Record<string, unknown>> {
    const content: Record<string, unknown>[] = [
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

  private async resolveImageSource(
    attachment: AttachmentPayload,
  ): Promise<Record<string, unknown>> {
    // Prefer reading from disk and sending as base64 — the gateway rejects local-network URLs.
    if (attachment.path) {
      const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
        ? resolve(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
        : join(process.cwd(), 'storage');
      const absolutePath = join(storageRoot, attachment.path);

      try {
        const data = await readFile(absolutePath);
        return {
          type: 'base64',
          media_type: attachment.mime_type || 'image/jpeg',
          data: data.toString('base64'),
        };
      } catch {
        // fall through to URL fallback
      }
    }

    const imageUrl = attachment.internal_url ?? attachment.url;

    if (!imageUrl) {
      throw new OpenClawExecutionError(
        `Image attachment "${attachment.name}" is unavailable for multimodal transport.`,
        'attachment_unavailable',
      );
    }

    return { type: 'url', url: imageUrl };
  }

  /**
   * Scan assistant text for MEDIA: tags emitted by OpenClaw agents.
   * Each matched file is copied into Hearth's attachment storage and returned
   * as an AttachmentPayload so the frontend can render it inline.
   * The MEDIA: tags are stripped from the returned cleaned text.
   */
  private async extractMediaAttachments(
    rawText: string,
    conversationId: number,
  ): Promise<{ cleanedText: string; attachments: AttachmentPayload[]; extractedUrls: string[] }> {
    // Matches: MEDIA:/abs/path  MEDIA:~/path  MEDIA:./rel  MEDIA:https://...
    const mediaRegex = /MEDIA:([^\s"'<>]+)/g;
    const matches = [...rawText.matchAll(mediaRegex)];

    if (matches.length === 0) {
      return { cleanedText: rawText, attachments: [], extractedUrls: [] };
    }

    const extractedUrls: string[] = [];

    const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
      ? resolve(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
      : join(process.cwd(), 'storage');
    const publicBaseUrl = (process.env.ATTACHMENTS_PUBLIC_BASE_URL ?? 'http://127.0.0.1:3001/storage').replace(/\/$/, '');
    const internalBaseUrl = (process.env.ATTACHMENTS_INTERNAL_BASE_URL ?? 'http://127.0.0.1:3001/storage').replace(/\/$/, '');

    const attachments: AttachmentPayload[] = [];
    let cleanedText = rawText;

    for (const match of matches) {
      const rawPath = match[1]!;
      extractedUrls.push(rawPath);
      // Resolve ~ and relative paths
      const resolvedPath = rawPath.startsWith('~/')
        ? join(process.env.HOME ?? '/root', rawPath.slice(2))
        : rawPath.startsWith('http')
          ? null // URL — skip file copy
          : rawPath.startsWith('/')
            ? rawPath
            : join(process.cwd(), rawPath);

      if (!resolvedPath) {
        // URL-based media: include as-is without file copy
        const ext = extname(rawPath).replace(/^\./, '').toLowerCase() || 'png';
        const mime = this.mimeFromExtension(ext);
        attachments.push({
          id: randomUUID(),
          name: basename(rawPath) || `generated-${Date.now()}.${ext}`,
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
        cleanedText = cleanedText.replace(match[0]!, '').trim();
        continue;
      }

      try {
        const ext = extname(resolvedPath).replace(/^\./, '').toLowerCase() || 'png';
        const mime = this.mimeFromExtension(ext);
        const destDir = join(storageRoot, 'attachments', 'messages', String(conversationId));
        const destFile = `${randomUUID()}-${basename(resolvedPath)}`;
        const destPath = join(destDir, destFile);
        const storagePath = `attachments/messages/${conversationId}/${destFile}`;

        await mkdir(destDir, { recursive: true });
        await copyFile(resolvedPath, destPath);

        attachments.push({
          id: randomUUID(),
          name: basename(resolvedPath),
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

        // Strip the MEDIA: tag from the text
        cleanedText = cleanedText.replace(match[0]!, '').trim();
      } catch (err) {
        // Log but don't fail the whole message
        console.warn(`[Hearth] Failed to copy MEDIA attachment "${resolvedPath}":`, err);
      }
    }

    return { cleanedText, attachments, extractedUrls };
  }

  private mimeFromExtension(ext: string): string {
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    return map[ext] ?? 'image/png';
  }

  /**
   * Copy local file paths from agent-produced mediaUrls (e.g. image_generate output)
   * into Nest storage and return AttachmentPayload objects ready to persist.
   * Remote URLs (http/https) are stored as-is without copying.
   */
  private async stageAgentMediaUrls(
    mediaUrls: string[],
    conversationId: number,
  ): Promise<AttachmentPayload[]> {
    const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
      ? resolve(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
      : join(process.cwd(), 'storage');
    const publicBaseUrl = (
      process.env.ATTACHMENTS_PUBLIC_BASE_URL ?? 'http://127.0.0.1:3001/storage'
    ).replace(/\/$/, '');
    const internalBaseUrl = (
      process.env.ATTACHMENTS_INTERNAL_BASE_URL ?? 'http://127.0.0.1:3001/storage'
    ).replace(/\/$/, '');

    const results: AttachmentPayload[] = [];

    for (const rawUrl of mediaUrls) {
      try {
        const isRemote = /^https?:\/\//i.test(rawUrl);

        if (isRemote) {
          // Remote URL — reference directly without copying
          const ext = extname(rawUrl).replace(/^\./, '').toLowerCase() || 'png';
          const mime = this.mimeFromExtension(ext);
          results.push({
            id: randomUUID(),
            name: basename(rawUrl) || `generated-image.${ext}`,
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
        } else {
          // Local file path (e.g. ~/.openclaw/workspace/hearth-img-*.png)
          const absoluteSrc = rawUrl.startsWith('~/')
            ? join(process.env.HOME ?? '/tmp', rawUrl.slice(2))
            : rawUrl;

          const ext = extname(absoluteSrc).replace(/^\./, '').toLowerCase() || 'png';
          const mime = this.mimeFromExtension(ext);
          const destDir = join(storageRoot, 'attachments', 'messages', String(conversationId));
          const destFile = `${randomUUID()}-generated-image.${ext}`;
          const destPath = join(destDir, destFile);
          const storagePath = `attachments/messages/${conversationId}/${destFile}`;

          await mkdir(destDir, { recursive: true });
          await copyFile(absoluteSrc, destPath);

          const { size } = await import('node:fs/promises').then((m) => m.stat(destPath));

          results.push({
            id: randomUUID(),
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
      } catch (err) {
        console.warn(`[Hearth] Failed to stage agent media URL "${rawUrl}":`, err);
      }
    }

    return results;
  }

  private async buildResponsesTextPart(
    conversation: ConversationRecord,
    message: string,
    attachments: AttachmentPayload[],
  ): Promise<string> {
    const nonImageAttachments = attachments.filter(
      (attachment) => attachment.category !== 'image',
    );
    const normalizedMessage =
      message.trim() !== ''
        ? message.trim()
        : attachments.length > 0
          ? 'User sent attachments with no accompanying text.'
          : '';
    const runtimeMessage = await this.buildRuntimeMessage(
      conversation,
      normalizedMessage,
      attachments,
    );

    if (nonImageAttachments.length === 0) {
      return runtimeMessage;
    }

    const lines = nonImageAttachments.map((attachment) => {
      const extras: string[] = [];

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

  private async buildRuntimeMessage(
    conversation: ConversationRecord,
    message: string,
    attachments: AttachmentPayload[],
  ): Promise<string> {
    const userName = conversation.user?.name?.trim() || 'there';
    const userSlug = conversation.user?.slug?.trim().toLowerCase() || 'guest';
    const personIdentity = this.resolvePersonIdentity(conversation);
    const inboundEvent = await this.buildInboundChannelEvent(
      conversation,
      message,
      attachments,
    );

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

  /**
   * Stage image attachments to the agent workspace so the agent can reference them
   * as local file paths in image_generate calls (avoids SSRF policy blocking
   * http://127.0.0.1 and Tailscale CGNAT URLs).
   */
  private async stageAttachmentsToWorkspace(
    attachments: AttachmentPayload[],
  ): Promise<(AttachmentPayload & { local_path?: string })[]> {
    const workspaceDir = join(
      process.env.HOME ?? '/root',
      '.openclaw',
      'workspace',
    );
    const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
      ? resolve(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
      : join(process.cwd(), 'storage');

    return Promise.all(
      attachments.map(async (attachment) => {
        if (attachment.category !== 'image' || !attachment.path) {
          return attachment;
        }
        try {
          const srcPath = join(storageRoot, attachment.path);
          const ext = attachment.extension || 'jpg';
          const destName = `hearth-img-${randomUUID()}.${ext}`;
          const destPath = join(workspaceDir, destName);
          await copyFile(srcPath, destPath);
          return { ...attachment, local_path: destPath };
        } catch {
          // If staging fails, return attachment as-is (no local_path)
          return attachment;
        }
      }),
    );
  }

  private async buildInboundChannelEvent(
    conversation: ConversationRecord,
    message: string,
    attachments: AttachmentPayload[],
  ): Promise<Record<string, unknown>> {
    const agentId = this.resolveOpenClawAgentId(conversation.agent_id);
    const stagedAttachments = await this.stageAttachmentsToWorkspace(attachments);

    return {
      channel: 'app',
      channelMessageId: `msg_${randomUUID()}`,
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

  private buildOutboundAssistantReplyEvent(
    conversation: ConversationRecord,
    text: string,
    result: {
      model: string | null;
      session_id: string | null;
      transport: string;
      usage: Record<string, unknown> | null;
    },
    replyToMessageId: string,
    messageId: string,
  ): Record<string, unknown> {
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

  private resolvePersonIdentity(conversation: ConversationRecord): string {
    const namespace = conversation.user?.memory_namespace?.trim();

    if (namespace) {
      return namespace.toLowerCase();
    }

    return `person:${conversation.user?.slug?.trim().toLowerCase() || 'guest'}`;
  }

  private normalizeSessionKey(
    conversation: ConversationRecord,
    agentId?: string,
  ): string {
    const resolvedAgentId =
      agentId ?? this.resolveOpenClawAgentId(conversation.agent_id);
    const raw = conversation.openclaw_session_key.trim();
    const prefix = `agent:${resolvedAgentId.toLowerCase()}:`;

    if (raw.toLowerCase().startsWith('agent:')) {
      return raw.toLowerCase();
    }

    return `${prefix}${this.resolvePersonIdentity(conversation)}:${raw}`.toLowerCase();
  }

  private resolveOpenClawAgentId(appAgentId: string): string {
    const config = this.configService.getOrThrow<OpenClawConfig>('openclaw', {
      infer: true,
    });
    const normalized = appAgentId.trim().toLowerCase() || 'main';

    // Check hearth.json agentSettings override first (dashboard-configurable)
    if (normalized === 'main') {
      const fromJson = this.openClawConfigWriter.get<string>('agentSettings.agent');
      if (fromJson) return fromJson;
    }

    return config.agentMap[normalized] ?? config.defaultAgentId;
  }

  private resolveResponsesModel(
    conversation: ConversationRecord,
    agentId: string,
    config: OpenClawConfig,
  ): string {
    if (conversation.model_preset === 'fast') {
      return config.fastModel;
    }

    if (conversation.model_preset === 'deep') {
      return config.deepModel;
    }

    return `openclaw:${agentId}`;
  }

  private responsesHttpUrl(config: OpenClawConfig): string {
    return `${this.normalizeGatewayHttpUrl(config.baseUrl ?? '')}/${config.responsesPath.replace(/^\/+/, '')}`;
  }

  private normalizeGatewayHttpUrl(baseUrl: string): string {
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

  private extractResponsesTextDelta(payload: Record<string, unknown>): string {
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

  private extractResponsesCompletedText(
    payload: Record<string, unknown>,
  ): string {
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

  private extractResponsesOutputText(response: Record<string, unknown>): string {
    const outputs = this.readArray(response.output) ?? [];
    const chunks: string[] = [];

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

        const value =
          this.readString(contentObject.text) ??
          this.readString(contentObject.value);

        if (value && value.trim() !== '') {
          chunks.push(value);
        }
      }
    }

    return chunks.join('').trim();
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    const raw = await response.text();

    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const errorObject = this.readObject(payload.error);
      const message =
        this.readString(errorObject?.message) ??
        this.readString(payload.message) ??
        raw.trim();

      return message || `OpenClaw request failed with status ${response.status}.`;
    } catch {
      return (
        raw.trim() || `OpenClaw request failed with status ${response.status}.`
      );
    }
  }

  private buildConversationChannelId(conversation: ConversationRecord): string {
    const raw = conversation.openclaw_session_key.trim();

    if (raw.toLowerCase().startsWith('app:')) {
      return raw.toLowerCase();
    }

    const slug = conversation.user?.slug?.trim().toLowerCase() || 'guest';
    return `app:${slug}:conv:${conversation.id}`.toLowerCase();
  }

  private indentMultiline(text: string): string {
    return `    ${text.replace(/\n/g, '\n    ')}`;
  }

  private readObject(
    value: unknown,
  ): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readArray(value: unknown): unknown[] | null {
    return Array.isArray(value) ? value : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private async maybeGenerateTitle(
    conversation: ConversationRecord,
    userMessageContent: string,
    emit?: (event: ConversationMessageStreamEvent) => void,
  ): Promise<void> {
    if (conversation.title && conversation.title !== "New Chat") return;
    const text = userMessageContent?.trim();
    if (!text || text.length < 3) return;

    try {
      const config = this.configService.get<OpenClawConfig>('openclaw', { infer: true });
      const baseUrl = config?.baseUrl ?? 'http://127.0.0.1:18789';
      const token = config?.token ?? '';
      if (!token) {
        console.warn('[Hearth] Title generation skipped: no gateway token');
        return;
      }

      const prompt = text.length > 300 ? text.slice(0, 300) : text;

      // Route through OpenClaw gateway Responses API — no separate OpenAI API key needed
      const response = await fetch(`${baseUrl}/v1/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config?.fastModel || 'default',
          input: `Generate a short conversation title (3-6 words max) from this message. No quotes, no punctuation at the end. Just the title.\n\nMessage: ${prompt}`,
          stream: false,
          max_output_tokens: 20,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`[Hearth] Title generation failed: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
      const title = data.output?.[0]?.content?.[0]?.text?.trim();
      if (!title || title.length > 80) return;

      await this.repository.updateConversation(conversation.id, { title });

      // Push the updated title to the frontend via SSE
      if (emit) {
        emit({
          event: 'conversation.updated',
          data: { id: conversation.id, title },
        });
      }
    } catch (err) {
      console.warn('[Hearth] Title generation error:', err);
    }
  }

  private async maybeScheduleReminder(
    conversation: ConversationRecord,
    text: string,
    sourceMessageId: string,
  ): Promise<void> {
    try {
      const parsed = this.remindersService.parseReminderFromText(
        text,
        conversation.openclaw_session_key ?? "",
      );
      if (!parsed) return;
      await this.remindersService.scheduleReminder({
        userId: conversation.user_id,
        conversationId: conversation.id,
        messageText: parsed.reminderText,
        fireAt: parsed.fireAt,
        sourceMessageId,
      });
    } catch (err) {
      console.warn("[Hearth] Failed to schedule reminder:", err);
    }
  }
}
