import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetProfilePinDto {
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  pin!: string;
}
