import { createZodDto } from 'nestjs-zod';
import { UpdateFavoritesRequest } from '@cinelog/contracts';

export class UpdateFavoritesDto extends createZodDto(UpdateFavoritesRequest) {}
