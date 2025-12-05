import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, connectSocket } from '../lib/websocket';
import type { Socket } from 'socket.io-client';

// Types for WebSocket events
interface CampaignStats {
  totalProspects: number;
  emailsSent: number;
  emailsDelivered: number;
  emailsBounced: number;
  emailsOpened: number;
  emailsClicked: number;
  responses: number;
  positiveResponses: number;
  meetings: number;
}

interface EmailResponse {
  id: string;
  campaignId: string;
  prospectId: string;
  subject: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'out_of_office';
  receivedAt: string;
}

interface ListenerNotification {
  listenerId: string;
  priority: 'low' | 'normal' | 'high';
  message: string;
  timestamp: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    connectSocket();

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const subscribe = useCallback((event: string, handler: (data: unknown) => void) => {
    if (socket) {
      socket.on(event, handler);
      return () => socket.off(event, handler);
    }
    return () => {};
  }, [socket]);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socket) {
      socket.emit(event, data);
    }
  }, [socket]);

  return { socket, isConnected, subscribe, emit };
}

export function useCampaignUpdates(campaignId: string | undefined) {
  const { socket, isConnected, subscribe } = useWebSocket();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [responses, setResponses] = useState<EmailResponse[]>([]);
  const [emailsSent, setEmailsSent] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!socket || !campaignId || !isConnected) return;

    socket.emit('subscribe_campaign', campaignId);

    const unsubStats = subscribe('campaign_update', (data: unknown) => {
      const typedData = data as { campaignId: string; stats: CampaignStats };
      if (typedData.campaignId === campaignId) {
        setStats(typedData.stats);
        setLastUpdate(new Date());
      }
    });

    const unsubResponse = subscribe('new_response', (data: unknown) => {
      const typedData = data as EmailResponse;
      if (typedData.campaignId === campaignId) {
        setResponses((prev) => [typedData, ...prev.slice(0, 49)]);
        setLastUpdate(new Date());
      }
    });

    const unsubEmailSent = subscribe('email_sent', (data: unknown) => {
      const typedData = data as { campaignId: string };
      if (typedData.campaignId === campaignId) {
        setEmailsSent((prev) => prev + 1);
        setLastUpdate(new Date());
      }
    });

    return () => {
      socket.emit('unsubscribe_campaign', campaignId);
      unsubStats();
      unsubResponse();
      unsubEmailSent();
    };
  }, [socket, campaignId, isConnected, subscribe]);

  return { stats, responses, emailsSent, isConnected, lastUpdate };
}

