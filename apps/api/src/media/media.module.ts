import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { EpisodesModule } from '../episodes/episodes.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [MetadataModule, ArtworkModule, EpisodesModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
