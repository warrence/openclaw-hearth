import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatar?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['owner', 'member'])
  role?: 'owner' | 'member';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  default_agent_id?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
