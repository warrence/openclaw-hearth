import { HearthOutboundPayload, OutboundMessageService } from './outbound-message.service';
export declare class HearthChannelOutboundController {
    private readonly outboundMessageService;
    constructor(outboundMessageService: OutboundMessageService);
    receiveOutbound(body: HearthOutboundPayload): Promise<{
        ok: true;
    }>;
}
