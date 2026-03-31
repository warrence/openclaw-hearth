import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ProfileCleanupService } from './profile-cleanup.service';
import { ProfilesController } from './profiles.controller';
import { ProfilesRepository } from './profiles.repository';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ProfilesController],
  providers: [ProfilesRepository, ProfilesService, ProfileCleanupService],
})
export class ProfilesModule {}
