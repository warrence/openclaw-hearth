import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import { OutboundMessageService } from '../conversations/outbound-message.service';
import { RemindersRepository } from './reminders.repository';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly repository: RemindersRepository,
    @Inject(forwardRef(() => OutboundMessageService))
    private readonly outboundMessageService: OutboundMessageService,
  ) {}

  async scheduleReminder(params: {
    userId: number;
    conversationId: number;
    messageText: string;
    fireAt: Date;
    sourceMessageId?: string;
    critical?: boolean;
  }): Promise<void> {
    await this.repository.createReminder(params);
    this.logger.log(
      `[reminders] Scheduled ${params.critical ? 'CRITICAL ' : ''}reminder for user=${params.userId} at ${params.fireAt.toISOString()}`,
    );
  }

  async processDue(): Promise<void> {
    const due = await this.repository.findDueReminders();
    if (due.length === 0) return;

    this.logger.log(`[reminders] Processing ${due.length} due reminder(s)`);

    for (const reminder of due) {
      try {
        await this.outboundMessageService.deliverInternal(
          reminder.conversation_id,
          reminder.user_id,
          reminder.message_text,
        );
        await this.repository.markFired(reminder.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[reminders] Failed to deliver reminder id=${reminder.id}: ${message}`,
        );
        await this.repository.markFailed(reminder.id, message);
      }
    }
  }

  /** Process critical reminders that need repeating */
  async processCriticalRepeats(): Promise<void> {
    const config = this.getCriticalConfig();
    if (!config.enabled) return;

    const unacked = await this.repository.findUnacknowledgedCritical();
    if (unacked.length === 0) return;

    for (const reminder of unacked) {
      // Check if max repeats exceeded
      if (reminder.repeat_count >= config.maxRepeats) {
        this.logger.log(`[reminders] Critical reminder id=${reminder.id} reached max repeats (${config.maxRepeats}), stopping`);
        await this.repository.markAcknowledged(reminder.id);
        continue;
      }

      // Check if user has replied since the reminder fired
      // Check since the ORIGINAL fire_at, not the latest repeat fired_at
      const firedAt = reminder.fire_at;
      const hasReplied = await this.repository.hasUserRepliedSince(
        reminder.conversation_id,
        firedAt,
      );

      if (hasReplied) {
        this.logger.log(`[reminders] Critical reminder id=${reminder.id} acknowledged by user reply`);
        await this.repository.markAcknowledged(reminder.id);
        continue;
      }

      // Check if enough time has passed since last repeat
      const lastRepeatAt = reminder.fired_at ?? reminder.fire_at;
      const lastFiredMs = lastRepeatAt instanceof Date ? lastRepeatAt.getTime() : new Date(lastRepeatAt).getTime();
      const intervalMs = config.intervalMinutes * 60 * 1000;
      if (Date.now() - lastFiredMs < intervalMs) continue;

      // Repeat the reminder
      try {
        this.logger.log(`[reminders] Repeating critical reminder id=${reminder.id} (repeat #${reminder.repeat_count + 1})`);
        await this.outboundMessageService.deliverInternal(
          reminder.conversation_id,
          reminder.user_id,
          `⚠️ ${reminder.message_text}`,
        );
        await this.repository.incrementRepeatCount(reminder.id);
      } catch (err) {
        this.logger.warn(`[reminders] Failed to repeat critical id=${reminder.id}: ${err}`);
      }
    }
  }

  private getCriticalConfig(): { enabled: boolean; intervalMinutes: number; maxRepeats: number } {
    try {
      const { readFileSync } = require('node:fs');
      const { join } = require('node:path');
      const { homedir } = require('node:os');
      const raw = readFileSync(join(homedir(), '.openclaw', 'hearth.json'), 'utf8');
      const cfg = JSON.parse(raw);
      return {
        enabled: cfg?.reminders?.critical?.enabled ?? true,
        intervalMinutes: cfg?.reminders?.critical?.intervalMinutes ?? 1,
        maxRepeats: cfg?.reminders?.critical?.maxRepeats ?? 30,
      };
    } catch {
      return { enabled: true, intervalMinutes: 1, maxRepeats: 30 };
    }
  }

  /**
   * Parses reminder intent from assistant reply text.
   * Handles phrases like:
   *   - "remind me in X minutes"
   *   - "remind me in X hours"
   *   - "remind me at HH:MM"
   *   - "remind me tomorrow at HH:MM"
   * Returns null if no reminder intent is detected.
   */
  parseReminderFromText(
    text: string,
    _conversationSessionKey: string,
  ): { fireAt: Date; reminderText: string } | null {
    const now = new Date();

    // "remind me in X minutes"
    const inMinutesMatch = text.match(
      /remind(?:ing)? (?:you )?(?:me )?in (\d+)\s*minutes?/i,
    );
    if (inMinutesMatch) {
      const minutes = parseInt(inMinutesMatch[1]!, 10);
      const fireAt = new Date(now.getTime() + minutes * 60 * 1000);
      return { fireAt, reminderText: text.trim().slice(0, 500) };
    }

    // "remind me in X hours"
    const inHoursMatch = text.match(
      /remind(?:ing)? (?:you )?(?:me )?in (\d+)\s*hours?/i,
    );
    if (inHoursMatch) {
      const hours = parseInt(inHoursMatch[1]!, 10);
      const fireAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
      return { fireAt, reminderText: text.trim().slice(0, 500) };
    }

    // "remind me tomorrow at HH:MM"
    const tomorrowAtMatch = text.match(
      /remind(?:ing)? (?:you )?(?:me )?tomorrow at (\d{1,2}):(\d{2})(?:\s*(am|pm))?/i,
    );
    if (tomorrowAtMatch) {
      const fireAt = new Date(now);
      fireAt.setDate(fireAt.getDate() + 1);
      fireAt.setHours(
        this.parseHour(parseInt(tomorrowAtMatch[1]!, 10), tomorrowAtMatch[3] ?? null),
        parseInt(tomorrowAtMatch[2]!, 10),
        0,
        0,
      );
      return { fireAt, reminderText: text.trim().slice(0, 500) };
    }

    // "remind me at HH:MM"
    const atTimeMatch = text.match(
      /remind(?:ing)? (?:you )?(?:me )?at (\d{1,2}):(\d{2})(?:\s*(am|pm))?/i,
    );
    if (atTimeMatch) {
      const fireAt = new Date(now);
      fireAt.setHours(
        this.parseHour(parseInt(atTimeMatch[1]!, 10), atTimeMatch[3] ?? null),
        parseInt(atTimeMatch[2]!, 10),
        0,
        0,
      );
      // If the time has already passed today, schedule for tomorrow
      if (fireAt <= now) {
        fireAt.setDate(fireAt.getDate() + 1);
      }
      return { fireAt, reminderText: text.trim().slice(0, 500) };
    }

    return null;
  }

  private parseHour(hour: number, amPm: string | null): number {
    if (!amPm) return hour;
    const lower = amPm.toLowerCase();
    if (lower === 'pm' && hour < 12) return hour + 12;
    if (lower === 'am' && hour === 12) return 0;
    return hour;
  }
}
