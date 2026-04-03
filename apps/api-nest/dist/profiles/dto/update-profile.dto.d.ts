export declare class UpdateProfileDto {
    name?: string;
    slug?: string;
    avatar?: string | null;
    role?: 'owner' | 'member';
    default_agent_id?: string | null;
    is_active?: boolean;
}
