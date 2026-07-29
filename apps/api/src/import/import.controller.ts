import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ImportSummary } from '@cinelog/contracts';
import { CurrentUser } from '../common/decorators';
import { ImportService } from './import.service';
import { LetterboxdImportDto } from './import.dto';

@ApiTags('import')
@ApiBearerAuth()
@Controller('import')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  /**
   * Import a Letterboxd export. The web app unzips the archive and merges its
   * CSVs into one record per title before posting, so this takes a whole
   * export in a single call rather than one file at a time.
   */
  @Post('letterboxd')
  letterboxd(
    @CurrentUser('sub') userId: string,
    @Body() dto: LetterboxdImportDto,
  ): Promise<ImportSummary> {
    return this.imports.importLetterboxd(userId, dto);
  }
}
