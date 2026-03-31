import { Controller, Get, Param, ParseIntPipe, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Subscription } from 'rxjs';

import { SessionAuthGuard } from '../auth/session-auth.guard';
import { EventBusService } from './event-bus.service';

@Controller('api')
@UseGuards(SessionAuthGuard)
export class EventsController {
  constructor(private readonly eventBus: EventBusService) {}

  @Get('users/:userId/events')
  streamEvents(
    @Param('userId', ParseIntPipe) userId: number,
    @Res() res: any,
  ): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial heartbeat
    res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

    // Keep-alive every 30s
    const keepAlive = setInterval(() => {
      res.write(`: keep-alive\n\n`);
    }, 30000);

    // Subscribe to user events
    const subscription: Subscription = this.eventBus.forUser(userId).subscribe((event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    });

    // Cleanup on disconnect
    res.on('close', () => {
      clearInterval(keepAlive);
      subscription.unsubscribe();
    });
  }
}
