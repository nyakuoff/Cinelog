import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [MediaModule, ArtworkModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
