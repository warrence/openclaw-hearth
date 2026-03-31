import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class TestGatewayConnectionDto {
  @IsUrl({
    require_tld: false,
    protocols: ['http', 'https', 'ws', 'wss'],
  })
  @MaxLength(2048)
  base_url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  token?: string | null;
}
