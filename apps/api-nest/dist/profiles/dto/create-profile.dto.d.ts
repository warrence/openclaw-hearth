export declare class CreateProfileDto {
    name: string;
    slug?: string | null;
    avatar?: string | null;
    role: 'owner' | 'member';
    default_agent_id?: string | null;
    is_active?: boolean;
}
