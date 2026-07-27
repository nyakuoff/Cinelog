import { createZodDto } from 'nestjs-zod';
import { BrowseQuery, DiscoverFilterQuery } from '@cinelog/contracts';

export class DiscoverFilterDto extends createZodDto(DiscoverFilterQuery) {}
export class BrowseDto extends createZodDto(BrowseQuery) {}
