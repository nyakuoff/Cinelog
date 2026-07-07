import { createZodDto } from 'nestjs-zod';
import {
  MarkWatchedRequest,
  SetFlagRequest,
  SetStatusRequest,
} from '@cinelog/contracts';

export class SetStatusDto extends createZodDto(SetStatusRequest) {}
export class SetFlagDto extends createZodDto(SetFlagRequest) {}
export class MarkWatchedDto extends createZodDto(MarkWatchedRequest) {}
