import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MediaRef, MediaType } from '@cinelog/contracts';

export const SearchQuery = z.object({
  q: z.string().min(1, 'Query is required'),
  type: MediaType.optional(),
});

export class SearchQueryDto extends createZodDto(SearchQuery) {}
export class MediaRefDto extends createZodDto(MediaRef) {}
