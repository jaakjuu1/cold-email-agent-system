import { broadcastToCampaign, broadcast, notifyListenerEvent } from '../websocket/server';
import type { Campaign, SentEmail, Response, Prospect } from '@cold-outreach/shared';

/**
 * Listeners Service
 * 
 * Coordinates real-time event emission to connected WebSocket clients.
 * Integrates with campaign management, email tracking, and response handling.
 */
export class ListenersService {
  private static instance: ListenersService;
  private activeListeners: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): ListenersService {
    if (!ListenersService.instance) {
      ListenersService.instance = new ListenersService();
    }
    return ListenersService.instance;
  }

  /**
   * Emit campaign stats update
   */
  emitCampaignUpdate(campaignId: string, stats: Campaign['stats']) {
    broadcastToCampaign(campaignId, {
      type: 'campaign_update',
      campaignId,
      stats,
    });
  }

  /**
   * Emit when a new email is sent
   */
  emitEmailSent(email: SentEmail) {
    broadcastToCampaign(email.campaignId, {
      type: 'email_sent',
      email,
    });

    // Also notify globally
    notifyListenerEvent(
      'email_sender',
      'low',
      `Email sent to prospect ${email.prospectId}`
    );
  }

  /**
   * Emit when an email bounces
   */
  emitEmailBounced(email: SentEmail) {
    broadcastToCampaign(email.campaignId, {
      type: 'email_bounced',
      email,
    });

    notifyListenerEvent(
      'bounce_detector',
      'normal',
      `Email bounced: ${email.bounceReason || 'Unknown reason'}`
    );
  }

  /**
   * Emit when a new response is received
   */
  emitNewResponse(response: Response) {
    broadcastToCampaign(response.campaignId, {
      type: 'new_response',
      response,
    });

    const priority = response.sentiment === 'positive' ? 'high' : 'normal';
    notifyListenerEvent(
      'response_detector',
      priority,
      `New ${response.sentiment} response from ${response.from}`
    );
  }

  /**
   * Emit prospect status change
   */
  emitProspectStatusChange(prospectId: string, status: Prospect['status']) {
    broadcast({
      type: 'prospect_status_change',
      prospectId,
      status,
    });
  }

  /**
   * Start periodic analytics broadcast
   */
  startAnalyticsBroadcast(intervalMs: number = 30000) {
    if (this.activeListeners.has('analytics')) {
      return; // Already running
    }

    const interval = setInterval(() => {
      // In production, this would fetch real analytics
      broadcast({
        type: 'listener_notification',
        listenerId: 'analytics',
        priority: 'low' as const,
        message: 'Analytics updated',
      });
    }, intervalMs);

    this.activeListeners.set('analytics', interval);
  }

  /**
   * Stop analytics broadcast
   */
  stopAnalyticsBroadcast() {
    const interval = this.activeListeners.get('analytics');
    if (interval) {
      clearInterval(interval);
      this.activeListeners.delete('analytics');
    }
  }

  /**
   * Process email event from webhook
   */
  processEmailEvent(
    eventType: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained',
    messageId: string,
    metadata: Record<string, unknown>
  ) {
    switch (eventType) {
      case 'delivered':
        notifyListenerEvent(
          'delivery_tracker',
          'low',
          `Email ${messageId} delivered`
        );
        break;

      case 'opened':
        notifyListenerEvent(
          'engagement_tracker',
          'normal',
          `Email ${messageId} opened`
        );
        break;

      case 'clicked':
        notifyListenerEvent(
          'engagement_tracker',
          'normal',
          `Link clicked in email ${messageId}`
        );
        break;

      case 'bounced':
        notifyListenerEvent(
          'bounce_detector',
          'high',
          `Email ${messageId} bounced: ${metadata.reason || 'Unknown'}`
        );
        break;

      case 'complained':
        notifyListenerEvent(
          'complaint_handler',
          'high',
          `Spam complaint for ${messageId}`
        );
        break;
    }
  }

  /**
   * Clean up all listeners
   */
  cleanup() {
    for (const [, interval] of this.activeListeners) {
      clearInterval(interval);
    }
    this.activeListeners.clear();
  }
}

export const listenersService = ListenersService.getInstance();