export function useNotifications() {
  const { subscribe, isConnected } = useWebSocket();
  const [notifications, setNotifications] = useState<ListenerNotification[]>([]);

  useEffect(() => {
    if (!isConnected) return;

    const unsub = subscribe('listener_notification', (data: unknown) => {
      const notification = data as Omit<ListenerNotification, 'id'>;
      setNotifications((prev) => [
        {
          ...notification,
          timestamp: new Date().toISOString(),
        },
        ...prev.slice(0, 99),
      ]);
    });

    return unsub;
  }, [isConnected, subscribe]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissNotification = useCallback((index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    notifications,
    unreadCount: notifications.length,
    clearNotifications,
    dismissNotification,
    isConnected,
  };
}

export function useProspectUpdates(prospectId: string | undefined) {
  const { socket, isConnected, subscribe } = useWebSocket();
  const [status, setStatus] = useState<string | null>(null);
  const [emailHistory, setEmailHistory] = useState<unknown[]>([]);

  useEffect(() => {
    if (!socket || !prospectId || !isConnected) return;

    const unsubStatus = subscribe('prospect_status_change', (data: unknown) => {
      const typedData = data as { prospectId: string; status: string };
      if (typedData.prospectId === prospectId) {
        setStatus(typedData.status);
      }
    });

    const unsubEmail = subscribe('email_sent', (data: unknown) => {
      const typedData = data as { prospectId: string };
      if (typedData.prospectId === prospectId) {
        setEmailHistory((prev) => [...prev, data]);
      }
    });

    return () => {
      unsubStatus();
      unsubEmail();
    };
  }, [socket, prospectId, isConnected, subscribe]);

  return { status, emailHistory, isConnected };
}

export function useRealTimeAnalytics() {
  const { subscribe, isConnected } = useWebSocket();
  const [metrics, setMetrics] = useState({
    emailsSentToday: 0,
    openRateToday: 0,
    responsesToday: 0,
    activeCampaigns: 0,
  });

  useEffect(() => {
    if (!isConnected) return;

    const unsub = subscribe('analytics_update', (data: unknown) => {
      setMetrics((prev) => ({ ...prev, ...(data as typeof metrics) }));
    });

    return unsub;
  }, [isConnected, subscribe]);

  return { metrics, isConnected };
}

// ===========================================
// Discovery Progress Hook
// ===========================================

type DiscoveryPhase = 'analyzing_website' | 'researching_market' | 'generating_icp' | 'validating';
type DiscoveryStatus = 'started' | 'in_progress' | 'completed' | 'failed';

interface DiscoveryProgressEvent {
  type: 'discovery_progress';
  clientId: string;
  phase: DiscoveryPhase;
  status: DiscoveryStatus;
  message?: string;
  timestamp: string;
}

interface DiscoveryProgress {
  currentPhase: DiscoveryPhase | null;
  completedPhases: DiscoveryPhase[];
  status: DiscoveryStatus | null;
  message: string | null;
  error: string | null;
  isComplete: boolean;
  isFailed: boolean;
}

export function useDiscoveryProgress(clientId: string | undefined) {
  const { socket, isConnected, subscribe } = useWebSocket();
  const [progress, setProgress] = useState<DiscoveryProgress>({
    currentPhase: null,
    completedPhases: [],
    status: null,
    message: null,
    error: null,
    isComplete: false,
    isFailed: false,
  });

  useEffect(() => {
    if (!socket || !clientId || !isConnected) return;

    // Subscribe to client room for progress updates
    socket.emit('subscribe_client', clientId);

    const unsub = subscribe('discovery_progress', (data: unknown) => {
      const event = data as DiscoveryProgressEvent;
      if (event.clientId !== clientId) return;

      setProgress((prev) => {
        const completedPhases = [...prev.completedPhases];

        // Add to completed phases when a phase completes
        if (event.status === 'completed' && !completedPhases.includes(event.phase)) {
          completedPhases.push(event.phase);
        }

        // Check if all phases completed
        const allPhases: DiscoveryPhase[] = [
          'analyzing_website',
          'researching_market',
          'generating_icp',
          'validating',
        ];
        const isComplete = allPhases.every((p) => completedPhases.includes(p));
        const isFailed = event.status === 'failed';

        return {
          currentPhase: event.status === 'completed' ? prev.currentPhase : event.phase,
          completedPhases,
          status: event.status,
          message: event.message || null,
          error: isFailed ? event.message || 'Discovery failed' : null,
          isComplete,
          isFailed,
        };
      });
    });

    return () => {
      unsub();
    };
  }, [socket, clientId, isConnected, subscribe]);

  const reset = useCallback(() => {
    setProgress({
      currentPhase: null,
      completedPhases: [],
      status: null,
      message: null,
      error: null,
      isComplete: false,
      isFailed: false,
    });
  }, []);

  return { progress, reset, isConnected };
}

// ===========================================
// Lead Discovery Progress Hook
// ===========================================

type LeadDiscoveryPhase =
  | 'searching_maps'
  | 'parsing_prospects'
  | 'enriching_company'
  | 'finding_contacts'
  | 'validating_icp'
  | 'saving_results';

interface LeadDiscoveryProgressEvent {
  type: 'lead_discovery_progress';
  clientId: string;
  jobId: string;
  phase: LeadDiscoveryPhase;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  timestamp: string;
  metadata?: {
    prospectId?: string;
    companyName?: string;
    current?: number;
    total?: number;
    placesFound?: number;
    enrichedCount?: number;
    contactsFound?: number;
    icpScore?: number;
    error?: string;
  };
}

interface LeadDiscoveryProgress {
  jobId: string | null;
  currentPhase: LeadDiscoveryPhase | null;
  completedPhases: LeadDiscoveryPhase[];
  status: 'idle' | 'running' | 'completed' | 'failed';
  message: string | null;
  error: string | null;
  // Counters
  placesFound: number;
  enrichedCount: number;
  contactsFound: number;
  currentProspect: string | null;
  current: number;
  total: number;
}

const LEAD_DISCOVERY_PHASES: LeadDiscoveryPhase[] = [
  'searching_maps',
  'parsing_prospects',
  'enriching_company',
  'finding_contacts',
  'validating_icp',
  'saving_results',
];

export function useLeadDiscoveryProgress(clientId: string | undefined) {
  const { socket, isConnected, subscribe } = useWebSocket();
  const [progress, setProgress] = useState<LeadDiscoveryProgress>({
    jobId: null,
    currentPhase: null,
    completedPhases: [],
    status: 'idle',
    message: null,
    error: null,
    placesFound: 0,
    enrichedCount: 0,
    contactsFound: 0,
    currentProspect: null,
    current: 0,
    total: 0,
  });

  useEffect(() => {
    if (!socket || !clientId || !isConnected) return;

    // Subscribe to client room for progress updates
    socket.emit('subscribe_client', clientId);

    const unsub = subscribe('lead_discovery_progress', (data: unknown) => {
      const event = data as LeadDiscoveryProgressEvent;
      if (event.clientId !== clientId) return;

      setProgress((prev) => {
        const completedPhases = [...prev.completedPhases];

        // Add to completed phases when a phase completes
        if (event.status === 'completed' && !completedPhases.includes(event.phase)) {
          completedPhases.push(event.phase);
        }

        // Check if all phases completed
        const isComplete = event.phase === 'saving_results' && event.status === 'completed';
        const isFailed = event.status === 'failed';

        return {
          jobId: event.jobId,
          currentPhase: event.phase,
          completedPhases,
          status: isComplete ? 'completed' : isFailed ? 'failed' : 'running',
          message: event.message || null,
          error: isFailed ? (event.metadata?.error || event.message || 'Discovery failed') : null,
          placesFound: event.metadata?.placesFound ?? prev.placesFound,
          enrichedCount: event.metadata?.enrichedCount ?? prev.enrichedCount,
          contactsFound: event.metadata?.contactsFound ?? prev.contactsFound,
          currentProspect: event.metadata?.companyName ?? prev.currentProspect,
          current: event.metadata?.current ?? prev.current,
          total: event.metadata?.total ?? prev.total,
        };
      });
    });

    return () => {
      unsub();
    };
  }, [socket, clientId, isConnected, subscribe]);

  const reset = useCallback(() => {
    setProgress({
      jobId: null,
      currentPhase: null,
      completedPhases: [],
      status: 'idle',
      message: null,
      error: null,
      placesFound: 0,
      enrichedCount: 0,
      contactsFound: 0,
      currentProspect: null,
      current: 0,
      total: 0,
    });
  }, []);

  const isPhaseComplete = useCallback(
    (phase: LeadDiscoveryPhase) => progress.completedPhases.includes(phase),
    [progress.completedPhases]
  );

  const getPhaseStatus = useCallback(
    (phase: LeadDiscoveryPhase): 'pending' | 'active' | 'completed' => {
      if (progress.completedPhases.includes(phase)) return 'completed';
      if (progress.currentPhase === phase) return 'active';
      return 'pending';
    },
    [progress.completedPhases, progress.currentPhase]
  );

  return {
    progress,
    reset,
    isConnected,
    isPhaseComplete,
    getPhaseStatus,
    phases: LEAD_DISCOVERY_PHASES,
  };
}

// ===========================================
// Enhanced Research Progress Hook
// ===========================================

// Matches EnhancedResearchProgressEventSchema in packages/shared/src/types/index.ts
type EnhancedResearchPhase =
  | 'initializing'
  | 'generating_queries'
  | 'searching'
  | 'evaluating'
  | 'extracting_learnings'
  | 'following_up'
  | 'synthesizing'
  | 'complete'
  | 'failed';

interface EnhancedResearchProgressEvent {
  type: 'enhanced_research_progress';
  sessionId: string;
  prospectId: string;
  phase: EnhancedResearchPhase;
  currentDepth: number;
  maxDepth: number;
  currentQuery?: string;
  queriesCompleted: number;
  learningsFound: number;
  relevantResultsFound: number;
  latestLearning?: string;
  message: string;
  timestamp: string;
}

interface EnhancedResearchProgress {
  sessionId: string | null;
  prospectId: string | null;
  currentPhase: EnhancedResearchPhase | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  message: string | null;
  error: string | null;
  // Stats
  currentDepth: number;
  maxDepth: number;
  currentQuery: string | null;
  queriesCompleted: number;
  learningsFound: number;
  relevantResultsFound: number;
  latestLearning: string | null;
}

const ENHANCED_RESEARCH_PHASES: EnhancedResearchPhase[] = [
  'initializing',
  'generating_queries',
  'searching',
  'evaluating',
  'extracting_learnings',
  'following_up',
  'synthesizing',
  'complete',
];

// Human-readable phase labels for UI
export const PHASE_LABELS: Record<EnhancedResearchPhase, string> = {
  initializing: 'Starting research...',
  generating_queries: 'Generating search queries',
  searching: 'Searching for information',
  evaluating: 'Evaluating results',
  extracting_learnings: 'Extracting insights',
  following_up: 'Following up on leads',
  synthesizing: 'Synthesizing findings',
  complete: 'Research complete',
  failed: 'Research failed',
};

interface UseEnhancedResearchProgressOptions {
  onComplete?: (stats: { queriesCompleted: number; learningsFound: number }) => void;
  onFailed?: (error: string) => void;
}

export function useEnhancedResearchProgress(
  prospectId: string | undefined,
  clientId: string | undefined,
  options?: UseEnhancedResearchProgressOptions
) {
  const { socket, isConnected, subscribe } = useWebSocket();
  const [progress, setProgress] = useState<EnhancedResearchProgress>({
    sessionId: null,
    prospectId: null,
    currentPhase: null,
    status: 'idle',
    message: null,
    error: null,
    currentDepth: 0,
    maxDepth: 0,
    currentQuery: null,
    queriesCompleted: 0,
    learningsFound: 0,
    relevantResultsFound: 0,
    latestLearning: null,
  });

  // Track if callbacks have been called to prevent duplicates
  const callbacksCalledRef = useRef<{ complete: boolean; failed: boolean }>({
    complete: false,
    failed: false,
  });

  useEffect(() => {
    if (!socket || !prospectId || !clientId || !isConnected) return;

    // Subscribe to client room for progress updates
    socket.emit('subscribe_client', clientId);

    const unsub = subscribe('enhanced_research_progress', (data: unknown) => {
      const event = data as EnhancedResearchProgressEvent;
      if (event.prospectId !== prospectId) return;

      const isComplete = event.phase === 'complete';
      const isFailed = event.phase === 'failed';

      setProgress({
        sessionId: event.sessionId,
        prospectId: event.prospectId,
        currentPhase: event.phase,
        status: isComplete ? 'completed' : isFailed ? 'failed' : 'running',
        message: event.message || null,
        error: isFailed ? event.message : null,
        currentDepth: event.currentDepth,
        maxDepth: event.maxDepth,
        currentQuery: event.currentQuery || null,
        queriesCompleted: event.queriesCompleted,
        learningsFound: event.learningsFound,
        relevantResultsFound: event.relevantResultsFound,
        latestLearning: event.latestLearning || null,
      });

      // Call callbacks on completion/failure (only once)
      if (isComplete && !callbacksCalledRef.current.complete) {
        callbacksCalledRef.current.complete = true;
        options?.onComplete?.({
          queriesCompleted: event.queriesCompleted,
          learningsFound: event.learningsFound,
        });
      } else if (isFailed && !callbacksCalledRef.current.failed) {
        callbacksCalledRef.current.failed = true;
        options?.onFailed?.(event.message || 'Research failed');
      }
    });

    return () => {
      unsub();
    };
  }, [socket, prospectId, clientId, isConnected, subscribe, options]);

  const reset = useCallback(() => {
    callbacksCalledRef.current = { complete: false, failed: false };
    setProgress({
      sessionId: null,
      prospectId: null,
      currentPhase: null,
      status: 'idle',
      message: null,
      error: null,
      currentDepth: 0,
      maxDepth: 0,
      currentQuery: null,
      queriesCompleted: 0,
      learningsFound: 0,
      relevantResultsFound: 0,
      latestLearning: null,
    });
  }, []);

  const getPhaseStatus = useCallback(
    (phase: EnhancedResearchPhase): 'pending' | 'active' | 'completed' => {
      if (!progress.currentPhase) return 'pending';
      const currentIndex = ENHANCED_RESEARCH_PHASES.indexOf(progress.currentPhase);
      const phaseIndex = ENHANCED_RESEARCH_PHASES.indexOf(phase);
      if (phaseIndex < currentIndex) return 'completed';
      if (phaseIndex === currentIndex) return 'active';
      return 'pending';
    },
    [progress.currentPhase]
  );

  const getPhaseLabel = useCallback(
    (phase?: EnhancedResearchPhase): string => {
      return PHASE_LABELS[phase || progress.currentPhase || 'initializing'];
    },
    [progress.currentPhase]
  );

  return {
    progress,
    reset,
    isConnected,
    getPhaseStatus,
    getPhaseLabel,
    phases: ENHANCED_RESEARCH_PHASES,
  };
}

// Legacy alias for backward compatibility
export const useDeepResearchProgress = useEnhancedResearchProgress;

