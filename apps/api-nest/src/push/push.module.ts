import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PushController } from './push.controller';
import { PushRepository } from './push.repository';
import { PushService } from './push.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [PushController],
  providers: [PushRepository, PushService],
  exports: [PushService, PushRepository],
})
export class PushModule {}
