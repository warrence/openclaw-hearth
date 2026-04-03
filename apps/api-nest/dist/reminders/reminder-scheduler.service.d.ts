import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RemindersService } from './reminders.service';
export declare class ReminderSchedulerService implements OnModuleInit, OnModuleDestroy {
    private readonly remindersService;
    private readonly logger;
    private interval;
    constructor(remindersService: RemindersService);
    onModuleInit(): void;
    onModuleDestroy(): void;
}
