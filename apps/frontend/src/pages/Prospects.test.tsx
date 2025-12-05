import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Prospects } from './Prospects';

// Mock dependencies
vi.mock('../lib/api', () => ({
  prospectsApi: {
    list: vi.fn().mockResolvedValue({ data: { data: [], total: 0 } }),
    discover: vi.fn().mockResolvedValue({ data: {} }),
  },
  clientsApi: {
    getICP: vi.fn().mockResolvedValue({ data: null }),
  },
}));

vi.mock('../store', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      currentClient: { id: 'test-client', name: 'Test Client', website: 'https://test.com' },
      addNotification: vi.fn(),
    };
    return selector(state);
  }),
}));

vi.mock('../hooks/useWebSocket', () => ({
  useLeadDiscoveryProgress: vi.fn(() => ({
    progress: {
      status: 'idle',
      message: null,
      error: null,
      placesFound: 0,
      enrichedCount: 0,
      contactsFound: 0,
      currentProspect: null,
    },
    reset: vi.fn(),
    getPhaseStatus: vi.fn(() => 'pending'),
  })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Prospects Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    expect(screen.getByText('Prospects')).toBeInTheDocument();
    expect(screen.getByText(/prospects in your database/)).toBeInTheDocument();
  });

  it('renders the Discover Leads button', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    const buttons = screen.getAllByRole('button', { name: /discover leads/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders status filter buttons', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Researched' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contacted' })).toBeInTheDocument();
  });

  it('renders search input with accessibility label', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    const searchInput = screen.getByRole('textbox', { name: /search prospects/i });
    expect(searchInput).toBeInTheDocument();
  });

  it('opens discover modal when button is clicked', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    const discoverButton = screen.getAllByRole('button', { name: /discover leads/i })[0];
    fireEvent.click(discoverButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('has accessible status filter group', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    const filterGroup = screen.getByRole('group', { name: /filter by status/i });
    expect(filterGroup).toBeInTheDocument();
  });

  it('renders empty state when no prospects', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No prospects found')).toBeInTheDocument();
    });
  });
});

describe('DiscoverLeadsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has accessible form labels', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    // Open modal
    const discoverButton = screen.getAllByRole('button', { name: /discover leads/i })[0];
    fireEvent.click(discoverButton);

    await waitFor(() => {
      expect(screen.getByLabelText('City')).toBeInTheDocument();
      expect(screen.getByLabelText('State')).toBeInTheDocument();
      expect(screen.getByLabelText('Country')).toBeInTheDocument();
      expect(screen.getByLabelText(/industries/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/max leads/i)).toBeInTheDocument();
    });
  });

  it('has modal accessibility attributes', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    // Open modal
    const discoverButton = screen.getAllByRole('button', { name: /discover leads/i })[0];
    fireEvent.click(discoverButton);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'discover-modal-title');
    });
  });

  it('has close button with accessibility label', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    // Open modal
    const discoverButton = screen.getAllByRole('button', { name: /discover leads/i })[0];
    fireEvent.click(discoverButton);

    await waitFor(() => {
      const closeButton = screen.getByRole('button', { name: /close discover leads modal/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    render(<Prospects />, { wrapper: createWrapper() });

    // Open modal
    const discoverButton = screen.getAllByRole('button', { name: /discover leads/i })[0];
    fireEvent.click(discoverButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Close modal
    const closeButton = screen.getByRole('button', { name: /close discover leads modal/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
