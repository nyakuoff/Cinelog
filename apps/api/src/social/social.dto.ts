import { createZodDto } from 'nestjs-zod';
import {
  ActivityFeedQuery,
  CommunitySearchQuery,
  MemberListQuery,
  ProfileActivityQuery,
} from '@cinelog/contracts';

export class MemberListQueryDto extends createZodDto(MemberListQuery) {}
export class ActivityFeedQueryDto extends createZodDto(ActivityFeedQuery) {}
export class ProfileActivityQueryDto extends createZodDto(ProfileActivityQuery) {}
export class CommunitySearchQueryDto extends createZodDto(CommunitySearchQuery) {}
