import { Injectable } from '@nestjs/common';
import type { IntegrationSettings, UpdateIntegrationSettingsRequest } from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';

const INTEGRATIONS_KEY = 'integrations';

/** The stored shape, including secrets. Never leaves this service. */
export interface IntegrationSecrets {
  jellyfinUrl: string | null;
  jellyfinApiKey: string | null;
  seerrUrl: string | null;
  seerrApiKey: string | null;
  watchRegion: string | null;
}

const EMPTY: IntegrationSecrets = {
  jellyfinUrl: null,
  jellyfinApiKey: null,
  seerrUrl: null,
  seerrApiKey: null,
  watchRegion: null,
};

/**
 * Instance-wide settings, kept in the Setting key/value table as JSON.
 *
 * API keys live here in plaintext, at the same trust level as the SQLite file
 * itself (which already holds password hashes and refresh tokens) — but they
 * must never cross the API boundary. `getSecrets` is for server-side callers
 * only; `getPublic` is the only shape an HTTP response may contain.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Server-side only: the values needed to actually call the services. */
  async getSecrets(): Promise<IntegrationSecrets> {
    const row = await this.prisma.setting.findUnique({ where: { key: INTEGRATIONS_KEY } });
    if (!row) return { ...EMPTY };
    const parsed = safeJson(row.value);
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY };
    const v = parsed as Partial<IntegrationSecrets>;
    // Read defensively: a hand-edited row must not break every media page.
    return {
      jellyfinUrl: str(v.jellyfinUrl),
      jellyfinApiKey: str(v.jellyfinApiKey),
      seerrUrl: str(v.seerrUrl),
      seerrApiKey: str(v.seerrApiKey),
      watchRegion: str(v.watchRegion),
    };
  }

  /** Safe to return over HTTP: keys are reported as present, never disclosed. */
  async getPublic(): Promise<IntegrationSettings> {
    const s = await this.getSecrets();
    return {
      jellyfinUrl: s.jellyfinUrl,
      seerrUrl: s.seerrUrl,
      watchRegion: s.watchRegion,
      hasJellyfinApiKey: !!s.jellyfinApiKey,
      hasSeerrApiKey: !!s.seerrApiKey,
    };
  }

  /**
   * Merge an update over what's stored. An omitted field is left alone; an
   * empty string clears it. That distinction is what lets the admin form save a
   * URL change without having to re-enter — or accidentally wipe — a key it was
   * never shown.
   */
  async update(dto: UpdateIntegrationSettingsRequest): Promise<IntegrationSettings> {
    const current = await this.getSecrets();
    const next: IntegrationSecrets = {
      jellyfinUrl: merge(current.jellyfinUrl, dto.jellyfinUrl),
      jellyfinApiKey: merge(current.jellyfinApiKey, dto.jellyfinApiKey),
      seerrUrl: merge(current.seerrUrl, dto.seerrUrl),
      seerrApiKey: merge(current.seerrApiKey, dto.seerrApiKey),
      watchRegion: merge(current.watchRegion, dto.watchRegion),
    };
    await this.prisma.setting.upsert({
      where: { key: INTEGRATIONS_KEY },
      create: { key: INTEGRATIONS_KEY, value: JSON.stringify(next) },
      update: { value: JSON.stringify(next) },
    });
    return this.getPublic();
  }
}

/** undefined = leave as-is; '' or null = clear; a value = replace. */
function merge(current: string | null, incoming: string | null | undefined): string | null {
  if (incoming === undefined) return current;
  return incoming ? incoming : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
