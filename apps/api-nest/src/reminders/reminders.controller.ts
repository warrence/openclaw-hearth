import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RemindersRepository } from './reminders.repository';

@Controller('api')
@UseGuards(SessionAuthGuard)
export class RemindersController {
  constructor(private readonly repository: RemindersRepository) {}

  @Get('users/:userId/reminders')
  async listReminders(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Owner can list all; member can only list their own
    const isOwner = user.role === 'owner';
    const targetUserId = isOwner ? (userId === 0 ? undefined : userId) : user.id;

    const reminders = await this.repository.listReminders({
      userId: targetUserId,
      status: status || 'pending',
    });

    return reminders.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      message_text: r.message_text,
      fire_at: r.fire_at,
      status: r.status,
      critical: r.critical,
      repeat_count: r.repeat_count,
      created_at: r.created_at,
    }));
  }

  @Post('reminders/:id/cancel')
  async cancelReminder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const isOwner = user.role === 'owner';
    // Owner can cancel any; member can only cancel their own
    const cancelled = await this.repository.cancelReminder(
      id,
      isOwner ? undefined : user.id,
    );

    return { ok: cancelled, id };
  }
}
