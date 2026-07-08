import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { api } from './lib/api';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { MediaDetailPage } from './pages/MediaDetailPage';
import { ImportPage } from './pages/ImportPage';
import { ProfilePage } from './pages/ProfilePage';
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
        <Route path="/" element={<HomePage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/media/:id" element={<MediaDetailPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/profile" element={<ProfilePage />} />
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
