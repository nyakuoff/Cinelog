import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { MediaItem, Prisma } from '@prisma/client';
import {
  ArtworkKind,
  MediaType,
  ProviderId,
  TrackingStatus,
  type ArtworkChoice,
  type ArtworkOptionsResponse,
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
      ...this.scalarFields(d),
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

  private scalarFields(d: ProviderMediaDetails) {
    return {
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
    };
  }

  /** Re-point a mismatched cached title at the correct provider match. The
   *  Cinelog id — and every user's tracking/ratings/history hanging off it —
   *  is preserved; only the cached metadata (and derived season/episode/
   *  artwork-override data, which would otherwise describe the wrong title)
   *  is replaced. */
  async rematch(
    userId: string,
    mediaId: string,
    provider: ProviderId,
    externalId: string,
    type: MediaType,
  ): Promise<MediaDetail> {
    const item = await this.prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (!item) throw new NotFoundException('Media not found');

    const conflict = await this.prisma.mediaItem.findUnique({
      where: { provider_externalId: { provider, externalId } },
    });
    if (conflict && conflict.id !== mediaId) {
      throw new ConflictException('That title is already in your library as a separate entry');
    }

    const details = await this.registry.getDetails(provider, externalId, type);

    await this.prisma.$transaction([
      this.prisma.season.deleteMany({ where: { mediaItemId: mediaId } }),
      this.prisma.userArtwork.deleteMany({ where: { mediaItemId: mediaId } }),
      this.prisma.mediaItem.update({
        where: { id: mediaId },
        data: {
          ...this.scalarFields(details),
          cachedAt: new Date(),
          genres: {
            set: [],
            connectOrCreate: details.genres.map((name) => ({
              where: { name },
              create: { name },
            })),
          },
        },
      }),
    ]);

    return this.getDetail(userId, mediaId);
  }

  /** Assemble the full detail payload for a user, merging their personal state. */
  async getDetail(userId: string, mediaId: string): Promise<MediaDetail> {
    const item = await this.prisma.mediaItem.findUnique({
      where: { id: mediaId },
      include: { genres: true },
    });
    if (!item) throw new NotFoundException('Media not found');

    const raw = this.parseRaw(item.rawMetadata);
    const [status, rating, community, artworkOverrides] = await Promise.all([
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
      this.prisma.userArtwork.findMany({ where: { userId, mediaItemId: mediaId } }),
    ]);
    const posterOverride = artworkOverrides.find((a) => a.type === 'POSTER')?.url;
    const backdropOverride = artworkOverrides.find((a) => a.type === 'BACKDROP')?.url;

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
      posterUrl: this.artwork.toProxyUrl(posterOverride ?? item.posterPath),
      backdropUrl: this.artwork.toProxyUrl(backdropOverride ?? item.backdropPath),
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

  /** Every poster/backdrop the provider offers, plus which one is currently
   *  effective for this user (their override, or the shared default). */
  async getArtworkOptions(userId: string, mediaId: string): Promise<ArtworkOptionsResponse> {
    const item = await this.prisma.mediaItem.findUnique({ where: { id: mediaId } });
    if (!item) throw new NotFoundException('Media not found');

    const raw = this.parseRaw(item.rawMetadata);
    const overrides = await this.prisma.userArtwork.findMany({ where: { userId, mediaItemId: mediaId } });
    const posterOverride = overrides.find((a) => a.type === 'POSTER')?.url ?? null;
    const backdropOverride = overrides.find((a) => a.type === 'BACKDROP')?.url ?? null;

    const posters = this.artworkChoices(raw, 'POSTER', item.posterPath);
    const backdrops = this.artworkChoices(raw, 'BACKDROP', item.backdropPath);

    return {
      mediaId,
      posters,
      backdrops,
      selectedPoster: posterOverride ?? item.posterPath,
      selectedBackdrop: backdropOverride ?? item.backdropPath,
      hasPosterOverride: posterOverride !== null,
      hasBackdropOverride: backdropOverride !== null,
    };
  }

  /** Set (or clear, when sourceUrl is null) the user's artwork override. The
   *  chosen URL must be one of the options actually offered for this media. */
  async setArtwork(
    userId: string,
    mediaId: string,
    kind: ArtworkKind,
    sourceUrl: string | null,
  ): Promise<void> {
    if (sourceUrl === null) {
      await this.prisma.userArtwork.deleteMany({
        where: { userId, mediaItemId: mediaId, type: kind },
      });
      return;
    }

    const options = await this.getArtworkOptions(userId, mediaId);
    const valid = (kind === 'POSTER' ? options.posters : options.backdrops).some(
      (c) => c.sourceUrl === sourceUrl,
    );
    if (!valid) throw new BadRequestException('That artwork is not available for this title');

    await this.prisma.userArtwork.upsert({
      where: { userId_mediaItemId_type: { userId, mediaItemId: mediaId, type: kind } },
      create: { userId, mediaItemId: mediaId, type: kind, url: sourceUrl },
      update: { url: sourceUrl },
    });
  }

  private artworkChoices(
    raw: ProviderMediaDetails | null,
    kind: ArtworkKind,
    defaultUrl: string | null,
  ): ArtworkChoice[] {
    const fromProvider = (raw?.artwork ?? []).filter((a) => a.type === kind);
    const seen = new Set<string>();
    const choices: ArtworkChoice[] = [];

    // Ensure the current default is always selectable, even if the cached
    // artwork list predates this feature or the provider omitted it.
    const ordered = defaultUrl
      ? [
          ...fromProvider.filter((a) => a.url === defaultUrl),
          ...fromProvider.filter((a) => a.url !== defaultUrl),
        ]
      : fromProvider;

    for (const a of ordered) {
      if (seen.has(a.url)) continue;
      seen.add(a.url);
      choices.push({
        sourceUrl: a.url,
        previewUrl: this.artwork.toProxyUrl(a.url)!,
        width: a.width,
        height: a.height,
        language: a.language,
      });
    }
    if (defaultUrl && !seen.has(defaultUrl)) {
      choices.unshift({
        sourceUrl: defaultUrl,
        previewUrl: this.artwork.toProxyUrl(defaultUrl)!,
        width: null,
        height: null,
        language: null,
      });
    }
    return choices;
  }

  private parseRaw(json: string): ProviderMediaDetails | null {
    try {
      return JSON.parse(json) as ProviderMediaDetails;
    } catch {
      return null;
    }
  }
}
