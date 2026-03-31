import { IsInt, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsInt()
  profile_id!: number;

  @IsString()
  @MaxLength(20)
  pin!: string;
}
