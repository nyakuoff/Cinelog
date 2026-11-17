import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { ListsModule } from '../lists/lists.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [ArtworkModule, ListsModule, ReviewsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
