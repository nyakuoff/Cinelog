import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { api } from './lib/api';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { DiscoverPage } from './pages/DiscoverPage';
import { FilmsPage } from './pages/FilmsPage';
import { LibraryPage } from './pages/LibraryPage';
import { MembersPage } from './pages/MembersPage';
import { ListsPage } from './pages/ListsPage';
import { ListDetailPage } from './pages/ListDetailPage';
import { SearchPage } from './pages/SearchPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { MediaDetailPage } from './pages/MediaDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';

export function App(): JSX.Element {
  const { user, initializing } = useAuth();

  if (initializing) return <FullScreenSpinner />;
  if (!user) return <UnauthedApp />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DiscoverPage />} />
        <Route path="/films" element={<FilmsPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/:id" element={<ListDetailPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/media/:id" element={<MediaDetailPage />} />
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
