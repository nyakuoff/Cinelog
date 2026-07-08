import { createZodDto } from 'nestjs-zod';
import { ConnectLetterboxdRequest, LetterboxdImportRequest } from '@cinelog/contracts';

export class LetterboxdImportDto extends createZodDto(LetterboxdImportRequest) {}
export class ConnectLetterboxdDto extends createZodDto(ConnectLetterboxdRequest) {}
