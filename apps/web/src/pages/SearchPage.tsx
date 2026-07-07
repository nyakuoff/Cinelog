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
    <div>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">
        Results for <span className="text-accent">“{q}”</span>
      </h1>

      {isLoading || opening ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-400">Search failed. Is TMDB configured?</p>
      ) : (data?.results.length ?? 0) === 0 ? (
        <p className="text-muted">No results found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {data?.results.map((r) => (
            <PosterCard
              key={`${r.provider}:${r.externalId}`}
              title={r.title}
              year={r.year}
              type={r.type}
              posterUrl={r.posterUrl}
              onClick={() => void open(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
