import { useState } from 'react';
import { ActivityFeed } from '../components/ActivityFeed';
import { PageHeader, TabBar } from '../components/lb';

/**
 * The feed as a screen of its own.
 *
 * On the website this lives as a rail beside Discover; on a phone there is no
 * room beside anything, so activity becomes one of the five places you can go —
 * which is also how it earns its own scope switch instead of being two stacked
 * lists in a sidebar.
 */
type Scope = 'FOLLOWING' | 'EVERYONE';

export function ActivityPage(): JSX.Element {
  const [scope, setScope] = useState<Scope>('FOLLOWING');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 app:py-4 sm:px-6">
      <PageHeader title="Activity" />

      <TabBar
        tabs={[
          { key: 'FOLLOWING', label: 'Following' },
          { key: 'EVERYONE', label: 'Everyone' },
        ]}
        active={scope}
        onChange={(k) => setScope(k as Scope)}
      />

      <div className="pt-2">
        {scope === 'FOLLOWING' ? (
          <ActivityFeed
            key="following"
            scope="FOLLOWING"
            emptyTitle="No activity yet"
            emptyBody="Follow other members and their ratings, reviews and logs show up here."
          />
        ) : (
          <ActivityFeed
            key="everyone"
            scope="EVERYONE"
            emptyTitle="Nothing logged yet"
            emptyBody="Everything logged on this instance appears here."
          />
        )}
      </div>
    </div>
  );
}
