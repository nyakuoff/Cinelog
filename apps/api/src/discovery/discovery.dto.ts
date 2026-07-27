import { createZodDto } from 'nestjs-zod';
import { DiscoverFilterQuery } from '@cinelog/contracts';

export class DiscoverFilterDto extends createZodDto(DiscoverFilterQuery) {}
