import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class ModelPresetDto {
  @IsString()
  @MaxLength(255)
  model_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  think_level?: string | null;

  @IsOptional()
  @IsBoolean()
  reasoning_enabled?: boolean | null;
}

class ModelPresetsDto {
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ModelPresetDto)
  fast!: ModelPresetDto;

  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ModelPresetDto)
  deep!: ModelPresetDto;
}

export class UpdateModelPresetSettingsDto {
  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => ModelPresetsDto)
  presets!: ModelPresetsDto;
}
