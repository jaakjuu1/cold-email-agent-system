import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Users,
  Building2,
  MapPin,
  Mail,
  ExternalLink,
  Plus,
  Download,
  RefreshCw,
  X,
  Loader2,
  Sparkles,
  CheckCircle2,
  Circle,
  AlertCircle,
  Globe,
  FileSearch,
  Briefcase,
  UserSearch,
  Target,
  Save,
} from 'lucide-react';
import { prospectsApi, clientsApi } from '../lib/api';
import { safeGetHostname } from '../lib/url';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { InlineStatusSelect } from '../components/InlineStatusSelect';
import { ProspectActionsMenu } from '../components/ProspectActionsMenu';
import { ProspectDetailPanel } from '../components/ProspectDetailPanel';
import { DeepResearchModal } from '../components/DeepResearchModal';
import { useAppStore } from '../store';
import { useLeadDiscoveryProgress, useEnhancedResearchProgress } from '../hooks/useWebSocket';
import { useDebounce } from '../hooks/useDebounce';
import { clsx } from 'clsx';
import type { DeepResearchResult } from '@cold-outreach/shared';

interface Prospect {
  id: string;
  companyName: string;
  website?: string;
  industry: string;
  subIndustry?: string;
  description?: string;
  location: {
    city: string;
    state: string;
    country: string;
    address?: string;
  };
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  employeeCount?: string;
  painPoints?: string[];
  technologies?: string[];
  contacts: Array<{
    id: string;
    name: string;
    title: string;
    email?: string;
    phone?: string;
    isPrimary: boolean;
  }>;
  icpMatchScore: number;
  status: 'new' | 'researched' | 'contacted' | 'responded' | 'converted' | 'rejected';
}

interface ProspectRowProps {
  prospect: Prospect;
  onRowClick: (prospect: Prospect) => void;
  onStatusChange: (prospectId: string, status: Prospect['status']) => void;
  onDeepResearch: (prospect: Prospect) => void;
  onDelete: (prospectId: string) => void;
  isUpdatingStatus?: boolean;
  isResearching?: boolean;
  isDeleting?: boolean;
}

