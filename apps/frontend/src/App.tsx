import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { Campaigns } from './pages/Campaigns';
import { CampaignDetail } from './pages/CampaignDetail';
import { Prospects } from './pages/Prospects';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { useAppStore } from './store';
import { clientsApi } from './lib/api';

interface ClientData {
  id: string;
  name: string;
  website: string;
}

// Route guard that auto-selects a client or redirects to onboarding if none exist
function RequireClient({ children }: { children: React.ReactNode }) {
  const currentClient = useAppStore((state) => state.currentClient);
  const setCurrentClient = useAppStore((state) => state.setCurrentClient);
  const location = useLocation();

  // Fetch clients from API
  const { data: clientsResponse, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list(),
    staleTime: 30000,
  });

  const clients: ClientData[] = clientsResponse?.data?.data || [];

  // Auto-select the first client if none is selected but clients exist
  useEffect(() => {
    if (!currentClient && clients.length > 0) {
      const firstClient = clients[0];
      setCurrentClient({
        id: firstClient.id,
        name: firstClient.name,
        website: firstClient.website,
      });
    }
  }, [currentClient, clients, setCurrentClient]);

  // Show loading while fetching clients
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-surface-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to onboarding only if there are NO clients in the database
  if (!currentClient && clients.length === 0) {
    return <Navigate to="/onboarding" state={{ from: location }} replace />;
  }

  // If we have clients but currentClient isn't set yet, wait for useEffect to set it
  if (!currentClient && clients.length > 0) {
    return null;
  }

  return <>{children}</>;
}

// Redirect to dashboard if already has a client (for onboarding page)
// But allow access if explicitly navigating to add a new client
function RedirectIfClient({ children }: { children: React.ReactNode }) {
  const currentClient = useAppStore((state) => state.currentClient);
  const location = useLocation();

  // Allow access to onboarding if coming from "Add New Client" action
  const isAddingNewClient = location.state?.addingNewClient === true;

  if (currentClient && !isAddingNewClient) {
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

