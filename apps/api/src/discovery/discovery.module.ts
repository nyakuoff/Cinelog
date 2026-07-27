import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { MetadataModule } from '../metadata/metadata.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';

@Module({
  imports: [ArtworkModule, MetadataModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
})
export class DiscoveryModule {}
