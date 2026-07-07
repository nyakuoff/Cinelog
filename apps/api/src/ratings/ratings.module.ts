import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [MediaModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
