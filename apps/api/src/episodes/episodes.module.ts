import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { EpisodesController } from './episodes.controller';
import { EpisodesService } from './episodes.service';

@Module({
  imports: [MetadataModule, ArtworkModule],
  controllers: [EpisodesController],
  providers: [EpisodesService],
  exports: [EpisodesService],
})
export class EpisodesModule {}