function ProspectRow({
  prospect,
  onRowClick,
  onStatusChange,
  onDeepResearch,
  onDelete,
  isUpdatingStatus,
  isResearching,
  isDeleting,
}: ProspectRowProps) {
  const primaryContact = prospect.contacts.find((c) => c.isPrimary) || prospect.contacts[0];

  return (
    <tr
      className="hover:bg-surface-50 transition-colors cursor-pointer"
      onClick={() => onRowClick(prospect)}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-600" />
          </div>
          <p className="font-medium text-surface-900">{prospect.companyName}</p>
        </div>
      </td>
      <td className="px-6 py-4">
        {prospect.website ? (
          <a
            href={prospect.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {safeGetHostname(prospect.website)}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span className="text-sm text-surface-400">-</span>
        )}
      </td>
      <td className="px-6 py-4">
        {primaryContact && (
          <div>
            <p className="font-medium text-surface-900">{primaryContact.name}</p>
            <p className="text-sm text-surface-500">{primaryContact.title}</p>
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-surface-600">{prospect.industry}</span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1 text-sm text-surface-600">
          <MapPin className="w-4 h-4 text-surface-400" />
          {prospect.location.city}, {prospect.location.state}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-surface-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full',
                prospect.icpMatchScore >= 0.8
                  ? 'bg-green-500'
                  : prospect.icpMatchScore >= 0.6
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              )}
              style={{ width: `${prospect.icpMatchScore * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium text-surface-700">
            {Math.round(prospect.icpMatchScore * 100)}%
          </span>
        </div>
      </td>
      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
        <InlineStatusSelect
          status={prospect.status}
          onStatusChange={(status) => onStatusChange(prospect.id, status)}
          disabled={isUpdatingStatus}
        />
      </td>
      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {primaryContact?.email && (
            <button
              className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `mailto:${primaryContact.email}`;
              }}
            >
              <Mail className="w-4 h-4 text-surface-400" />
            </button>
          )}
          <ProspectActionsMenu
            onViewDetails={() => onRowClick(prospect)}
            onDeepResearch={() => onDeepResearch(prospect)}
            onDelete={() => onDelete(prospect.id)}
            isResearching={isResearching}
            isDeleting={isDeleting}
          />
        </div>
      </td>
    </tr>
  );
}

// Phase display configuration
const PHASE_CONFIG = {
  searching_maps: { icon: Globe, label: 'Searching Google Maps' },
  parsing_prospects: { icon: FileSearch, label: 'Parsing Results' },
  enriching_company: { icon: Briefcase, label: 'Enriching Companies' },
  finding_contacts: { icon: UserSearch, label: 'Finding Contacts' },
  validating_icp: { icon: Target, label: 'Validating ICP Match' },
  saving_results: { icon: Save, label: 'Saving Results' },
} as const;

type LeadDiscoveryPhase = keyof typeof PHASE_CONFIG;

function DiscoveryProgressDisplay({
  progress,
  getPhaseStatus,
}: {
  progress: {
    status: string;
    message: string | null;
    error: string | null;
    placesFound: number;
    enrichedCount: number;
    contactsFound: number;
    currentProspect: string | null;
  };
  getPhaseStatus: (phase: LeadDiscoveryPhase) => 'pending' | 'active' | 'completed';
}) {
  const phases = Object.keys(PHASE_CONFIG) as LeadDiscoveryPhase[];

  return (
    <div className="space-y-6">
      {/* Phase Progress */}
      <div className="space-y-3">
        {phases.map((phase) => {
          const { icon: Icon, label } = PHASE_CONFIG[phase];
          const status = getPhaseStatus(phase);

          return (
            <div
              key={phase}
              className={clsx(
                'flex items-center gap-3 p-3 rounded-lg transition-all',
                status === 'completed' && 'bg-green-50',
                status === 'active' && 'bg-primary-50 ring-1 ring-primary-200',
                status === 'pending' && 'bg-surface-50 opacity-50'
              )}
            >
              <div
                className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  status === 'completed' && 'bg-green-500',
                  status === 'active' && 'bg-primary-500',
                  status === 'pending' && 'bg-surface-300'
                )}
              >
                {status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-white" />
                ) : status === 'active' ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="flex-1">
                <p
                  className={clsx(
                    'font-medium',
                    status === 'completed' && 'text-green-700',
                    status === 'active' && 'text-primary-700',
                    status === 'pending' && 'text-surface-500'
                  )}
                >
                  {label}
                </p>
                {status === 'active' && progress.message && (
                  <p className="text-sm text-primary-600">{progress.message}</p>
                )}
              </div>
              <Icon
                className={clsx(
                  'w-5 h-5',
                  status === 'completed' && 'text-green-500',
                  status === 'active' && 'text-primary-500',
                  status === 'pending' && 'text-surface-400'
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-surface-50 rounded-lg">
          <p className="text-2xl font-bold text-surface-900">{progress.placesFound}</p>
          <p className="text-xs text-surface-500">Places Found</p>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-lg">
          <p className="text-2xl font-bold text-surface-900">{progress.enrichedCount}</p>
          <p className="text-xs text-surface-500">Enriched</p>
        </div>
        <div className="text-center p-3 bg-surface-50 rounded-lg">
          <p className="text-2xl font-bold text-surface-900">{progress.contactsFound}</p>
          <p className="text-xs text-surface-500">Contacts</p>
        </div>
      </div>

      {/* Current Prospect */}
      {progress.currentProspect && (
        <div className="text-center text-sm text-surface-500">
          Processing: <span className="font-medium">{progress.currentProspect}</span>
        </div>
      )}

      {/* Error Display */}
      {progress.error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{progress.error}</p>
        </div>
      )}
    </div>
  );
}

interface ClientICP {
  geographicTargeting?: {
    primaryMarkets?: Array<{
      city: string;
      state: string;
      country: string;
      priority: string;
    }>;
  };
  industryTargeting?: {
    primaryIndustries?: Array<{
      name: string;
      subSegments?: string[];
      priority: string;
    }>;
  };
}

function DiscoverLeadsModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  isLoadingICP,
  discoveryProgress,
  getPhaseStatus,
  onDiscoveryComplete,
  clientName,
  clientICP,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { locations: Array<{ city: string; state: string; country: string }>; industries: string[]; limit: number }) => void;
  isLoading: boolean;
  isLoadingICP?: boolean;
  discoveryProgress: {
    status: string;
    message: string | null;
    error: string | null;
    placesFound: number;
    enrichedCount: number;
    contactsFound: number;
    currentProspect: string | null;
  };
  getPhaseStatus: (phase: LeadDiscoveryPhase) => 'pending' | 'active' | 'completed';
  onDiscoveryComplete: () => void;
  clientName?: string;
  clientICP?: ClientICP;
}) {
  // Pre-populate from ICP or use defaults
  const defaultLocation = clientICP?.geographicTargeting?.primaryMarkets?.[0];
  const defaultIndustries = clientICP?.industryTargeting?.primaryIndustries?.map(i => i.name) || [];

  const [city, setCity] = useState(defaultLocation?.city || 'San Francisco');
  const [state, setState] = useState(defaultLocation?.state || 'CA');
  const [country, setCountry] = useState(defaultLocation?.country || 'USA');
  const [industries, setIndustries] = useState(defaultIndustries.join(', ') || 'SaaS, Technology');
  const [limit, setLimit] = useState(50);
  const [showProgress, setShowProgress] = useState(false);

  // Update form when ICP changes (e.g., client switch)
  useEffect(() => {
    if (clientICP) {
      const location = clientICP.geographicTargeting?.primaryMarkets?.[0];
      if (location) {
        setCity(location.city);
        setState(location.state);
        setCountry(location.country);
      }
      const industryNames = clientICP.industryTargeting?.primaryIndustries?.map(i => i.name) || [];
      if (industryNames.length > 0) {
        setIndustries(industryNames.join(', '));
      }
    }
  }, [clientICP]);

  // Show progress when discovery starts
  useEffect(() => {
    if (discoveryProgress.status === 'running') {
      setShowProgress(true);
    }
  }, [discoveryProgress.status]);

  // Handle discovery completion
  useEffect(() => {
    if (discoveryProgress.status === 'completed') {
      onDiscoveryComplete();
    }
  }, [discoveryProgress.status, onDiscoveryComplete]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowProgress(true);
    onSubmit({
      locations: [{ city, state, country }],
      industries: industries.split(',').map((i) => i.trim()).filter(Boolean),
      limit,
    });
  };

  const handleClose = () => {
    if (discoveryProgress.status !== 'running') {
      setShowProgress(false);
      onClose();
    }
  };

  const isRunning = discoveryProgress.status === 'running';
  const isComplete = discoveryProgress.status === 'completed';
  const isFailed = discoveryProgress.status === 'failed';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discover-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        {!isRunning && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-100 transition-colors"
            aria-label="Close discover leads modal"
          >
            <X className="w-5 h-5 text-surface-400" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-6">
          <div className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isComplete ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-gradient-to-br from-primary-500 to-accent-500'
          )}>
            {isComplete ? (
              <CheckCircle2 className="w-6 h-6 text-white" />
            ) : isFailed ? (
              <AlertCircle className="w-6 h-6 text-white" />
            ) : (
              <Sparkles className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h2 id="discover-modal-title" className="text-xl font-bold text-surface-900">
              {isComplete ? 'Discovery Complete!' : isFailed ? 'Discovery Failed' : isRunning ? 'Discovering Leads...' : 'Discover Leads'}
            </h2>
            <p className="text-sm text-surface-500">
              {isComplete
                ? `Found ${discoveryProgress.placesFound} prospects`
                : isFailed
                ? 'Please try again'
                : isRunning
                ? 'This may take a few minutes'
                : clientName
                ? `Find prospects for ${clientName} based on your ICP`
                : 'Find prospects matching your ICP'}
            </p>
          </div>
        </div>

        {showProgress && (isRunning || isComplete || isFailed) ? (
          <div className="space-y-6">
            <DiscoveryProgressDisplay
              progress={discoveryProgress}
              getPhaseStatus={getPhaseStatus}
            />

            {(isComplete || isFailed) && (
              <div className="flex gap-3 pt-4">
                <button onClick={handleClose} className="btn-primary flex-1">
                  {isComplete ? 'View Prospects' : 'Close'}
                </button>
              </div>
            )}
          </div>
        ) : isLoadingICP ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-surface-500">Loading ICP data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="discover-city" className="label">City</label>
                <input
                  id="discover-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input"
                  placeholder="San Francisco"
                />
              </div>
              <div>
                <label htmlFor="discover-state" className="label">State</label>
                <input
                  id="discover-state"
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="input"
                  placeholder="CA"
                />
              </div>
              <div>
                <label htmlFor="discover-country" className="label">Country</label>
                <input
                  id="discover-country"
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="input"
                  placeholder="USA"
                />
              </div>
            </div>

            <div>
              <label htmlFor="discover-industries" className="label">Industries (comma-separated)</label>
              <input
                id="discover-industries"
                type="text"
                value={industries}
                onChange={(e) => setIndustries(e.target.value)}
                className="input"
                placeholder="SaaS, Technology, Healthcare"
              />
            </div>

            <div>
              <label htmlFor="discover-limit" className="label">Max Leads to Find</label>
              <input
                id="discover-limit"
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                className="input"
                min={10}
                max={500}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={handleClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={isLoading} className="btn-primary flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Start Discovery
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function Prospects() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);

  // Detail panel state
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  // Track which prospect is being researched/deleted
  const [researchingProspectId, setResearchingProspectId] = useState<string | null>(null);
  const [deletingProspectId, setDeletingProspectId] = useState<string | null>(null);
  const [updatingStatusProspectId, setUpdatingStatusProspectId] = useState<string | null>(null);

  // Research modal state
  const [researchModalProspect, setResearchModalProspect] = useState<Prospect | null>(null);

  const currentClient = useAppStore((state) => state.currentClient);
  const queryClient = useQueryClient();
  const addNotification = useAppStore((state) => state.addNotification);

  // Fetch client's ICP for pre-populating discovery modal
  const { data: icpData, isLoading: isLoadingICP } = useQuery({
    queryKey: ['client-icp', currentClient?.id],
    queryFn: () => clientsApi.getICP(currentClient!.id),
    enabled: !!currentClient?.id,
  });

  const clientICP = icpData?.data;

  // Lead discovery progress hook
  const { progress: discoveryProgress, reset: resetDiscoveryProgress, getPhaseStatus } = useLeadDiscoveryProgress(currentClient?.id);

  // Enhanced research progress hook - track the prospect being researched (not selected)
  const { reset: resetResearchProgress } = useEnhancedResearchProgress(
    researchingProspectId ?? undefined,
    currentClient?.id,
    {
      onComplete: (stats) => {
        addNotification('success', `Research complete! Found ${stats.learningsFound} insights from ${stats.queriesCompleted} queries.`);
        queryClient.invalidateQueries({ queryKey: ['prospects'] });
        queryClient.invalidateQueries({ queryKey: ['deep-research', researchingProspectId] });
        setResearchingProspectId(null);
      },
      onFailed: (error) => {
        addNotification('error', `Research failed: ${error}`);
        setResearchingProspectId(null);
      },
    }
  );

  // Query for deep research results when prospect is selected
  const { data: deepResearchData, isLoading: isLoadingDeepResearch } = useQuery({
    queryKey: ['deep-research', selectedProspect?.id],
    queryFn: () => prospectsApi.getDeepResearch(selectedProspect!.id),
    enabled: !!selectedProspect?.id && isDetailPanelOpen,
  });

  const deepResearch: DeepResearchResult | null = deepResearchData?.data || null;

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ prospectId, status }: { prospectId: string; status: string }) =>
      prospectsApi.updateStatus(prospectId, status),
    onMutate: ({ prospectId }) => {
      setUpdatingStatusProspectId(prospectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      addNotification('success', 'Status updated successfully');
    },
    onError: (error) => {
      addNotification('error', error instanceof Error ? error.message : 'Failed to update status');
    },
    onSettled: () => {
      setUpdatingStatusProspectId(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (prospectId: string) => prospectsApi.delete(prospectId),
    onMutate: (prospectId) => {
      setDeletingProspectId(prospectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      addNotification('success', 'Prospect deleted successfully');
      // Close detail panel if deleted prospect was open
      if (selectedProspect && deletingProspectId === selectedProspect.id) {
        setIsDetailPanelOpen(false);
        setSelectedProspect(null);
      }
    },
    onError: (error) => {
      addNotification('error', error instanceof Error ? error.message : 'Failed to delete prospect');
    },
    onSettled: () => {
      setDeletingProspectId(null);
    },
  });

  // Deep research mutation
  const deepResearchMutation = useMutation({
    mutationFn: ({ prospectId, config }: {
      prospectId: string;
      config: {
        phases: ('company' | 'contacts' | 'contact_discovery' | 'market')[];
        depth: number;
        breadth: number;
        focus: 'sales' | 'general' | 'technical';
      };
    }) => prospectsApi.deepResearch(prospectId, config),
    onMutate: ({ prospectId }) => {
      setResearchingProspectId(prospectId);
      setResearchModalProspect(null); // Close modal
      resetResearchProgress(); // Reset progress for new research
    },
    onSuccess: () => {
      addNotification('info', 'Deep research started - this may take a few minutes');
    },
    onError: (error) => {
      addNotification('error', error instanceof Error ? error.message : 'Failed to start deep research');
      setResearchingProspectId(null);
    },
  });


  const discoverMutation = useMutation({
    mutationFn: (data: {
      locations: Array<{ city: string; state: string; country: string }>;
      industries: string[];
      limit: number;
    }) => {
      if (!currentClient?.id) {
        throw new Error('No client selected. Please select a client first.');
      }
      return prospectsApi.discover({
        clientId: currentClient.id,
        ...data,
      });
    },
    onError: (error) => {
      console.error('Discovery mutation error:', error);
      addNotification('error', error instanceof Error ? error.message : 'Discovery failed');
    },
  });

  // Handler functions
  const handleRowClick = useCallback((prospect: Prospect) => {
    setSelectedProspect(prospect);
    setIsDetailPanelOpen(true);
  }, []);

  const handleStatusChange = useCallback((prospectId: string, status: Prospect['status']) => {
    updateStatusMutation.mutate({ prospectId, status });
  }, [updateStatusMutation]);

  const handleDeepResearch = useCallback((prospect: Prospect) => {
    // Open the research modal for this prospect
    setResearchModalProspect(prospect);
  }, []);

  const handleResearchSubmit = useCallback((config: {
    phases: ('company' | 'contacts' | 'contact_discovery' | 'market')[];
    depth: number;
    breadth: number;
    focus: 'sales' | 'general' | 'technical';
  }) => {
    if (!researchModalProspect) return;
    deepResearchMutation.mutate({ prospectId: researchModalProspect.id, config });
  }, [researchModalProspect, deepResearchMutation]);

  const handleDelete = useCallback((prospectId: string) => {
    deleteMutation.mutate(prospectId);
  }, [deleteMutation]);

  const handleCloseDetailPanel = useCallback(() => {
    setIsDetailPanelOpen(false);
    setSelectedProspect(null);
  }, []);

  // Handle discovery completion - refetch prospects
  const handleDiscoveryComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['prospects'] });
  }, [queryClient]);

  // Reset progress when modal closes
  const handleCloseModal = useCallback(() => {
    setShowDiscoverModal(false);
    resetDiscoveryProgress();
  }, [resetDiscoveryProgress]);

  const { data: prospectsData, isLoading } = useQuery({
    queryKey: ['prospects', statusFilter, page],
    queryFn: () =>
      prospectsApi.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        pageSize: 20,
      }),
  });

  const prospects = prospectsData?.data?.data || [];
  const total = prospectsData?.data?.total || 0;

  // Keep selectedProspect in sync with latest data from query (e.g., after research adds new contacts)
  useEffect(() => {
    if (selectedProspect && prospects.length > 0) {
      const updated = prospects.find((p: Prospect) => p.id === selectedProspect.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedProspect)) {
        setSelectedProspect(updated);
      }
    }
  }, [prospects, selectedProspect]);

  const filteredProspects = prospects.filter((prospect: Prospect) =>
    prospect.companyName.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Prospects</h1>
          <p className="mt-1 text-surface-500">
            {total.toLocaleString()} prospects in your database
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowDiscoverModal(true)}
            disabled={!currentClient}
            title={!currentClient ? 'Select a client first' : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            Discover Leads
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
            aria-label="Search prospects by company name"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filter by status">
          {['all', 'new', 'researched', 'contacted', 'responded', 'converted'].map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                aria-pressed={statusFilter === status}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  statusFilter === status
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-surface-400 animate-spin mx-auto" />
            <p className="mt-2 text-surface-500">Loading prospects...</p>
          </div>
        ) : filteredProspects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    ICP Match
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredProspects.map((prospect: Prospect) => (
                  <ProspectRow
                    key={prospect.id}
                    prospect={prospect}
                    onRowClick={handleRowClick}
                    onStatusChange={handleStatusChange}
                    onDeepResearch={handleDeepResearch}
                    onDelete={handleDelete}
                    isUpdatingStatus={updatingStatusProspectId === prospect.id}
                    isResearching={researchingProspectId === prospect.id}
                    isDeleting={deletingProspectId === prospect.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 mb-2">
              No prospects found
            </h3>
            <p className="text-surface-500 mb-6">
              Start discovering leads to populate your prospect database.
            </p>
            <button
              className="btn-primary"
              onClick={() => setShowDiscoverModal(true)}
              disabled={!currentClient}
              title={!currentClient ? 'Select a client first' : undefined}
            >
              <Plus className="w-4 h-4 mr-2" />
              Discover Leads
            </button>
          </div>
        )}
      </div>

      {/* Discover Leads Modal */}
      <DiscoverLeadsModal
        isOpen={showDiscoverModal}
        onClose={handleCloseModal}
        onSubmit={(data) => discoverMutation.mutate(data)}
        isLoading={discoverMutation.isPending}
        isLoadingICP={isLoadingICP}
        discoveryProgress={discoveryProgress}
        getPhaseStatus={getPhaseStatus}
        onDiscoveryComplete={handleDiscoveryComplete}
        clientName={currentClient?.name}
        clientICP={clientICP}
      />

      {/* Deep Research Modal */}
      {researchModalProspect && (
        <DeepResearchModal
          isOpen={!!researchModalProspect}
          onClose={() => setResearchModalProspect(null)}
          onSubmit={handleResearchSubmit}
          isLoading={deepResearchMutation.isPending}
          prospectName={researchModalProspect.companyName}
          hasExistingContacts={researchModalProspect.contacts.length > 0}
        />
      )}

      {/* Prospect Detail Panel */}
      {selectedProspect && (
        <ProspectDetailPanel
          prospect={selectedProspect}
          deepResearch={deepResearch}
          isOpen={isDetailPanelOpen}
          onClose={handleCloseDetailPanel}
          onStatusChange={(status) => handleStatusChange(selectedProspect.id, status)}
          onDeepResearch={() => handleDeepResearch(selectedProspect)}
          onDelete={() => handleDelete(selectedProspect.id)}
          isResearching={researchingProspectId === selectedProspect.id}
          isLoadingResearch={isLoadingDeepResearch}
        />
      )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-surface-500">
              Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of{' '}
              {total} prospects
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * 20 >= total}
                className="btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

