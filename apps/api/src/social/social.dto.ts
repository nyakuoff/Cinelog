import { createZodDto } from 'nestjs-zod';
import { ActivityFeedQuery, MemberListQuery } from '@cinelog/contracts';

export class MemberListQueryDto extends createZodDto(MemberListQuery) {}
export class ActivityFeedQueryDto extends createZodDto(ActivityFeedQuery) {}
