import { useEffect, useState, useCallback } from 'react';
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

