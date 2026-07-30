import { Module } from '@nestjs/common';
import { ArtworkModule } from '../artwork/artwork.module';
import { MetadataModule } from '../metadata/metadata.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  imports: [ArtworkModule, MetadataModule],
  controllers: [SettingsController, AvailabilityController],
  providers: [SettingsService, AvailabilityService],
  exports: [SettingsService],
})
export class SettingsModule {}
