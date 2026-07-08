import { createZodDto } from 'nestjs-zod';
import { SetEpisodeRatingRequest } from '@cinelog/contracts';

export class SetEpisodeRatingDto extends createZodDto(SetEpisodeRatingRequest) {}
