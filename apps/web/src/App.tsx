import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useAppShell } from './lib/appShell';
import { api } from './lib/api';
import { Layout } from './components/Layout';
import { AppShell } from './components/app/AppShell';
import { Spinner } from './components/ui';
import { ActivityPage } from './pages/ActivityPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { FilmsPage } from './pages/FilmsPage';
import { LibraryPage } from './pages/LibraryPage';
import { MembersPage } from './pages/MembersPage';
import { ListsPage } from './pages/ListsPage';
import { ListDetailPage } from './pages/ListDetailPage';
import { SearchPage } from './pages/SearchPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { MediaDetailPage } from './pages/MediaDetailPage';
import { PersonPage } from './pages/PersonPage';
import { SettingsPage } from './pages/SettingsPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';

export function App(): JSX.Element {
  const { user, initializing } = useAuth();
  // Same routes, same pages — a different shell around them. See lib/appShell.
  const appShell = useAppShell();

  if (initializing) return <FullScreenSpinner />;
  if (!user) return <UnauthedApp />;

  return (
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
        {/* Person ids are numeric, so the static "name" segment can't collide. */}
        <Route path="/person/name/:name" element={<PersonPage byName />} />
        <Route path="/person/:id" element={<PersonPage />} />
        {/* Import moved into Settings; keep the old path working. */}
        <Route path="/import" element={<Navigate to="/settings?tab=data" replace />} />
        <Route path="/profile" element={<PublicProfilePage />} />
        <Route path="/u/:username" element={<PublicProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/** Before login we only need to know whether this is a fresh install. */
function UnauthedApp(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => api.getSetupStatus(),
  });
  if (isLoading || !data) return <FullScreenSpinner />;
  return data.needsSetup ? <SetupPage /> : <LoginPage />;
}

function FullScreenSpinner(): JSX.Element {
  return (
    <div className="flex min-h-full items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}
