import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { RemindersService } from './reminders.service';

@Injectable()
export class ReminderSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderSchedulerService.name);
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly remindersService: RemindersService) {}

  onModuleInit(): void {
    this.interval = setInterval(() => {
      this.remindersService.processDue().catch((err: unknown) => {
        this.logger.error('[reminder-scheduler] processDue error', err);
      });
      // Also process critical reminder repeats
      this.remindersService.processCriticalRepeats().catch((err: unknown) => {
        this.logger.error('[reminder-scheduler] processCriticalRepeats error', err);
      });
    }, 60_000);
  }

  onModuleDestroy(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
