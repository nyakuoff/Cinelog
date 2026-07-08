import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { BackupData, BackupImportResult } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { BackupService } from './backup.service';
import { BackupDataDto } from './backup.dto';

@ApiTags('backup')
@ApiBearerAuth()
@Controller('backup')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  /** Download the current user's full data as JSON. */
  @Get('export')
  @Header('Content-Disposition', 'attachment; filename="cinelog-backup.json"')
  exportData(@CurrentUser('sub') userId: string): Promise<BackupData> {
    return this.backup.exportUserData(userId);
  }

  /** Restore a previously exported backup into the current account (merge). */
  @Post('import')
  importData(
    @CurrentUser('sub') userId: string,
    @Body() dto: BackupDataDto,
  ): Promise<BackupImportResult> {
    return this.backup.importUserData(userId, dto);
  }
}
