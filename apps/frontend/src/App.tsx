import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { Campaigns } from './pages/Campaigns';
import { CampaignDetail } from './pages/CampaignDetail';
import { Prospects } from './pages/Prospects';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { useAppStore } from './store';

// Route guard that redirects to onboarding if no client is set up
function RequireClient({ children }: { children: React.ReactNode }) {
  const currentClient = useAppStore((state) => state.currentClient);
  const location = useLocation();

  if (!currentClient) {
    // Redirect to onboarding, preserving the intended destination
    return <Navigate to="/onboarding" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// Redirect to dashboard if already has a client (for onboarding page)
function RedirectIfClient({ children }: { children: React.ReactNode }) {
  const currentClient = useAppStore((state) => state.currentClient);

  if (currentClient) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          <RedirectIfClient>
            <Onboarding />
          </RedirectIfClient>
        }
      />
      <Route
        path="/"
        element={
          <RequireClient>
            <Layout />
          </RequireClient>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/:id" element={<CampaignDetail />} />
        <Route path="prospects" element={<Prospects />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;

