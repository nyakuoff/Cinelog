import { Injectable, NotFoundException } from '@nestjs/common';
import type { MediaItem, Prisma } from '@prisma/client';
import {
  MediaType,
  ProviderId,
  TrackingStatus,
  type MediaDetail,
  type MediaRef,
  type SearchResponse,
  type SearchResult,
  type UserMediaState,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistry } from '../metadata/provider-registry.service';
import type { ProviderMediaDetails } from '../metadata/provider.types';
import { ArtworkService } from '../artwork/artwork.service';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly artwork: ArtworkService,
  ) {}

  /** Global search. Marks results already cached locally with their Cinelog id. */
  async search(query: string, type?: MediaType): Promise<SearchResponse> {
    const q = query.trim();
    if (!q) return { query: q, results: [] };

    const found = await this.registry.search(q, type);
    const keys = found.map((r) => ({ provider: r.provider, externalId: r.externalId }));
    const existing = keys.length
      ? await this.prisma.mediaItem.findMany({
          where: { OR: keys },
          select: { id: true, provider: true, externalId: true },
        })
      : [];
    const idByKey = new Map(existing.map((e) => [`${e.provider}:${e.externalId}`, e.id]));

    const results: SearchResult[] = found.map((r) => ({
      id: idByKey.get(`${r.provider}:${r.externalId}`) ?? null,
      provider: r.provider,
      externalId: r.externalId,
      type: r.type,
      title: r.title,
      originalTitle: r.originalTitle,
      year: r.year,
      overview: r.overview,
      posterUrl: this.artwork.toProxyUrl(r.posterUrl),
    }));
    return { query: q, results };
  }

  /** Fetch-through-cache: return the cached MediaItem for a ref, pulling from the
   *  provider and persisting it on a miss. Every tracking/rating path funnels
   *  through here so a MediaItem always exists before user data references it. */
  async resolveRef(ref: MediaRef): Promise<MediaItem> {
    if (ref.mediaId) {
      const item = await this.prisma.mediaItem.findUnique({ where: { id: ref.mediaId } });
      if (!item) throw new NotFoundException('Media not found');
      return item;
    }
    const provider = ProviderId.parse(ref.provider);
    const type = MediaType.parse(ref.type);
    return this.getOrFetch(provider, ref.externalId as string, type);
  }

  async getOrFetch(
    provider: ProviderId,
    externalId: string,
    type: MediaType,
  ): Promise<MediaItem> {
    const existing = await this.prisma.mediaItem.findUnique({
      where: { provider_externalId: { provider, externalId } },
    });
    if (existing) return existing;

    const details = await this.registry.getDetails(provider, externalId, type);
    return this.cacheDetails(details);
  }

  private async cacheDetails(d: ProviderMediaDetails): Promise<MediaItem> {
    const data: Prisma.MediaItemCreateInput = {
      type: d.type,
      provider: d.provider,
      externalId: d.externalId,
      title: d.title,
      originalTitle: d.originalTitle,
      releaseDate: d.releaseDate,
      runtime: d.runtime,
      overview: d.overview,
      tagline: d.tagline,
      posterPath: d.posterUrl,
      backdropPath: d.backdropUrl,
      logoPath: d.logoUrl,
      providerRating: d.providerRating,
      rawMetadata: JSON.stringify(d),
      genres: {
        connectOrCreate: d.genres.map((name) => ({
          where: { name },
          create: { name },
        })),
      },
    };
    return this.prisma.mediaItem.upsert({
      where: { provider_externalId: { provider: d.provider, externalId: d.externalId } },
      create: data,
      update: data,
    });
  }

  /** Assemble the full detail payload for a user, merging their personal state. */
  async getDetail(userId: string, mediaId: string): Promise<MediaDetail> {
    const item = await this.prisma.mediaItem.findUnique({
      where: { id: mediaId },
      include: { genres: true },
    });
    if (!item) throw new NotFoundException('Media not found');

    const raw = this.parseRaw(item.rawMetadata);
    const [status, rating, community] = await Promise.all([
      this.prisma.userMediaStatus.findUnique({
        where: { userId_mediaItemId: { userId, mediaItemId: mediaId } },
      }),
      this.prisma.rating.findUnique({
        where: { userId_mediaItemId: { userId, mediaItemId: mediaId } },
      }),
      this.prisma.rating.aggregate({
        where: { mediaItemId: mediaId },
        _avg: { value: true },
      }),
    ]);

    const userState: UserMediaState = {
      status: status?.status ? (TrackingStatus.safeParse(status.status).data ?? null) : null,
      isFavorite: status?.isFavorite ?? false,
      isWatchlisted: status?.isWatchlisted ?? false,
      rewatchCount: status?.rewatchCount ?? 0,
      rating: rating?.value ?? null,
      startedAt: status?.startedAt?.toISOString() ?? null,
      completedAt: status?.completedAt?.toISOString() ?? null,
    };

    return {
      id: item.id,
      provider: ProviderId.catch('tmdb').parse(item.provider),
      externalId: item.externalId,
      type: MediaType.catch('MOVIE').parse(item.type),
      title: item.title,
      originalTitle: item.originalTitle,
      releaseDate: item.releaseDate,
      runtime: item.runtime,
      overview: item.overview,
      tagline: item.tagline,
      posterUrl: this.artwork.toProxyUrl(item.posterPath),
      backdropUrl: this.artwork.toProxyUrl(item.backdropPath),
      logoUrl: this.artwork.toProxyUrl(item.logoPath),
      genres: item.genres.map((g) => ({ id: g.id, name: g.name })),
      studios: raw?.studios ?? [],
      cast: (raw?.cast ?? []).map((c, i) => ({
        id: `${item.id}-cast-${i}`,
        name: c.name,
        role: c.role,
        character: c.character,
        department: c.department,
        profileUrl: this.artwork.toProxyUrl(c.profileUrl),
      })),
      crew: (raw?.crew ?? []).map((c, i) => ({
        id: `${item.id}-crew-${i}`,
        name: c.name,
        role: c.role,
        character: c.character,
        department: c.department,
        profileUrl: this.artwork.toProxyUrl(c.profileUrl),
      })),
      trailerUrl: raw?.trailerUrl ?? null,
      providerRating: item.providerRating,
      communityRating: community._avg.value ?? null,
      userState,
    };
  }

  private parseRaw(json: string): ProviderMediaDetails | null {
    try {
      return JSON.parse(json) as ProviderMediaDetails;
    } catch {
      return null;
    }
  }
}
