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
  const notificationIdRef = useRef(0);

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

