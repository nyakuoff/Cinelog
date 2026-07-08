import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { OgController } from './og.controller';
import { OgService } from './og.service';

@Module({
  imports: [ArtworkModule],
  controllers: [OgController],
  providers: [OgService],
})
export class OgModule {}
