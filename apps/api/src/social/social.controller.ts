import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ActivityFeedResponse,
  FollowStateResponse,
  MemberListResponse,
} from '@cinelog/contracts';
import { CurrentUser, Public } from '../common/decorators';
import { SocialService } from './social.service';
import { ActivityFeedQueryDto, MemberListQueryDto } from './social.dto';

@ApiTags('social')
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Public()
  @Get('members')
  listMembers(
    @CurrentUser('sub') viewerId: string | undefined,
    @Query() query: MemberListQueryDto,
  ): Promise<MemberListResponse> {
    return this.social.listMembers(viewerId, query);
  }

  @Public()
  @Get('users/:username/followers')
  followers(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
    @Query('cursor') cursor?: string,
  ): Promise<MemberListResponse> {
    return this.social.listFollowers(username, viewerId, cursor);
  }

  @Public()
  @Get('users/:username/following')
  following(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
    @Query('cursor') cursor?: string,
  ): Promise<MemberListResponse> {
    return this.social.listFollowing(username, viewerId, cursor);
  }

  @ApiBearerAuth()
  @Post('users/:username/follow')
  follow(
    @CurrentUser('sub') viewerId: string,
    @Param('username') username: string,
  ): Promise<FollowStateResponse> {
    return this.social.follow(viewerId, username);
  }

  @ApiBearerAuth()
  @Delete('users/:username/follow')
  unfollow(
    @CurrentUser('sub') viewerId: string,
    @Param('username') username: string,
  ): Promise<FollowStateResponse> {
    return this.social.unfollow(viewerId, username);
  }

  @ApiBearerAuth()
  @Post('users/:username/block')
  @HttpCode(204)
  async block(
    @CurrentUser('sub') viewerId: string,
    @Param('username') username: string,
  ): Promise<void> {
    await this.social.block(viewerId, username);
  }

  @ApiBearerAuth()
  @Delete('users/:username/block')
  @HttpCode(204)
  async unblock(
    @CurrentUser('sub') viewerId: string,
    @Param('username') username: string,
  ): Promise<void> {
    await this.social.unblock(viewerId, username);
  }

  @ApiBearerAuth()
  @Get('blocked')
  blocked(@CurrentUser('sub') viewerId: string): Promise<MemberListResponse> {
    return this.social.listBlocked(viewerId);
  }

  @ApiBearerAuth()
  @Get('activity')
  feed(
    @CurrentUser('sub') viewerId: string,
    @Query() query: ActivityFeedQueryDto,
  ): Promise<ActivityFeedResponse> {
    return this.social.getFeed(viewerId, query);
  }
}
