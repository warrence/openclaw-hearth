import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ConversationsRepository } from '../conversations/conversations.repository';
import { DatabaseModule } from '../database/database.module';
import { AttachmentsConfig } from '../config/attachments.config';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsRepository } from './attachments.repository';
import { AttachmentsService } from './attachments.service';
import { ConversationAttachmentsService } from './conversation-attachments.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AttachmentsController],
  providers: [
    ConversationsRepository,
    ConversationAttachmentsService,
    AttachmentsService,
    {
      provide: AttachmentsRepository,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new AttachmentsRepository(
          configService.getOrThrow<AttachmentsConfig>('attachments', {
            infer: true,
          }),
        ),
    },
  ],
  exports: [ConversationAttachmentsService, AttachmentsService],
})
export class AttachmentsModule {}
