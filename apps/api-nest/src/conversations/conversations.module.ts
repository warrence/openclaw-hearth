import { forwardRef, Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { AttachmentsModule } from '../attachments/attachments.module';
import { HearthActionsModule } from '../actions/hearth-actions.module';
import { DatabaseModule } from '../database/database.module';
import { PushModule } from '../push/push.module';
import { RemindersModule } from '../reminders/reminders.module';
import { SettingsModule } from '../settings/settings.module';
import { ConversationAssistantExecutionService } from './conversation-assistant-execution.service';
import { ConversationMessageStreamingService } from './conversation-message-streaming.service';
import { ConversationStreamRegistryService } from './conversation-stream-registry.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsService } from './conversations.service';
import { HearthChannelCallbackController } from './hearth-channel-callback.controller';
import { HearthChannelOutboundController } from './hearth-channel-outbound.controller';
import { ImageGenerationService } from './image-generation.service';
import { OutboundMessageService } from './outbound-message.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AttachmentsModule,
    PushModule,
    SettingsModule,
    forwardRef(() => RemindersModule),
    forwardRef(() => HearthActionsModule),
  ],
  controllers: [
    ConversationsController,
    HearthChannelCallbackController,
    HearthChannelOutboundController,
  ],
  providers: [
    ConversationsRepository,
    ConversationsService,
    ConversationAssistantExecutionService,
    ConversationMessageStreamingService,
    ConversationStreamRegistryService,
    ImageGenerationService,
    OutboundMessageService,
  ],
  exports: [ConversationsRepository, OutboundMessageService],
})
export class ConversationsModule {}
