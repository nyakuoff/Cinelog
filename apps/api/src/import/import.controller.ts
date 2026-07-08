import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ImportSummary, LetterboxdSyncResult, LetterboxdSyncStatus } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { ImportService } from './import.service';
import { LetterboxdSyncService } from './letterboxd-sync.service';
import { ConnectLetterboxdDto, LetterboxdImportDto } from './import.dto';

@ApiTags('import')
@ApiBearerAuth()
@Controller('import')
export class ImportController {
  constructor(
    private readonly imports: ImportService,
    private readonly sync: LetterboxdSyncService,
  ) {}

  @Post('letterboxd')
  letterboxd(
    @CurrentUser('sub') userId: string,
    @Body() dto: LetterboxdImportDto,
  ): Promise<ImportSummary> {
    return this.imports.importLetterboxd(userId, dto);
  }

  @Get('letterboxd/status')
  syncStatus(@CurrentUser('sub') userId: string): Promise<LetterboxdSyncStatus> {
    return this.sync.getStatus(userId);
  }

  @Put('letterboxd/connect')
  connect(
    @CurrentUser('sub') userId: string,
    @Body() dto: ConnectLetterboxdDto,
  ): Promise<LetterboxdSyncStatus> {
    return this.sync.connect(userId, dto.username);
  }

  @Delete('letterboxd/connect')
  disconnect(@CurrentUser('sub') userId: string): Promise<LetterboxdSyncStatus> {
    return this.sync.disconnect(userId);
  }

  @Post('letterboxd/sync')
  syncNow(@CurrentUser('sub') userId: string): Promise<LetterboxdSyncResult> {
    return this.sync.sync(userId);
  }
}
