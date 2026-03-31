import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { OwnerAuthGuard } from '../auth/owner-auth.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CreateProfileDto } from './dto/create-profile.dto';
import { SetProfilePinDto } from './dto/set-profile-pin.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileRecord } from './profiles.repository';
import { ProfilesService } from './profiles.service';

@Controller('api/profiles')
@UseGuards(SessionAuthGuard, OwnerAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  listProfiles(): Promise<ProfileRecord[]> {
    return this.profilesService.listProfiles();
  }

  @Post()
  createProfile(@Body() body: CreateProfileDto): Promise<ProfileRecord> {
    return this.profilesService.createProfile(body);
  }

  @Patch(':profileId')
  updateProfile(
    @Param('profileId', ParseIntPipe) profileId: number,
    @Body() body: UpdateProfileDto,
  ): Promise<ProfileRecord> {
    return this.profilesService.updateProfile(profileId, body);
  }

  @Post(':profileId/set-pin')
  setPin(
    @Param('profileId', ParseIntPipe) profileId: number,
    @Body() body: SetProfilePinDto,
  ): Promise<{ ok: true; pin_set_at: string | null }> {
    return this.profilesService.setPin(profileId, body);
  }

  @Post(':profileId/reset-pin')
  resetPin(
    @Param('profileId', ParseIntPipe) profileId: number,
  ): Promise<{ ok: true }> {
    return this.profilesService.resetPin(profileId);
  }

  @Delete(':profileId')
  deleteProfile(
    @Param('profileId', ParseIntPipe) profileId: number,
  ): Promise<{ ok: true }> {
    return this.profilesService.deleteProfile(profileId);
  }
}
