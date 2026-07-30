import { Module } from '@nestjs/common';
import { MetadataModule } from '../metadata/metadata.module';
import { ArtworkModule } from '../artwork/artwork.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [MetadataModule, ArtworkModule],
  controllers: [PeopleController],
  providers: [PeopleService],
})
export class PeopleModule {}
