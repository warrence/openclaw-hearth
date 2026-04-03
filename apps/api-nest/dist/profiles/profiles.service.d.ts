import { PinHashService } from '../auth/pin-hash.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { SetProfilePinDto } from './dto/set-profile-pin.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileRecord, ProfilesRepository } from './profiles.repository';
import { ProfileCleanupService } from './profile-cleanup.service';
export declare class ProfilesService {
    private readonly profilesRepository;
    private readonly pinHashService;
    private readonly profileCleanupService;
    constructor(profilesRepository: ProfilesRepository, pinHashService: PinHashService, profileCleanupService: ProfileCleanupService);
    listProfiles(): Promise<ProfileRecord[]>;
    createProfile(body: CreateProfileDto): Promise<ProfileRecord>;
    updateProfile(profileId: number, body: UpdateProfileDto): Promise<ProfileRecord>;
    setPin(profileId: number, body: SetProfilePinDto): Promise<{
        ok: true;
        pin_set_at: string | null;
    }>;
    resetPin(profileId: number): Promise<{
        ok: true;
    }>;
    deleteProfile(profileId: number): Promise<{
        ok: true;
    }>;
    private resolveCreateSlug;
    private normalizeSubmittedSlug;
    private slugify;
    private slugValidationException;
}
