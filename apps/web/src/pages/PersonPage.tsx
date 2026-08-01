import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { PersonCredit, PersonDetail } from '@cinelog/contracts';
import { api } from '../lib/api';
import { PosterCard } from '../components/PosterCard';
import { EmptyState, SectionHeader, TabBar } from '../components/lb';
import { Spinner } from '../components/ui';

/**
 * A person's filmography — where "directed by" and a cast name lead.
 *
 * Reachable two ways: by the provider's person id (what credits carry now) and
 * by name, for credits cached before ids were recorded. Both render this page;
 * only the lookup differs.
 */
export function PersonPage({ byName = false }: { byName?: boolean }): JSX.Element {
  const { id = '', name = '' } = useParams();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);
  const [tab, setTab] = useState<'acting' | 'crew'>('acting');

  const { data, isLoading, isError } = useQuery({
    queryKey: byName ? ['person-by-name', name] : ['person', id],
    queryFn: () => (byName ? api.getPersonByName(name) : api.getPerson(id)),
    // A filmography changes when a film gets made, not between page views.
    staleTime: 1000 * 60 * 30,
  });

  async function open(credit: PersonCredit): Promise<void> {
    if (credit.id) {
      navigate(`/media/${credit.id}`);
      return;
    }
    setOpening(true);
    try {
      const detail = await api.resolveMedia({
        provider: credit.provider,
        externalId: credit.externalId,
        type: credit.type,
      });
      navigate(`/media/${detail.id}`);
    } finally {
      setOpening(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <EmptyState
          title="No record for this name"
          body={`Nothing could be found for ${byName ? name : 'this person'}.`}
        />
      </div>
    );
  }

  // Whichever side of the camera they're better known for leads.
  const crewFirst = (data.knownForDepartment ?? 'Acting') !== 'Acting';
  const active = tab === 'acting' && data.acting.length === 0 ? 'crew' : tab;
  const credits = active === 'acting' ? data.acting : data.crew;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 app:py-4 sm:px-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-sm bg-surface-2 ring-1 ring-border-hi/60 sm:h-36 sm:w-36">
          {data.profileUrl && (
            <img src={data.profileUrl} alt={data.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-cond text-4xl font-extrabold uppercase leading-[0.95] tracking-tight">
            {data.name}
          </h1>
          <p className="mt-2 font-data text-[11px] text-muted-2">{lifeLine(data)}</p>
          {data.biography && <Biography text={data.biography} />}
        </div>
      </header>

      {opening && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      <div className="mt-8">
        <TabBar
          tabs={
            crewFirst
              ? [
                  { key: 'crew', label: 'Crew', count: data.crew.length || undefined },
                  { key: 'acting', label: 'Acting', count: data.acting.length || undefined },
                ]
              : [
                  { key: 'acting', label: 'Acting', count: data.acting.length || undefined },
                  { key: 'crew', label: 'Crew', count: data.crew.length || undefined },
                ]
          }
          active={active}
          onChange={(k) => setTab(k as 'acting' | 'crew')}
        />
      </div>

      <div className="pt-6">
        {credits.length === 0 ? (
          <p className="py-10 text-center text-muted">Nothing recorded under this credit.</p>
        ) : (
          <>
            <SectionHeader
              title={active === 'acting' ? 'Appeared in' : 'Worked on'}
              count={credits.length}
            />
            <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {credits.map((c, i) => (
                <div key={`${c.provider}:${c.externalId}`}>
                  <PosterCard
                    title={c.title}
                    year={c.year}
                    type={c.type}
                    posterUrl={c.posterUrl}
                    index={i}
                    onClick={() => void open(c)}
                  />
                  {/* The part played is the reason this list differs from any
                      other poster grid, so it's captioned rather than hidden. */}
                  {(c.character ?? c.job) && (
                    <p
                      className="mt-1.5 truncate text-xs text-muted-2"
                      title={c.character ?? c.job ?? ''}
                    >
                      {c.character ?? c.job}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Born/died and place, typed as one record line. */
function lifeLine(p: PersonDetail): string {
  const parts: string[] = [];
  if (p.knownForDepartment) parts.push(p.knownForDepartment);
  if (p.birthday) parts.push(p.deathday ? `${p.birthday} — ${p.deathday}` : `b. ${p.birthday}`);
  if (p.placeOfBirth) parts.push(p.placeOfBirth);
  return parts.join('  ·  ');
}

/** Biographies run long; show the opening and let the reader ask for the rest. */
function Biography({ text }: { text: string }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 420;
  return (
    <div className="mt-3 max-w-[62ch]">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-content/90">
        {expanded || !long ? text : `${text.slice(0, 420).trimEnd()}…`}
      </p>
      {long && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2 hover:text-gold"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  );
}
