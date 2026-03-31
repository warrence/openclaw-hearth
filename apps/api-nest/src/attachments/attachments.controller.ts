import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { MAX_ATTACHMENT_BYTES } from './attachments.constants';
import { UploadedFileLike } from './attachments.service';
import { ConversationAttachmentsService } from './conversation-attachments.service';

@Controller('api/conversations/:conversationId/attachments')
@UseGuards(SessionAuthGuard)
export class AttachmentsController {
  constructor(
    private readonly conversationAttachmentsService: ConversationAttachmentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_ATTACHMENT_BYTES,
        files: 1,
      },
    }),
  )
  async uploadAttachment(
    @CurrentUserId() actorUserId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<{ attachment: Record<string, unknown> }> {
    const attachment = await this.conversationAttachmentsService.uploadAttachment(
      actorUserId,
      conversationId,
      file,
    );

    const { path: _path, ...publicAttachment } = attachment;

    return {
      attachment: publicAttachment,
    };
  }
}
