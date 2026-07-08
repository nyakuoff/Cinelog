import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { MediaModule } from '../media/media.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { LetterboxdSyncService } from './letterboxd-sync.service';

@Module({
  imports: [MetadataModule, MediaModule],
  controllers: [ImportController],
  providers: [ImportService, LetterboxdSyncService],
})
export class ImportModule {}
