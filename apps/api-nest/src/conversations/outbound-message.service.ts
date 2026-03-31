import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { EventBusService } from '../events/event-bus.service';
import { PushService } from '../push/push.service';
import { ConversationRecord, ConversationsRepository } from './conversations.repository';

export type HearthOutboundPayload = {
  token: string;
  to: string;
  text: string;
  mediaUrl?: string;
};

// Matches app:<slug>:conv:<uuid>
const SESSION_KEY_RE = /^app:[^:]+:conv:[0-9a-f-]+$/i;

@Injectable()
export class OutboundMessageService {
  private readonly logger = new Logger(OutboundMessageService.name);

  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly pushService: PushService,
    private readonly eventBus: EventBusService,
  ) {}

  async deliverOutboundMessage(payload: HearthOutboundPayload): Promise<void> {
    const expectedToken = process.env['HEARTH_APP_CHANNEL_TOKEN'] ?? '';
    if (!expectedToken || payload.token !== expectedToken) {
      throw new UnauthorizedException('Invalid channel token');
    }

    const conversation = await this.resolveConversation(payload.to);

    if (!conversation) {
      this.logger.warn(
        `[outbound] Could not resolve conversation for to="${payload.to}"`,
      );
      return;
    }

    await this.deliverToConversation(conversation, payload.text);
  }

  /**
   * Internal delivery — skips token validation. For use by RemindersService.
   */
  async deliverInternal(
    conversationId: number,
    userId: number,
    text: string,
  ): Promise<void> {
    const conversation =
      await this.conversationsRepository.findConversationById(conversationId);

    if (!conversation) {
      this.logger.warn(
        `[outbound] deliverInternal: conversation not found id=${conversationId}`,
      );
      return;
    }

    await this.deliverToConversation(conversation, text);
  }

  private async deliverToConversation(
    conversation: ConversationRecord,
    text: string,
  ): Promise<void> {
    await this.conversationsRepository.createAssistantMessage({
      conversationId: conversation.id,
      content: text,
      messageId: randomUUID(),
      agentId: conversation.agent_id,
    });

    // Read agent display name from hearth.json
    let agentName = 'Aeris';
    try {
      const { readFileSync } = require('node:fs');
      const { join } = require('node:path');
      const { homedir } = require('node:os');
      const raw = readFileSync(join(homedir(), '.openclaw', 'hearth.json'), 'utf8');
      const cfg = JSON.parse(raw);
      if (cfg?.agentDisplayName) agentName = cfg.agentDisplayName;
    } catch { /* fallback */ }

    await this.pushService.sendNotification(conversation.user_id, {
      title: agentName,
      body: text.slice(0, 100),
      conversationId: conversation.id,
      url: `/?profile=${conversation.user_id}&chat=${conversation.id}`,
    });

    // Broadcast to connected SSE clients
    this.eventBus.emit({
      type: 'message.created',
      userId: conversation.user_id,
      conversationId: conversation.id,
      data: {
        conversationId: conversation.id,
        message: { role: 'assistant', content: text },
        conversation: { id: conversation.id, title: conversation.title },
      },
    });
  }

  private async resolveConversation(to: string) {
    if (SESSION_KEY_RE.test(to)) {
      return this.conversationsRepository.findConversationBySessionKey(to);
    }

    // Treat `to` as a profile slug
    return this.conversationsRepository.findLatestActiveConversationByUserSlug(
      to,
    );
  }
}
