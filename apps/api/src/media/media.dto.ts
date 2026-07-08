import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MediaRef, MediaType, RematchRequest, SetArtworkRequest } from '@cinelog/contracts';

export const SearchQuery = z.object({
  q: z.string().min(1, 'Query is required'),
  type: MediaType.optional(),
});

export class SearchQueryDto extends createZodDto(SearchQuery) {}
export class MediaRefDto extends createZodDto(MediaRef) {}
export class SetArtworkDto extends createZodDto(SetArtworkRequest) {}
export class RematchDto extends createZodDto(RematchRequest) {}
