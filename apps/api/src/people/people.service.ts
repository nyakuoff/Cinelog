import { Injectable, NotFoundException } from '@nestjs/common';
import type { PersonCredit, PersonDetail, ProviderId } from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ArtworkService } from '../artwork/artwork.service';
import { ProviderRegistry } from '../metadata/provider-registry.service';
import type { ProviderPersonCredit } from '../metadata/provider.types';

/**
 * People — a director's or an actor's filmography.
 *
 * Nothing about a person is stored locally: there is no user data to hang off
 * one, so a person is read straight from the metadata provider. What this
 * service does add is the local view — each credit is matched against the cache
 * so a title Cinelog already knows opens directly instead of being re-resolved.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly artwork: ArtworkService,
  ) {}

  async getPerson(provider: ProviderId, personId: string): Promise<PersonDetail> {
    const person = await this.registry.getPerson(provider, personId);
    const idByKey = await this.cachedIds([...person.acting, ...person.crew]);
    const map = (c: ProviderPersonCredit): PersonCredit => ({
      id: idByKey.get(`${c.provider}:${c.externalId}`) ?? null,
      provider: c.provider,
      externalId: c.externalId,
      type: c.type,
      title: c.title,
      originalTitle: c.originalTitle,
      year: c.year,
      overview: c.overview,
      posterUrl: this.artwork.toProxyUrl(c.posterUrl),
      character: c.character,
      job: c.job,
    });

    return {
      id: person.id,
      name: person.name,
      biography: person.biography,
      birthday: person.birthday,
      deathday: person.deathday,
      placeOfBirth: person.placeOfBirth,
      knownForDepartment: person.knownForDepartment,
      profileUrl: this.artwork.toProxyUrl(person.profileUrl),
      acting: person.acting.map(map),
      crew: person.crew.map(map),
    };
  }

  /**
   * Same page, reached by name. Credits cached before person ids were recorded
   * carry only a name, and those names should still lead somewhere rather than
   * being silently dead links.
   */
  async getPersonByName(provider: ProviderId, name: string): Promise<PersonDetail> {
    const id = await this.registry.findPerson(provider, name.trim());
    if (!id) throw new NotFoundException(`No person found named '${name}'`);
    return this.getPerson(provider, id);
  }

  /** Which of these titles Cinelog already holds, so they open without a resolve. */
  private async cachedIds(credits: ProviderPersonCredit[]): Promise<Map<string, string>> {
    const keys = credits.map((c) => ({ provider: c.provider, externalId: c.externalId }));
    if (keys.length === 0) return new Map();
    const existing = await this.prisma.mediaItem.findMany({
      where: { OR: keys },
      select: { id: true, provider: true, externalId: true },
    });
    return new Map(existing.map((e) => [`${e.provider}:${e.externalId}`, e.id]));
  }
}
