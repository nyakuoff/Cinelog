import { createZodDto } from 'nestjs-zod';
import { SetRatingRequest } from '@cinelog/contracts';

export class SetRatingDto extends createZodDto(SetRatingRequest) {}
