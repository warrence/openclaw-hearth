"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilesService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const pin_hash_service_1 = require("../auth/pin-hash.service");
const profiles_repository_1 = require("./profiles.repository");
const profile_cleanup_service_1 = require("./profile-cleanup.service");
let ProfilesService = class ProfilesService {
    profilesRepository;
    pinHashService;
    profileCleanupService;
    constructor(profilesRepository, pinHashService, profileCleanupService) {
        this.profilesRepository = profilesRepository;
        this.pinHashService = pinHashService;
        this.profileCleanupService = profileCleanupService;
    }
    listProfiles() {
        return this.profilesRepository.listProfiles();
    }
    async createProfile(body) {
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
    async updateProfile(profileId, body) {
        const update = {};
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
    async setPin(profileId, body) {
        const pinHash = await this.pinHashService.hash(body.pin);
        const profile = await this.profilesRepository.setPinHash(profileId, pinHash);
        return {
            ok: true,
            pin_set_at: profile.pin_set_at,
        };
    }
    async resetPin(profileId) {
        await this.profilesRepository.resetPin(profileId);
        return { ok: true };
    }
    async deleteProfile(profileId) {
        const conversations = await this.profilesRepository.listProfileConversations(profileId);
        const sessionKeys = conversations
            .map((c) => c.openclaw_session_key)
            .filter((k) => Boolean(k));
        const conversationIds = conversations.map((c) => c.id);
        await this.profilesRepository.deleteProfile(profileId);
        await this.profileCleanupService.cleanupProfileData({ profileId, sessionKeys, conversationIds });
        return { ok: true };
    }
    async resolveCreateSlug(name, submittedSlug) {
        const normalizedSubmittedSlug = this.normalizeSubmittedSlug(submittedSlug);
        if (normalizedSubmittedSlug) {
            if (await this.profilesRepository.slugExists(normalizedSubmittedSlug)) {
                throw this.slugValidationException();
            }
            return normalizedSubmittedSlug;
        }
        const baseSlug = this.slugify(name);
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const slug = `${baseSlug}-${(0, node_crypto_1.randomBytes)(3).toString('hex')}`;
            if (!(await this.profilesRepository.slugExists(slug))) {
                return slug;
            }
        }
        throw new common_1.UnprocessableEntityException({
            message: 'The given data was invalid.',
            errors: {
                slug: ['Unable to generate a unique slug.'],
            },
        });
    }
    normalizeSubmittedSlug(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        const trimmed = value.trim();
        return trimmed === '' ? undefined : trimmed;
    }
    slugify(value) {
        const normalized = value
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return normalized || 'profile';
    }
    slugValidationException() {
        return new common_1.UnprocessableEntityException({
            message: 'The given data was invalid.',
            errors: {
                slug: ['The slug has already been taken.'],
            },
        });
    }
};
exports.ProfilesService = ProfilesService;
exports.ProfilesService = ProfilesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [profiles_repository_1.ProfilesRepository,
        pin_hash_service_1.PinHashService,
        profile_cleanup_service_1.ProfileCleanupService])
], ProfilesService);
