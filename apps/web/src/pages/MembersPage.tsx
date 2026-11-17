import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { MemberSort } from '@cinelog/contracts';
import { api } from '../lib/api';
import { EmptyState, PageHeader } from '../components/lb';
import { MemberCard } from '../components/MemberCard';
import { Input, Segmented, Spinner } from '../components/ui';

const SORTS: { value: MemberSort; label: string }[] = [
  { value: 'POPULAR', label: 'Popular' },
  { value: 'ACTIVE', label: 'Recently active' },
  { value: 'RECENT', label: 'Newest' },
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
    <div className="mx-auto max-w-4xl px-4 py-8 app:py-4 sm:px-6">
      <PageHeader
        title="Members"
        actions={isFetching && !isLoading ? <Spinner className="h-4 w-4" /> : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Sort members" value={sort} onChange={setSort} options={SORTS} />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a member…"
          aria-label="Find a member"
          className="h-9 min-w-[10rem] flex-1 coarse:h-11"
        />
      </div>

      <div className="mt-6">
        {isLoading ? (
          <Spinner center />
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
