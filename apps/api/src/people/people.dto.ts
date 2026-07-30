import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ProviderId } from '@cinelog/contracts';

/** Which metadata source the id (or name) belongs to; credits carry it along. */
export const PersonQuery = z.object({
  provider: ProviderId.default('tmdb'),
});
export class PersonQueryDto extends createZodDto(PersonQuery) {}

export const PersonByNameQuery = PersonQuery.extend({
  name: z.string().trim().min(1, 'A name is required').max(120),
});
export class PersonByNameQueryDto extends createZodDto(PersonByNameQuery) {}
