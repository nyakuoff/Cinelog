import { Module } from '@nestjs/common';
import { ProviderRegistry } from './provider-registry.service';
import { TmdbProvider } from './tmdb.provider';
import { METADATA_PROVIDERS, type MetadataProvider } from './provider.types';

/**
 * Registers all metadata providers behind the ProviderRegistry. To add a new
 * source: implement MetadataProvider, add it here as a provider, and include it
 * in the METADATA_PROVIDERS factory.
 */
@Module({
  providers: [
    TmdbProvider,
    {
      provide: METADATA_PROVIDERS,
      inject: [TmdbProvider],
      useFactory: (tmdb: TmdbProvider): MetadataProvider[] => [tmdb],
    },
    ProviderRegistry,
  ],
  exports: [ProviderRegistry],
})
export class MetadataModule {}
