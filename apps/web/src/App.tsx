import { Suspense, lazy, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import type { MediaDetail, MediaType } from '@cinelog/contracts';
import { loadMediaDetail } from './lib/preload';
import { useAuth } from './lib/auth';
import { useAppShell } from './lib/appShell';
import { api, ApiError } from './lib/api';
import { Layout } from './components/Layout';
import { AppShell } from './components/app/AppShell';
import { Spinner } from './components/ui';
import { ConfirmProvider } from './components/Dialog';
import { ErrorState } from './components/lb';
import { DiscoverPage } from './pages/DiscoverPage';

// Route-level code splitting: only Home (first paint) is in the entry chunk.
const ActivityPage = lazy(() => import('./pages/ActivityPage').then((m) => ({ default: m.ActivityPage })));
const FilmsPage = lazy(() => import('./pages/FilmsPage').then((m) => ({ default: m.FilmsPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const MembersPage = lazy(() => import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })));
const ListsPage = lazy(() => import('./pages/ListsPage').then((m) => ({ default: m.ListsPage })));
const ListDetailPage = lazy(() => import('./pages/ListDetailPage').then((m) => ({ default: m.ListDetailPage })));
const SearchPage = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })));
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })));
const PersonPage = lazy(() => import('./pages/PersonPage').then((m) => ({ default: m.PersonPage })));
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((m) => ({ default: m.ReviewPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const MediaDetailPage = lazy(() => loadMediaDetail().then((m) => ({ default: m.MediaDetailPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const SetupPage = lazy(() => import('./pages/SetupPage').then((m) => ({ default: m.SetupPage })));

export function App(): JSX.Element {
  const { user, initializing } = useAuth();
  // Same routes, same pages — a different shell around them. See lib/appShell.
  const appShell = useAppShell();

  if (initializing) return <FullScreenSpinner />;
  if (!user) return <UnauthedApp />;

  return (
    <ConfirmProvider>
      <Routes>
        <Route element={appShell ? <AppShell /> : <Layout />}>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/films" element={<FilmsPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:id" element={<ListDetailPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/media/:id" element={<MediaDetailPage />} />
          <Route path="/open" element={<OpenTitle />} />
          {/* Person ids are numeric, so the static "name" segment can't collide. */}
          <Route path="/person/name/:name" element={<PersonPage byName />} />
          <Route path="/person/:id" element={<PersonPage />} />
          {/* Import moved into Settings; keep the old path working. */}
          <Route path="/import" element={<Navigate to="/settings?tab=data" replace />} />
          <Route path="/profile/:tab?" element={<PublicProfilePage />} />
          <Route path="/u/:username/:tab?" element={<PublicProfilePage />} />
          <Route path="/review/:id" element={<ReviewPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ConfirmProvider>
  );
}

/**
 * `/open?provider=…&externalId=…&type=…` — where a poster for a title nobody
 * has opened yet links to (see `mediaHref`). Resolving caches the title and
 * hands back its Cinelog id; this replaces itself with the real page, so Back
 * returns to the grid you came from. A query rather than an effect so the
 * resolve fires once, including under StrictMode.
 */
function OpenTitle(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const provider = params.get('provider') ?? '';
  const externalId = params.get('externalId') ?? '';
  const type = (params.get('type') ?? 'MOVIE') as MediaType;

  const { data, isError, error, refetch } = useQuery({
    queryKey: ['resolve', provider, externalId, type],
    queryFn: () =>
      api.resolveMedia({ provider, externalId, type } as Parameters<typeof api.resolveMedia>[0]),
    enabled: !!provider && !!externalId,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    // The resolve already returned the whole record; don't fetch it twice.
    queryClient.setQueryData<MediaDetail>(['media', data.id, null], data);
    navigate(`/media/${data.id}`, { replace: true });
  }, [data, navigate, queryClient]);

  if (isError || !provider || !externalId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <ErrorState
          title="Could not open that title"
          body={error instanceof ApiError ? error.message : 'The metadata provider did not answer.'}
          onRetry={provider && externalId ? () => void refetch() : undefined}
        />
      </div>
    );
  }
  return <Spinner center />;
}

/** Before login we only need to know whether this is a fresh install. */
function UnauthedApp(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.getSetupStatus(),
  });
  if (isLoading || !data) return <FullScreenSpinner />;
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      {data.needsSetup ? <SetupPage /> : <LoginPage />}
    </Suspense>
  );
}

function FullScreenSpinner(): JSX.Element {
  return (
    <div className="flex min-h-full items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}
