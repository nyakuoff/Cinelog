import { createZodDto } from 'nestjs-zod';
import {
  MediaRef,
  MarkWatchedRequest,
  SetFlagRequest,
  SetStatusRequest,
  UpdateWatchEntryRequest,
} from '@cinelog/contracts';

export class SetStatusDto extends createZodDto(SetStatusRequest) {}
export class SetFlagDto extends createZodDto(SetFlagRequest) {}
export class MarkWatchedDto extends createZodDto(MarkWatchedRequest) {}
export class UpdateWatchEntryDto extends createZodDto(UpdateWatchEntryRequest) {}
export class UnwatchDto extends createZodDto(MediaRef) {}
