import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [ArtworkModule, ReviewsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
