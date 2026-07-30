import { Injectable } from '@nestjs/common';
import { IntegrationSettings, type UpdateIntegrationSettingsRequest } from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';

const INTEGRATIONS_KEY = 'integrations';

/**
 * Instance-wide settings, kept in the Setting key/value table as JSON.
 *
 * Integration values are read by every signed-in member (the web app needs the
 * URLs to build links) but written only by an admin. They hold no credentials —
 * just base URLs — so reading them leaks nothing a member couldn't see by
 * clicking the resulting link.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntegrations(): Promise<IntegrationSettings> {
    const row = await this.prisma.setting.findUnique({ where: { key: INTEGRATIONS_KEY } });
    if (!row) return { jellyfinUrl: null, seerrUrl: null };
    // A malformed or hand-edited value must not break every media page, so it
    // falls back to "nothing configured" rather than throwing.
    const parsed = IntegrationSettings.safeParse(safeJson(row.value));
    return parsed.success ? parsed.data : { jellyfinUrl: null, seerrUrl: null };
  }

  async setIntegrations(dto: UpdateIntegrationSettingsRequest): Promise<IntegrationSettings> {
    // An empty string means "cleared", which is stored as null so reads have
    // exactly one shape for "not configured".
    const value: IntegrationSettings = {
      jellyfinUrl: dto.jellyfinUrl ? dto.jellyfinUrl : null,
      seerrUrl: dto.seerrUrl ? dto.seerrUrl : null,
    };
    await this.prisma.setting.upsert({
      where: { key: INTEGRATIONS_KEY },
      create: { key: INTEGRATIONS_KEY, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });
    return value;
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
