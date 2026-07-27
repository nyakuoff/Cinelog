import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { ActivityService } from './activity.service';

@Module({
  imports: [ArtworkModule],
  controllers: [SocialController],
  providers: [SocialService, ActivityService],
  exports: [SocialService, ActivityService],
})
export class SocialModule {}
