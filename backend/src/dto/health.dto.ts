import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class HealthDto {
  @IsOptional()
  @IsString()
  message?: string;
}

