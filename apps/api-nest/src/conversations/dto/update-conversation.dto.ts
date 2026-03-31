import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  agent_id?: string;

  @IsOptional()
  @IsIn(['fast', 'deep'])
  model_preset?: 'fast' | 'deep';

  @IsOptional()
  @IsIn(['active', 'archived'])
  status?: 'active' | 'archived';
}
