import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [MetadataModule, ArtworkModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
