import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import {
  HearthOutboundPayload,
  OutboundMessageService,
} from './outbound-message.service';

@Controller('api/channel/hearth-app')
export class HearthChannelOutboundController {
  constructor(
    private readonly outboundMessageService: OutboundMessageService,
  ) {}

  @Post('outbound')
  @HttpCode(202)
  async receiveOutbound(
    @Body() body: HearthOutboundPayload,
  ): Promise<{ ok: true }> {
    await this.outboundMessageService.deliverOutboundMessage(body);
    return { ok: true };
  }
}
