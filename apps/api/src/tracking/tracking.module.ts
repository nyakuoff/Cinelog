import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { SocialModule } from '../social/social.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [MediaModule, ArtworkModule, SocialModule],
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}
