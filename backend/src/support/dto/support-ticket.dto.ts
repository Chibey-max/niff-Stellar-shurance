import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class CreateSupportTicketDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  @IsString()
  captchaToken!: string;
}

export class UpdateSupportTicketDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;

  @IsString()
  @MaxLength(500)
  internalNotes?: string;
}

export class SupportTicketResponseDto {
  id!: string;
  email!: string;
  subject!: string;
  message!: string;
  status!: TicketStatus;
  ipHash!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
