import {
  ForbiddenException,
  UnauthorizedException,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';

import { OwnerAuthGuard } from '../src/auth/owner-auth.guard';
import { SessionAuthGuard } from '../src/auth/session-auth.guard';
import { PinHashService } from '../src/auth/pin-hash.service';
import { AuthenticatedRequest } from '../src/auth/auth.types';
import { CreateProfileDto } from '../src/profiles/dto/create-profile.dto';
import { UpdateProfileDto } from '../src/profiles/dto/update-profile.dto';
import {
  ProfileRecord,
  ProfilesRepository,
} from '../src/profiles/profiles.repository';
import { ProfilesController } from '../src/profiles/profiles.controller';
import { ProfilesService } from '../src/profiles/profiles.service';

const ownerRequest: AuthenticatedRequest = {
  authUser: {
    id: 1,
    name: 'Owner',
    slug: 'owner',
    avatar: null,
    memory_namespace: 'person:owner',
    default_agent_id: 'aeris',
    is_active: true,
    role: 'owner',
    pin_set_at: '2026-03-24T00:00:00.000Z',
    last_login_at: null,
    requires_pin: true,
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z',
    has_pin: true,
  },
};

const memberRequest: AuthenticatedRequest = {
  authUser: {
    ...ownerRequest.authUser!,
    id: 2,
    role: 'member',
  },
};

const ownerProfile: ProfileRecord = {
  id: 1,
  name: 'Owner',
  slug: 'owner-abc123',
  avatar: null,
  memory_namespace: 'person:owner-abc123',
  default_agent_id: 'aeris',
  is_active: true,
  role: 'owner',
  pin_set_at: '2026-03-24T00:00:00.000Z',
  last_login_at: null,
  requires_pin: true,
  created_at: '2026-03-20T00:00:00.000Z',
  updated_at: '2026-03-20T00:00:00.000Z',
  has_pin: true,
};

const memberProfile: ProfileRecord = {
  id: 2,
  name: 'Member',
  slug: 'member-xyz999',
  avatar: null,
  memory_namespace: 'person:member-xyz999',
  default_agent_id: 'aeris',
  is_active: true,
  role: 'member',
  pin_set_at: null,
  last_login_at: null,
  requires_pin: true,
  created_at: '2026-03-20T00:00:00.000Z',
  updated_at: '2026-03-20T00:00:00.000Z',
  has_pin: false,
};

describe('Nest owner profile management slice', () => {
  let profilesRepository: {
    listProfiles: jest.Mock;
    createProfile: jest.Mock;
    updateProfile: jest.Mock;
    slugExists: jest.Mock;
    setPinHash: jest.Mock;
    resetPin: jest.Mock;
  };
  let profilesService: ProfilesService;
  let profilesController: ProfilesController;
  let sessionAuthGuard: SessionAuthGuard;
  let ownerAuthGuard: OwnerAuthGuard;
  let validationPipe: ValidationPipe;

  beforeEach(() => {
    profilesRepository = {
      listProfiles: jest.fn(async () => [ownerProfile, memberProfile]),
      createProfile: jest.fn(async (input) => ({
        id: 3,
        name: input.name,
        slug: input.slug,
        avatar: input.avatar ?? null,
        memory_namespace: input.memory_namespace,
        default_agent_id: input.default_agent_id,
        is_active: input.is_active,
        role: input.role,
        pin_set_at: null,
        last_login_at: null,
        requires_pin: true,
        created_at: '2026-03-25T00:00:00.000Z',
        updated_at: '2026-03-25T00:00:00.000Z',
        has_pin: false,
      })),
      updateProfile: jest.fn(async (profileId, input) => ({
        ...memberProfile,
        id: profileId,
        ...input,
        updated_at: '2026-03-25T00:00:00.000Z',
      })),
      slugExists: jest.fn(async () => false),
      setPinHash: jest.fn(async (profileId) => ({
        ...memberProfile,
        id: profileId,
        pin_set_at: '2026-03-25T01:02:03.000Z',
        has_pin: true,
        updated_at: '2026-03-25T01:02:03.000Z',
      })),
      resetPin: jest.fn(async () => undefined),
    };
    profilesService = new ProfilesService(
      profilesRepository as unknown as ProfilesRepository,
      {
        hash: jest.fn(async (pin: string) => `hash:${pin}`),
      } as PinHashService,
    );
    profilesController = new ProfilesController(profilesService);
    sessionAuthGuard = new SessionAuthGuard();
    ownerAuthGuard = new OwnerAuthGuard();
    validationPipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
  });

  it('owner can list profiles', async () => {
    expect(allow(ownerRequest)).toBe(true);

    await expect(profilesController.listProfiles()).resolves.toEqual([
      ownerProfile,
      memberProfile,
    ]);
    expect(profilesRepository.listProfiles).toHaveBeenCalled();
  });

  it('member cannot list profiles', () => {
    expect(() => ownerAuthGuard.canActivate(createHttpContext(memberRequest))).toThrow(
      new ForbiddenException('Owner access required.'),
    );
  });

  it('unauthenticated cannot list profiles', () => {
    expect(() => sessionAuthGuard.canActivate(createHttpContext({}))).toThrow(
      new UnauthorizedException('Unauthenticated.'),
    );
  });

  it('list does not expose pin_hash and includes has_pin', async () => {
    const profiles = await profilesController.listProfiles();

    expect(profiles[0]).toHaveProperty('has_pin', true);
    expect(profiles[1]).toHaveProperty('has_pin', false);
    expect(profiles[0]).not.toHaveProperty('pin_hash');
    expect(profiles[1]).not.toHaveProperty('pin_hash');
  });

  it('owner can create and update a profile', async () => {
    const created = await profilesController.createProfile({
      name: 'Sam Lee',
      role: 'member',
    });
    const updated = await profilesController.updateProfile(2, {
      role: 'owner',
      is_active: false,
    });

    expect(created.name).toBe('Sam Lee');
    expect(created.slug).toMatch(/^sam-lee-[a-f0-9]{6}$/);
    expect(created.memory_namespace).toBe(`person:${created.slug}`);
    expect(created.default_agent_id).toBe('aeris');
    expect(updated.role).toBe('owner');
    expect(updated.is_active).toBe(false);
  });

  it('rejects invalid role validation for create and update payloads', async () => {
    await expect(
      validationPipe.transform(
        { name: 'Alex', role: 'admin' },
        {
          type: 'body',
          metatype: CreateProfileDto,
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
    });

    await expect(
      validationPipe.transform(
        { role: 'superadmin' },
        {
          type: 'body',
          metatype: UpdateProfileDto,
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it('owner can set and reset pin', async () => {
    await expect(
      profilesController.setPin(2, { pin: '9876' }),
    ).resolves.toEqual({
      ok: true,
      pin_set_at: '2026-03-25T01:02:03.000Z',
    });
    await expect(profilesController.resetPin(2)).resolves.toEqual({ ok: true });
    expect(profilesRepository.setPinHash).toHaveBeenCalledWith(2, 'hash:9876');
    expect(profilesRepository.resetPin).toHaveBeenCalledWith(2);
  });

  it('member cannot set or reset pin', () => {
    expect(() => ownerAuthGuard.canActivate(createHttpContext(memberRequest))).toThrow(
      new ForbiddenException('Owner access required.'),
    );
  });

  it('returns a Laravel-like slug validation error when the slug is already taken', async () => {
    profilesRepository.slugExists.mockResolvedValue(true);

    await expect(
      profilesService.createProfile({
        name: 'Alex',
        role: 'member',
        slug: 'alex',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

function allow(request: AuthenticatedRequest): boolean {
  const sessionAuthGuard = new SessionAuthGuard();
  const ownerAuthGuard = new OwnerAuthGuard();

  expect(sessionAuthGuard.canActivate(createHttpContext(request))).toBe(true);

  return ownerAuthGuard.canActivate(createHttpContext(request));
}

function createHttpContext(request: AuthenticatedRequest) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}
