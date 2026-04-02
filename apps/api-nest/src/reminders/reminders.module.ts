import { forwardRef, Module } from '@nestjs/common';

import { ConversationsModule } from '../conversations/conversations.module';
import { DatabaseModule } from '../database/database.module';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { RemindersRepository } from './reminders.repository';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => ConversationsModule)],
  controllers: [RemindersController],
  providers: [RemindersRepository, RemindersService, ReminderSchedulerService],
  exports: [RemindersService, RemindersRepository],
})
export class RemindersModule {}
