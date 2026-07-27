import { createZodDto } from 'nestjs-zod';
import {
  CreateReviewCommentRequest,
  CreateReviewRequest,
  ReviewListQuery,
  UpdateReviewCommentRequest,
  UpdateReviewRequest,
} from '@cinelog/contracts';

export class CreateReviewDto extends createZodDto(CreateReviewRequest) {}
export class UpdateReviewDto extends createZodDto(UpdateReviewRequest) {}
export class ReviewListQueryDto extends createZodDto(ReviewListQuery) {}
export class CreateReviewCommentDto extends createZodDto(CreateReviewCommentRequest) {}
export class UpdateReviewCommentDto extends createZodDto(UpdateReviewCommentRequest) {}
