import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { SocialModule } from '../social/social.module';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';

@Module({
  imports: [ArtworkModule, SocialModule],
  controllers: [ListsController],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}
