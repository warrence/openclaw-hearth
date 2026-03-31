import { IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateGatewayConfigDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsUrl({
    require_tld: false,
    protocols: ['http', 'https', 'ws', 'wss'],
  })
  @MaxLength(2048)
  base_url!: string;

  @IsString()
  @MaxLength(4096)
  token!: string;
}
