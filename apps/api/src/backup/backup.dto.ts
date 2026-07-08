import { createZodDto } from 'nestjs-zod';
import { BackupData } from '@cinelog/contracts';

export class BackupDataDto extends createZodDto(BackupData) {}
