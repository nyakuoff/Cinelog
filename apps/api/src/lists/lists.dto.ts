import { createZodDto } from 'nestjs-zod';
import {
  AddListItemRequest,
  CreateListCommentRequest,
  CreateListRequest,
  ListBrowseQuery,
  ReorderListRequest,
  UpdateListItemRequest,
  UpdateListRequest,
} from '@cinelog/contracts';

export class CreateListDto extends createZodDto(CreateListRequest) {}
export class UpdateListDto extends createZodDto(UpdateListRequest) {}
export class AddListItemDto extends createZodDto(AddListItemRequest) {}
export class UpdateListItemDto extends createZodDto(UpdateListItemRequest) {}
export class ReorderListDto extends createZodDto(ReorderListRequest) {}
export class ListBrowseQueryDto extends createZodDto(ListBrowseQuery) {}
export class CreateListCommentDto extends createZodDto(CreateListCommentRequest) {}
