import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { ConversationAssistantExecutionService } from './conversation-assistant-execution.service';
import { HearthAppOutboundEvent } from './hearth-channel.types';

/**
 * Receives async reply events from the OpenClaw Hearth native channel plugin.
 *
 * This controller is intentionally NOT protected by SessionAuthGuard —
 * it's an internal service-to-service endpoint.
 *
 * Auth model: the stream token in the URL path acts as a per-request credential
 * (opaque UUID, known only to Nest and the plugin instance that received the
 * matching inbound POST). For additional shared-secret validation, configure
 * HEARTH_CALLBACK_TOKEN and the plugin must be updated to send it as
 * Authorization: Bearer <token>.
 *
 * TODO: When the OpenClaw plugin supports sending a shared secret in the
 * callback POST (e.g. Authorization header), add validation here using
 * HEARTH_CALLBACK_TOKEN env var.
 */
@Controller('api/channel/hearth-app')
export class HearthChannelCallbackController {
  constructor(
    private readonly executionService: ConversationAssistantExecutionService,
  ) {}

  @Post('callback/:token')
  @HttpCode(HttpStatus.OK)
  async handleCallback(
    @Param('token') token: string,
    @Body() body: HearthAppOutboundEvent,
  ): Promise<{ ok: boolean }> {
    if (!body || typeof body.event !== 'string') {
      throw new BadRequestException('Invalid callback payload.');
    }

    const handled = await this.executionService.processHearthCallback(
      token,
      body,
    );

    if (!handled) {
      // Stream already expired/completed — return OK anyway to prevent
      // the plugin from retrying.
      return { ok: false };
    }

    return { ok: true };
  }
}
