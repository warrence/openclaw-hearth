import { Injectable } from '@nestjs/common';

import { ConversationMessageStreamEvent } from './dto/send-conversation-message.dto';

@Injectable()
export class ConversationMessageStreamingService {
  startSse(res: {
    writeHead(statusCode: number, headers: Record<string, string>): unknown;
  }): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
  }

  writeEvent(
    res: {
      write(chunk: string): unknown;
    },
    event: ConversationMessageStreamEvent,
  ): void {
    res.write(this.serializeEvent(event));
  }

  endSse(res: {
    end(): unknown;
  }): void {
    res.end();
  }

  private serializeEvent(event: ConversationMessageStreamEvent): string {
    return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
  }
}
