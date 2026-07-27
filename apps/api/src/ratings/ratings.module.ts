import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SocialModule } from '../social/social.module';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [MediaModule, SocialModule],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
