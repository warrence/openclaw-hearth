import {
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PushSubscriptionKeysDto {
  @IsString()
  @MaxLength(1024)
  p256dh!: string;

  @IsString()
  @MaxLength(1024)
  auth!: string;
}

export class SavePushSubscriptionDto {
  @IsUrl()
  @MaxLength(4096)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contentEncoding?: string | null;
}
