import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SearchResult } from '@cinelog/contracts';
import { api } from '../lib/api';
import { PosterCard } from '../components/PosterCard';
import { Spinner } from '../components/ui';

export function SearchPage(): JSX.Element {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.length > 0,
  });

  /** Open a result: navigate straight if cached, else resolve then navigate. */
  async function open(result: SearchResult): Promise<void> {
    if (result.id) {
      navigate(`/media/${result.id}`);
      return;
    }
    setOpening(true);
    try {
      const detail = await api.resolveMedia({
        provider: result.provider,
        externalId: result.externalId,
        type: result.type,
      });
      navigate(`/media/${detail.id}`);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-cond text-2xl font-extrabold uppercase tracking-tight">
        {q ? (
          <>
            Results for <span className="text-gold">“{q}”</span>
          </>
        ) : (
          'Search'
        )}
      </h1>

      {!q ? (
        <p className="text-muted">Type in the search bar above to find something to log.</p>
      ) : isLoading || opening ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-rose">Search failed. Is TMDB configured?</p>
      ) : (data?.results.length ?? 0) === 0 ? (
        <p className="text-muted">No results found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {data?.results.map((r, i) => (
            <PosterCard
              key={`${r.provider}:${r.externalId}`}
              title={r.title}
              year={r.year}
              type={r.type}
              posterUrl={r.posterUrl}
              index={i}
              onClick={() => void open(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
