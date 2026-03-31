import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ConversationsService } from './conversations.service';
import { ConversationRecord, MessageRecord } from './conversations.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import {
  SendConversationMessageDto,
  SendConversationMessageResponse,
} from './dto/send-conversation-message.dto';
import { ConversationMessageStreamingService } from './conversation-message-streaming.service';
import { ConversationStreamRegistryService } from './conversation-stream-registry.service';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConfigService } from '@nestjs/config';
import type { OpenClawConfig } from '../config/openclaw.config';
import { SkipAuth } from '../auth/skip-auth.decorator';

@Controller('api')
@UseGuards(SessionAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly conversationMessageStreamingService: ConversationMessageStreamingService,
    private readonly streamRegistry: ConversationStreamRegistryService,
    private readonly configService: ConfigService,
  ) {}

  @Get('users/:userId/conversations')
  listUserConversations(
    @CurrentUserId() actorUserId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: ListConversationsQueryDto,
  ): Promise<ConversationRecord[]> {
    return this.conversationsService.listUserConversations(
      actorUserId,
      userId,
      query,
    );
  }

  @Get('conversations/:conversationId')
  getConversation(
    @CurrentUserId() actorUserId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<ConversationRecord> {
    return this.conversationsService.getConversation(actorUserId, conversationId);
  }

  @Post('users/:userId/conversations')
  createConversation(
    @CurrentUserId() actorUserId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: CreateConversationDto,
  ): Promise<ConversationRecord> {
    return this.conversationsService.createConversation(actorUserId, userId, body);
  }

  @Get('conversations/:conversationId/messages')
  listConversationMessages(
    @CurrentUserId() actorUserId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<MessageRecord[]> {
    return this.conversationsService.listConversationMessages(
      actorUserId,
      conversationId,
    );
  }

  @Post('conversations/:conversationId/messages')
  sendConversationMessage(
    @CurrentUserId() actorUserId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Body() body: SendConversationMessageDto,
    @Res({ passthrough: true }) res: {
      writeHead(statusCode: number, headers: Record<string, string>): unknown;
      write(chunk: string): unknown;
      end(): unknown;
    },
  ): Promise<SendConversationMessageResponse | void> {
    if (body.stream === true) {
      return this.conversationsService
        .prepareConversationMessageStream(actorUserId, conversationId, body)
        .then(async (prepared) => {
          this.conversationMessageStreamingService.startSse(res);

          let resAlive = true;

          try {
            await this.conversationsService.executePreparedConversationMessageStream(
              prepared,
              (event) => {
                if (!resAlive) return; // client already gone — skip write, don't throw
                try {
                  this.conversationMessageStreamingService.writeEvent(res, event);
                } catch {
                  // SSE connection closed mid-stream — mark dead but let execution continue
                  // so DB persists still happen (message will be visible on next load)
                  resAlive = false;
                }
              },
            );
          } finally {
            if (resAlive) {
              this.conversationMessageStreamingService.endSse(res);
            }
          }
        });
    }

    return this.conversationsService.sendConversationMessage(
      actorUserId,
      conversationId,
      body,
    );
  }

  @Patch('conversations/:conversationId')
  updateConversation(
    @CurrentUserId() actorUserId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Body() body: UpdateConversationDto,
  ): Promise<ConversationRecord> {
    return this.conversationsService.updateConversation(
      actorUserId,
      conversationId,
      body,
    );
  }

  @Post('conversations/:conversationId/messages/abort')
  @HttpCode(HttpStatus.OK)
  @SkipAuth()
  async abortConversationReply(
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<{ ok: boolean; cancelled: boolean; agentStopped: boolean }> {
    const sessionInfo = this.streamRegistry.cancelByConversationId(conversationId);
    if (!sessionInfo) {
      return { ok: true, cancelled: false, agentStopped: false };
    }

    let agentStopped = false;

    // Forward /stop to the OpenClaw plugin's abort route to halt the active agent run
    if (sessionInfo.profileSlug && sessionInfo.conversationUuid) {
      try {
        const config = this.configService.get<OpenClawConfig>('openclaw');
        const inboundUrl = config?.hearthChannelInboundUrl ?? 'http://127.0.0.1:18789/channel/hearth-app/inbound';
        const abortUrl = inboundUrl.replace(/\/inbound$/, '/abort');
        const token = config?.hearthChannelToken ?? '';

        const res = await fetch(abortUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            agentId: sessionInfo.agentId,
            profileSlug: sessionInfo.profileSlug,
            conversationUuid: sessionInfo.conversationUuid,
          }),
          signal: AbortSignal.timeout(5000),
        });
        agentStopped = res.ok;
      } catch (err) {
        // best effort — stream was already cancelled above
        console.error('[conversations] abort: failed to forward /stop to plugin', err);
      }
    }

    return { ok: true, cancelled: true, agentStopped };
  }

  @Post('conversations/:conversationId/archive')
  archiveConversation(
    @CurrentUserId() actorUserId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<ConversationRecord> {
    return this.conversationsService.archiveConversation(
      actorUserId,
      conversationId,
    );
  }

  @Post('conversations/:conversationId/restore')
  restoreConversation(
    @CurrentUserId() actorUserId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<ConversationRecord> {
    return this.conversationsService.restoreConversation(
      actorUserId,
      conversationId,
    );
  }

  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversation(
    @CurrentUserId() actorUserId: number,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<void> {
    return this.conversationsService.deleteConversation(
      actorUserId,
      conversationId,
    );
  }
}
