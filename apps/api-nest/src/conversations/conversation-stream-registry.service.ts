import { Injectable } from '@nestjs/common';

import type { StreamExecutionParams } from './conversation-assistant-execution.service';
import { ConversationRecord } from './conversations.repository';
import { ConversationMessageStreamEvent } from './dto/send-conversation-message.dto';

export type StreamEntry = {
  params: StreamExecutionParams;
  startedAt: number;
  emit: (event: ConversationMessageStreamEvent) => void;
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  partialText: string;
  /** Populated after assistant.message is persisted to DB */
  persistedConversation?: ConversationRecord;
  persistedMessageId?: number;
};

@Injectable()
export class ConversationStreamRegistryService {
  private readonly streams = new Map<string, StreamEntry>();

  /**
   * Register a live SSE stream by token.
   * Returns a Promise that resolves when the stream completes (via complete/fail)
   * or rejects on timeout.
   */
  register(
    token: string,
    params: StreamExecutionParams,
    emit: (event: ConversationMessageStreamEvent) => void,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.streams.has(token)) {
          this.streams.delete(token);
          reject(
            new Error(
              'Hearth channel stream timed out waiting for callback.',
            ),
          );
        }
      }, timeoutMs);

      this.streams.set(token, {
        params,
        startedAt: Date.now(),
        emit,
        resolve,
        reject,
        timer,
        partialText: '',
      });
    });
  }

  getEntry(token: string): StreamEntry | undefined {
    return this.streams.get(token);
  }

  cancel(token: string): void {
    const entry = this.streams.get(token);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.streams.delete(token);
  }

  complete(token: string): void {
    const entry = this.streams.get(token);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.streams.delete(token);
    entry.resolve();
  }

  fail(token: string, message: string): void {
    const entry = this.streams.get(token);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.streams.delete(token);
    entry.reject(new Error(message));
  }

  /** Cancel the active stream for a conversation, if any. Returns session info for forwarding abort, or null if no active stream. */
  cancelByConversationId(conversationId: number): {
    agentId: string;
    profileSlug: string;
    conversationUuid: string;
  } | null {
    for (const [token, entry] of this.streams.entries()) {
      if (entry.params.conversation.id === conversationId) {
        const sessionKey = entry.params.conversation.openclaw_session_key ?? '';
        // Parse "app:{profileSlug}:conv:{uuid}" from the stored session key
        const match = /app:([^:]+):conv:([a-f0-9-]+)/i.exec(sessionKey);
        const agentId = entry.params.conversation.agent_id ?? 'aeris';
        this.cancel(token);
        return {
          agentId,
          profileSlug: match?.[1] ?? '',
          conversationUuid: match?.[2] ?? '',
        };
      }
    }
    return null;
  }

  /** Current number of live streams (for observability). */
  get size(): number {
    return this.streams.size;
  }
}
