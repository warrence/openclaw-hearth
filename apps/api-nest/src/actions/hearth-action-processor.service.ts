import { Injectable, Logger } from '@nestjs/common';

import { ConversationsRepository } from '../conversations/conversations.repository';
import { RemindersService } from '../reminders/reminders.service';
import type { HearthAction, ReminderAction } from './hearth-action.types';

@Injectable()
export class HearthActionProcessorService {
  private readonly logger = new Logger(HearthActionProcessorService.name);

  constructor(
    private readonly remindersService: RemindersService,
    private readonly conversationsRepository: ConversationsRepository,
  ) {}

  parseActions(text: string): { cleanedText: string; actions: HearthAction[] } {
    const actions: HearthAction[] = [];
    const cleanedText = text
      .replace(/```hearth-action\s*([\s\S]*?)\s*```/g, (_match, block: string) => {
        try {
          const parsed: unknown = JSON.parse(block.trim());
          const items: HearthAction[] = Array.isArray(parsed)
            ? (parsed as HearthAction[])
            : [(parsed as HearthAction)];
          actions.push(...items);
        } catch (err) {
          this.logger.warn(`[hearth-actions] Failed to parse action block: ${err}`);
        }
        return '';
      })
      // Also catch inline hearth-action blocks without backticks (model sometimes omits them)
      .replace(/\n*hearth-action\s*(\{[\s\S]*?\})\s*/gi, (_match, jsonStr: string) => {
        try {
          if (jsonStr) {
            const parsed = JSON.parse(jsonStr.trim()) as HearthAction;
            actions.push(parsed);
          }
        } catch { /* ignore */ }
        return '';
      })
      // Strip any model-generated meta-commentary about scheduling
      .replace(/\n*Note:\s*I did not schedule[^.]*\.\s*/gi, '')
      .replace(/\n*Note:\s*[^\n]*hearth.action[^\n]*/gi, '')
      .replace(/\n*Note:\s*[^\n]*(not trigger|won't trigger|will not trigger)[^\n]*/gi, '')
      .trim();

    return { cleanedText, actions };
  }

  async processActions(
    actions: HearthAction[],
    context: { userId: number; conversationId: number; messageId: string },
  ): Promise<void> {
    for (const action of actions) {
      try {
        await this.dispatchAction(action, context);
      } catch (err) {
        this.logger.warn(
          `[hearth-actions] Failed to process action type=${action.type}: ${err}`,
        );
      }
    }
  }

  private async dispatchAction(
    action: HearthAction,
    context: { userId: number; conversationId: number; messageId: string },
  ): Promise<void> {
    switch (action.type) {
      case 'reminder':
        await this.handleReminder(action, context);
        break;
      default:
        this.logger.warn(
          `[hearth-actions] Unimplemented action type: ${(action as HearthAction).type}`,
        );
    }
  }

  private async handleReminder(
    action: ReminderAction,
    context: { userId: number; conversationId: number; messageId: string },
  ): Promise<void> {
    let targetUserId = context.userId;
    let targetConversationId = context.conversationId;

    // If a target household member is specified, create a new conversation for them
    if (action.target && action.target.trim()) {
      const targetSlug = action.target.trim().toLowerCase();
      try {
        const targetUser = await this.conversationsRepository.findUserBySlug(targetSlug);
        if (targetUser) {
          // Create a fresh conversation for the reminder
          const newConversation = await this.conversationsRepository.createConversation({
            userId: targetUser.id,
            title: `Reminder`,
          });
          targetUserId = targetUser.id;
          targetConversationId = newConversation.id;
          this.logger.log(
            `[hearth-actions] Reminder targeting ${targetSlug}: created conv=${targetConversationId} for user=${targetUserId}`,
          );
        } else {
          this.logger.warn(
            `[hearth-actions] Target member "${targetSlug}" not found — falling back to sender`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `[hearth-actions] Failed to resolve target "${targetSlug}": ${err}`,
        );
      }
    }

    await this.remindersService.scheduleReminder({
      userId: targetUserId,
      conversationId: targetConversationId,
      messageText: action.text,
      fireAt: new Date(action.fire_at),
      sourceMessageId: context.messageId,
      critical: action.critical ?? this.detectCriticalFromText(action.text),
    });
  }

  /** Heuristic: detect if reminder text implies critical/urgent intent */
  private detectCriticalFromText(text: string): boolean {
    const critical = /\b(critical|important|urgent|must not miss|don'?t miss|keep remind|nag|persistent)\b/i;
    return critical.test(text);
  }
}
