import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import type { MediaItem } from '@prisma/client';
import type { LetterboxdSyncResult, LetterboxdSyncStatus } from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistry } from '../metadata/provider-registry.service';
import { MediaService } from '../media/media.service';

const RSS_TIMEOUT_MS = 15_000;

interface DiaryEntry {
  filmTitle: string;
  filmYear: number | null;
  watchedDate: string | null;
  rewatch: boolean;
  memberRating: number | null; // 0.5..5, Letterboxd's own scale
  memberLike: boolean;
  tmdbMovieId: string | null;
}

interface RawRssItem {
  filmTitle?: string;
  filmYear?: string | number;
  watchedDate?: string;
  rewatch?: string;
  memberRating?: string | number;
  memberLike?: string;
  movieId?: string | number;
}
interface RssRoot {
  rss?: { channel?: { item?: RawRssItem | RawRssItem[] } };
}

/**
 * Letterboxd has no public write/sync API, so this is a one-way, on-request
 * pull of the user's public diary RSS feed (https://letterboxd.com/<user>/rss/)
 * — a legitimate, intentionally public feed, not scraping. The feed only
 * exposes the ~50 most recent entries; the CSV import (ImportService) remains
 * the way to backfill full history.
 */
@Injectable()
export class LetterboxdSyncService {
  private readonly logger = new Logger(LetterboxdSyncService.name);
  private readonly parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true });

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly media: MediaService,
  ) {}

  async getStatus(userId: string): Promise<LetterboxdSyncStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      connectedUsername: user.letterboxdUsername,
      lastSyncedAt: user.letterboxdSyncedAt?.toISOString() ?? null,
    };
  }

  async connect(userId: string, username: string): Promise<LetterboxdSyncStatus> {
    const clean = username.trim().replace(/^@/, '');
    // Verify the account exists and has a reachable public feed before saving it.
    await this.fetchDiary(clean);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { letterboxdUsername: clean, letterboxdSyncedAt: null },
    });
    return { connectedUsername: user.letterboxdUsername, lastSyncedAt: null };
  }

  async disconnect(userId: string): Promise<LetterboxdSyncStatus> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { letterboxdUsername: null, letterboxdSyncedAt: null },
    });
    return { connectedUsername: null, lastSyncedAt: null };
  }

  async sync(userId: string): Promise<LetterboxdSyncResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.letterboxdUsername) {
      throw new BadRequestException('Connect a Letterboxd username first');
    }
    const entries = await this.fetchDiary(user.letterboxdUsername);

    const failures: string[] = [];
    let imported = 0;
    for (const entry of entries) {
      try {
        await this.applyEntry(userId, entry);
        imported++;
      } catch (err) {
        this.logger.warn(`Sync failed for "${entry.filmTitle}": ${String(err)}`);
        failures.push(entry.filmTitle);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { letterboxdSyncedAt: new Date() },
    });

    return { processed: entries.length, imported, failed: failures.length, failures };
  }

  // -- entry application -------------------------------------------------------

  private async applyEntry(userId: string, entry: DiaryEntry): Promise<void> {
    const media: MediaItem = entry.tmdbMovieId
      ? await this.media.getOrFetch('tmdb', `movie:${entry.tmdbMovieId}`, 'MOVIE')
      : await this.matchByTitle(entry.filmTitle, entry.filmYear);

    const watchedAt = entry.watchedDate ? new Date(entry.watchedDate) : new Date();

    await this.prisma.$transaction([
      this.prisma.watchHistory.create({
        data: { userId, mediaItemId: media.id, watchedAt, isRewatch: entry.rewatch },
      }),
      this.prisma.userMediaStatus.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
        create: {
          userId,
          mediaItemId: media.id,
          status: 'COMPLETED',
          completedAt: watchedAt,
          rewatchCount: entry.rewatch ? 1 : 0,
          isFavorite: entry.memberLike,
        },
        // Only ever turn favorite ON from a like — never silently un-like
        // something the user favorited directly in Cinelog.
        update: {
          status: 'COMPLETED',
          completedAt: watchedAt,
          ...(entry.rewatch ? { rewatchCount: { increment: 1 } } : {}),
          ...(entry.memberLike ? { isFavorite: true } : {}),
        },
      }),
    ]);

    if (entry.memberRating !== null) {
      const value = (entry.memberRating / 5) * 100; // Letterboxd 0.5–5 -> normalized 0..100
      await this.prisma.rating.upsert({
        where: { userId_mediaItemId: { userId, mediaItemId: media.id } },
        create: { userId, mediaItemId: media.id, value },
        update: { value },
      });
    }
  }

  private async matchByTitle(title: string, year: number | null): Promise<MediaItem> {
    const results = (await this.registry.search(title, 'MOVIE')).filter((r) => r.type === 'MOVIE');
    if (results.length === 0) throw new Error('No match found');

    let pick = results[0]!;
    if (year != null) {
      pick =
        results.find((r) => r.year === year) ??
        results.find((r) => r.year != null && Math.abs(r.year - year) <= 1) ??
        pick;
    }
    return this.media.getOrFetch(pick.provider, pick.externalId, 'MOVIE');
  }

  // -- RSS fetch + parse --------------------------------------------------------

  private async fetchDiary(username: string): Promise<DiaryEntry[]> {
    const url = `https://letterboxd.com/${encodeURIComponent(username)}/rss/`;
    let res: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);
      res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Cinelog/1.0 (+self-hosted media tracker)' },
      });
      clearTimeout(timeout);
    } catch {
      throw new BadRequestException('Could not reach Letterboxd — try again in a moment');
    }
    if (res.status === 404) {
      throw new NotFoundException('No public Letterboxd account with that username');
    }
    if (!res.ok) {
      throw new BadRequestException(`Letterboxd returned an error (${res.status})`);
    }

    const xml = await res.text();
    const parsed = this.parser.parse(xml) as RssRoot;
    const raw = parsed?.rss?.channel?.item;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

    return list
      .map((item): DiaryEntry => ({
        filmTitle: String(item.filmTitle ?? '').trim(),
        filmYear: item.filmYear != null ? Number(item.filmYear) : null,
        watchedDate: item.watchedDate ? String(item.watchedDate) : null,
        rewatch: String(item.rewatch ?? 'No').toLowerCase() === 'yes',
        memberRating: item.memberRating != null ? Number(item.memberRating) : null,
        memberLike: String(item.memberLike ?? 'No').toLowerCase() === 'yes',
        tmdbMovieId: item.movieId != null ? String(item.movieId) : null,
      }))
      .filter((e) => e.filmTitle.length > 0);
  }
}
