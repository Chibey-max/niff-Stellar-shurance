import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BackfillDto {
  @ApiProperty({ description: 'First ledger in the backfill range (inclusive)', minimum: 1 })
  @IsInt()
  @Min(1)
  fromLedger!: number;

  @ApiProperty({ description: 'Last ledger in the backfill range (inclusive)', minimum: 1 })
  @IsInt()
  @Min(1)
  toLedger!: number;

  @ApiPropertyOptional({
    description: 'Stellar network id. Defaults to server config.',
    example: 'testnet',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{0,62}$/i)
  network?: string;
}
