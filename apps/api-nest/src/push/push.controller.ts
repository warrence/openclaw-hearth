import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUserId } from '../auth/current-user.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { UpdatePushPresenceDto } from './dto/update-push-presence.dto';
import { PushService } from './push.service';

@Controller('api')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('push/public-key')
  getPublicKey(): { public_key: string } {
    return this.pushService.getPublicKey();
  }

  @Post('users/:userId/push-subscriptions')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  saveSubscription(
    @CurrentUserId() actorUserId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: SavePushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.pushService.saveSubscription(actorUserId, userId, body, userAgent);
  }

  @Post('users/:userId/push-subscriptions/presence')
  @UseGuards(SessionAuthGuard)
  updatePresence(
    @CurrentUserId() actorUserId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: UpdatePushPresenceDto,
  ) {
    return this.pushService.updatePresence(actorUserId, userId, body);
  }

  @Delete('users/:userId/push-subscriptions')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSubscription(
    @CurrentUserId() actorUserId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: DeletePushSubscriptionDto,
  ): Promise<void> {
    await this.pushService.deleteSubscription(actorUserId, userId, body);
  }
}
