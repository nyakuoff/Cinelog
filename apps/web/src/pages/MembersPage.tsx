import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { MemberSort } from '@cinelog/contracts';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { EmptyState, SectionHeader } from '../components/lb';
import { MemberCard } from '../components/MemberCard';
import { Spinner } from '../components/ui';

const SORTS: { key: MemberSort; label: string }[] = [
  { key: 'POPULAR', label: 'Popular' },
  { key: 'ACTIVE', label: 'Recently active' },
  { key: 'RECENT', label: 'Newest' },
];

export function MembersPage(): JSX.Element {
  const [sort, setSort] = useState<MemberSort>('POPULAR');
  const [q, setQ] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['members', sort, q],
    queryFn: () => api.getMembers({ sort, q: q || undefined }),
    placeholderData: keepPreviousData,
  });

  const members = data?.members ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <SectionHeader
        title="Members"
        right={isFetching ? <Spinner className="h-4 w-4" /> : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded border border-border bg-surface p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                'rounded px-3 py-1.5 font-cond text-[12px] font-bold uppercase tracking-wide transition-colors',
                sort === s.key ? 'bg-gold text-ink' : 'text-muted hover:text-content',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a member…"
          aria-label="Find a member"
          className="h-9 flex-1 min-w-[10rem] rounded border border-border bg-surface-2 px-3 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
        />
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title={q ? 'No members match that search' : 'No members yet'}
            body={
              q
                ? 'Try a different username.'
                : 'Members appear here once more people join this Cinelog instance.'
            }
          />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
