import { createZodDto } from 'nestjs-zod';
import {
  ProfileDiaryQuery,
  ProfileLikesQuery,
  ProfileWatchedQuery,
  UpdateFavoritesRequest,
} from '@cinelog/contracts';

export class UpdateFavoritesDto extends createZodDto(UpdateFavoritesRequest) {}
export class ProfileDiaryQueryDto extends createZodDto(ProfileDiaryQuery) {}
export class ProfileWatchedQueryDto extends createZodDto(ProfileWatchedQuery) {}
export class ProfileLikesQueryDto extends createZodDto(ProfileLikesQuery) {}
