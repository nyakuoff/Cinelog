import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ListComment,
  ListCommentListResponse,
  ListDetail,
  ListListResponse,
} from '@cinelog/contracts';
import { CurrentUser, Public } from '../common/decorators';
import { ListsService } from './lists.service';
import {
  AddListItemDto,
  CreateListCommentDto,
  CreateListDto,
  ListBrowseQueryDto,
  ReorderListDto,
  UpdateListDto,
  UpdateListItemDto,
} from './lists.dto';

@ApiTags('lists')
@Controller()
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Public()
  @Get('lists')
  browse(
    @CurrentUser('sub') viewerId: string | undefined,
    @Query() query: ListBrowseQueryDto,
  ): Promise<ListListResponse> {
    return this.lists.browse(viewerId, query);
  }

  @Public()
  @Get('users/:username/lists')
  byOwner(
    @Param('username') username: string,
    @CurrentUser('sub') viewerId: string | undefined,
  ): Promise<ListListResponse> {
    return this.lists.listByOwner(username, viewerId);
  }

  @Public()
  @Get('lists/:id')
  detail(
    @Param('id') id: string,
    @CurrentUser('sub') viewerId: string | undefined,
  ): Promise<ListDetail> {
    return this.lists.getDetail(id, viewerId);
  }

  @ApiBearerAuth()
  @Post('lists')
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateListDto): Promise<ListDetail> {
    return this.lists.create(userId, dto);
  }

  @ApiBearerAuth()
  @Patch('lists/:id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateListDto,
  ): Promise<ListDetail> {
    return this.lists.update(userId, id, dto);
  }

  @ApiBearerAuth()
  @Delete('lists/:id')
  @HttpCode(204)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    await this.lists.remove(userId, id);
  }

  @ApiBearerAuth()
  @Post('lists/:id/items')
  addItem(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AddListItemDto,
  ): Promise<ListDetail> {
    return this.lists.addItem(userId, id, dto);
  }

  @ApiBearerAuth()
  @Patch('lists/:id/items/:entryId')
  updateItem(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateListItemDto,
  ): Promise<ListDetail> {
    return this.lists.updateItem(userId, id, entryId, dto);
  }

  @ApiBearerAuth()
  @Delete('lists/:id/items/:entryId')
  removeItem(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ): Promise<ListDetail> {
    return this.lists.removeItem(userId, id, entryId);
  }

  @ApiBearerAuth()
  @Put('lists/:id/order')
  reorder(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReorderListDto,
  ): Promise<ListDetail> {
    return this.lists.reorder(userId, id, dto);
  }

  @ApiBearerAuth()
  @Post('lists/:id/like')
  @HttpCode(204)
  async like(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    await this.lists.like(userId, id);
  }

  @ApiBearerAuth()
  @Delete('lists/:id/like')
  @HttpCode(204)
  async unlike(@CurrentUser('sub') userId: string, @Param('id') id: string): Promise<void> {
    await this.lists.unlike(userId, id);
  }

  @Public()
  @Get('lists/:id/comments')
  comments(
    @Param('id') id: string,
    @CurrentUser('sub') viewerId: string | undefined,
    @Query('cursor') cursor?: string,
  ): Promise<ListCommentListResponse> {
    return this.lists.listComments(id, viewerId, cursor);
  }

  @ApiBearerAuth()
  @Post('lists/:id/comments')
  addComment(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateListCommentDto,
  ): Promise<ListComment> {
    return this.lists.addComment(userId, id, dto);
  }

  @ApiBearerAuth()
  @Delete('lists/:id/comments/:commentId')
  @HttpCode(204)
  async deleteComment(
    @CurrentUser('sub') userId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    await this.lists.deleteComment(userId, commentId);
  }
}
