import { NotFoundException } from '@nestjs/common';
import type { MediaType } from '@cinelog/contracts';
import { ProviderRegistry } from './provider-registry.service';
import type {
  MetadataProvider,
  ProviderMediaDetails,
  ProviderSearchResult,
} from './provider.types';

function fakeProvider(
  id: MetadataProvider['id'],
  opts: { supports?: (t: MediaType) => boolean; results?: ProviderSearchResult[] } = {},
): MetadataProvider {
  return {
    id,
    supports: opts.supports ?? (() => true),
    search: async () => opts.results ?? [],
    getDetails: async () => ({ provider: id }) as unknown as ProviderMediaDetails,
  };
}

describe('ProviderRegistry', () => {
  it('honors the per-type preference order', () => {
    const tmdb = fakeProvider('tmdb');
    const tvdb = fakeProvider('tvdb');
    const registry = new ProviderRegistry([tmdb, tvdb]);
    // TV prefers tvdb over tmdb.
    expect(registry.getForType('TV').id).toBe('tvdb');
    // MOVIE has no preference entry -> defaults to tmdb.
    expect(registry.getForType('MOVIE').id).toBe('tmdb');
  });

  it('falls back to any supporting provider when preferred ones opt out', () => {
    const tmdb = fakeProvider('tmdb', { supports: (t) => t !== 'ANIME' });
    const registry = new ProviderRegistry([tmdb]);
    // ANIME prefers anilist/tvdb (absent); tmdb opts out -> no provider.
    expect(() => registry.getForType('ANIME')).toThrow(NotFoundException);
    // But tmdb still serves MOVIE.
    expect(registry.getForType('MOVIE').id).toBe('tmdb');
  });

  it('merges results from all providers and tolerates one failing', async () => {
    const ok = fakeProvider('tmdb', {
      results: [
        {
          provider: 'tmdb',
          externalId: 'movie:1',
          type: 'MOVIE',
          title: 'A',
          originalTitle: null,
          year: 2020,
          overview: null,
          posterUrl: null,
        },
      ],
    });
    const broken: MetadataProvider = {
      id: 'tvdb',
      supports: () => true,
      search: async () => {
        throw new Error('boom');
      },
      getDetails: async () => ({}) as unknown as ProviderMediaDetails,
    };
    const registry = new ProviderRegistry([ok, broken]);
    const results = await registry.search('a');
    expect(results).toHaveLength(1);
    expect(results[0]?.externalId).toBe('movie:1');
  });
});
