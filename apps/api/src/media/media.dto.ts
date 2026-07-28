import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  AdminUpdateCastRequest,
  MediaRef,
  MediaType,
  RematchRequest,
  SetPosterRequest,
} from '@cinelog/contracts';

export const SearchQuery = z.object({
  q: z.string().min(1, 'Query is required'),
  type: MediaType.optional(),
});

export class SearchQueryDto extends createZodDto(SearchQuery) {}
export class MediaRefDto extends createZodDto(MediaRef) {}
export class SetPosterDto extends createZodDto(SetPosterRequest) {}
export class RematchDto extends createZodDto(RematchRequest) {}
export class AdminUpdateCastDto extends createZodDto(AdminUpdateCastRequest) {}
