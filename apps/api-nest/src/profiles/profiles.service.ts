import {
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { PinHashService } from '../auth/pin-hash.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { SetProfilePinDto } from './dto/set-profile-pin.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ProfileRecord,
  ProfilesRepository,
  UpdateProfileInput,
} from './profiles.repository';
import { ProfileCleanupService } from './profile-cleanup.service';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly pinHashService: PinHashService,
    private readonly profileCleanupService: ProfileCleanupService,
  ) {}

  listProfiles(): Promise<ProfileRecord[]> {
    return this.profilesRepository.listProfiles();
  }

  async createProfile(body: CreateProfileDto): Promise<ProfileRecord> {
    const slug = await this.resolveCreateSlug(body.name, body.slug ?? undefined);

    return this.profilesRepository.createProfile({
      name: body.name,
      slug,
      avatar: body.avatar ?? null,
      memory_namespace: `person:${slug}`,
      default_agent_id: body.default_agent_id ?? 'main',
      is_active: body.is_active ?? true,
      role: body.role,
    });
  }

  async updateProfile(
    profileId: number,
    body: UpdateProfileDto,
  ): Promise<ProfileRecord> {
    const update: UpdateProfileInput = {};

    if (body.name !== undefined) {
      update.name = body.name;
    }

    if (body.slug !== undefined) {
      const slug = this.normalizeSubmittedSlug(body.slug);

      if (!slug) {
        throw this.slugValidationException();
      }

      if (await this.profilesRepository.slugExists(slug, profileId)) {
        throw this.slugValidationException();
      }

      update.slug = slug;
    }

    if (body.avatar !== undefined) {
      update.avatar = body.avatar ?? null;
    }

    if (body.default_agent_id !== undefined) {
      update.default_agent_id = body.default_agent_id ?? null;
    }

    if (body.is_active !== undefined) {
      update.is_active = body.is_active;
    }

    if (body.role !== undefined) {
      update.role = body.role;
    }

    return this.profilesRepository.updateProfile(profileId, update);
  }

  async setPin(
    profileId: number,
    body: SetProfilePinDto,
  ): Promise<{ ok: true; pin_set_at: string | null }> {
    const pinHash = await this.pinHashService.hash(body.pin);
    const profile = await this.profilesRepository.setPinHash(profileId, pinHash);

    return {
      ok: true,
      pin_set_at: profile.pin_set_at,
    };
  }

  async resetPin(profileId: number): Promise<{ ok: true }> {
    await this.profilesRepository.resetPin(profileId);

    return { ok: true };
  }

  async deleteProfile(profileId: number): Promise<{ ok: true }> {
    // Collect conversation data before deletion for cleanup
    const conversations = await this.profilesRepository.listProfileConversations(profileId);
    const sessionKeys = conversations
      .map((c) => c.openclaw_session_key)
      .filter((k): k is string => Boolean(k));
    const conversationIds = conversations.map((c) => c.id);

    // Delete all DB records
    await this.profilesRepository.deleteProfile(profileId);

    // Clean up session files and storage (best-effort, after DB deletion)
    await this.profileCleanupService.cleanupProfileData({ profileId, sessionKeys, conversationIds });

    return { ok: true };
  }

  private async resolveCreateSlug(
    name: string,
    submittedSlug?: string,
  ): Promise<string> {
    const normalizedSubmittedSlug = this.normalizeSubmittedSlug(submittedSlug);

    if (normalizedSubmittedSlug) {
      if (await this.profilesRepository.slugExists(normalizedSubmittedSlug)) {
        throw this.slugValidationException();
      }

      return normalizedSubmittedSlug;
    }

    const baseSlug = this.slugify(name);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;

      if (!(await this.profilesRepository.slugExists(slug))) {
        return slug;
      }
    }

    throw new UnprocessableEntityException({
      message: 'The given data was invalid.',
      errors: {
        slug: ['Unable to generate a unique slug.'],
      },
    });
  }

  private normalizeSubmittedSlug(value?: string | null): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed === '' ? undefined : trimmed;
  }

  private slugify(value: string): string {
    const normalized = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return normalized || 'profile';
  }

  private slugValidationException(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'The given data was invalid.',
      errors: {
        slug: ['The slug has already been taken.'],
      },
    });
  }
}
