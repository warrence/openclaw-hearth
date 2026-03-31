import { IsBoolean, IsInt, IsOptional, IsUrl, MaxLength } from 'class-validator';

export class UpdatePushPresenceDto {
  @IsUrl()
  @MaxLength(4096)
  endpoint!: string;

  @IsOptional()
  @IsInt()
  conversation_id?: number | null;

  @IsBoolean()
  is_visible!: boolean;
}
