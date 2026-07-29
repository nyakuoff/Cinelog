import { createZodDto } from 'nestjs-zod';
import { LetterboxdImportRequest } from '@cinelog/contracts';

export class LetterboxdImportDto extends createZodDto(LetterboxdImportRequest) {}
