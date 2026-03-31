import { IsUrl, MaxLength } from 'class-validator';

export class DeletePushSubscriptionDto {
  @IsUrl()
  @MaxLength(4096)
  endpoint!: string;
}
