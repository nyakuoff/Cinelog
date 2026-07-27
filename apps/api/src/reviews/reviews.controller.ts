import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  Review,
  ReviewComment,
  ReviewCommentListResponse,
  ReviewListResponse,
} from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewCommentDto,
  CreateReviewDto,
  ReviewListQueryDto,
  UpdateReviewCommentDto,
  UpdateReviewDto,
} from './reviews.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('media/:id/reviews')
  create(
    @CurrentUser('sub') userId: string,
    @Param('id') mediaId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<Review> {
    return this.reviews.create(userId, mediaId, dto);
  }

  @Get('media/:id/reviews')
  list(
    @CurrentUser('sub') userId: string,
    @Param('id') mediaId: string,
    @Query() query: ReviewListQueryDto,
  ): Promise<ReviewListResponse> {
    return this.reviews.list(mediaId, userId, query);
  }

  @Get('reviews/:id')
  getById(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<Review> {
    return this.reviews.getById(id, userId);
  }

  @Patch('reviews/:id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<Review> {
    return this.reviews.update(userId, id, dto);
  }

  @Delete('reviews/:id')
  @HttpCode(204)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    await this.reviews.remove(userId, id);
  }

  @Post('reviews/:id/like')
  @HttpCode(204)
  async like(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    await this.reviews.like(userId, id);
  }

  @Delete('reviews/:id/like')
  @HttpCode(204)
  async unlike(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    await this.reviews.unlike(userId, id);
  }

  @Get('reviews/:id/comments')
  listComments(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ): Promise<ReviewCommentListResponse> {
    return this.reviews.listComments(id, userId, cursor);
  }

  @Post('reviews/:id/comments')
  addComment(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateReviewCommentDto,
  ): Promise<ReviewComment> {
    return this.reviews.addComment(userId, id, dto);
  }

  @Patch('reviews/:reviewId/comments/:commentId')
  updateComment(
    @CurrentUser('sub') userId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateReviewCommentDto,
  ): Promise<ReviewComment> {
    return this.reviews.updateComment(userId, commentId, dto);
  }

  @Delete('reviews/:reviewId/comments/:commentId')
  @HttpCode(204)
  async deleteComment(
    @CurrentUser('sub') userId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    await this.reviews.deleteComment(userId, commentId);
  }
}
