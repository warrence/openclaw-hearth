import { CreateProfileDto } from './dto/create-profile.dto';
import { SetProfilePinDto } from './dto/set-profile-pin.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileRecord } from './profiles.repository';
import { ProfilesService } from './profiles.service';
export declare class ProfilesController {
    private readonly profilesService;
    constructor(profilesService: ProfilesService);
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
}
