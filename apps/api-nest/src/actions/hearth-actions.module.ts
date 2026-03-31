import { forwardRef, Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ConversationsRepository } from '../conversations/conversations.repository';
import { RemindersModule } from '../reminders/reminders.module';
import { HearthActionProcessorService } from './hearth-action-processor.service';

@Module({
  imports: [DatabaseModule, forwardRef(() => RemindersModule)],
  providers: [HearthActionProcessorService, ConversationsRepository],
  exports: [HearthActionProcessorService],
})
export class HearthActionsModule {}
