import { Orchestrator } from '../orchestrator.js';
import { AgentFSManager } from '../storage/agentfs-manager.js';
import type { ResponseClassification } from '../types/index.js';

export interface EmailEvent {
  type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'replied';
  messageId: string;
  campaignId: string;
  prospectId: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface TrackingData {
  campaignId: string;
  prospectId: string;
  emailsSent: Array<{
    sequence: number;
    messageId: string;
    sentAt: string;
    status: string;
  }>;
  status: 'pending' | 'contacted' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'converted';
  lastUpdated: string;
}

/**
 * Tracking Agent
 * Responsible for tracking email events and classifying responses
 */
export class TrackingAgent {
  private orchestrator: Orchestrator;
  private storage: AgentFSManager | null = null;
  private clientId: string;

  constructor(orchestrator: Orchestrator, clientId: string) {
    this.orchestrator = orchestrator;
    this.clientId = clientId;
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.storage = await this.orchestrator.getStorage(this.clientId);
  }

  /**
   * Process an email event
   */
  async processEvent(event: EmailEvent): Promise<void> {
    if (!this.storage) {
      await this.initialize();
    }

    const tracking = await this.getOrCreateTracking(event.campaignId, event.prospectId);

    switch (event.type) {
      case 'sent':
        tracking.emailsSent.push({
          sequence: tracking.emailsSent.length + 1,
          messageId: event.messageId,
          sentAt: event.timestamp,
          status: 'sent',
        });
        tracking.status = 'contacted';
        break;

      case 'delivered':
        const sentEmail = tracking.emailsSent.find(e => e.messageId === event.messageId);
        if (sentEmail) {
          sentEmail.status = 'delivered';
        }
        break;

      case 'opened':
        tracking.status = 'opened';
        break;

      case 'clicked':
        tracking.status = 'clicked';
        break;

      case 'bounced':
        const bouncedEmail = tracking.emailsSent.find(e => e.messageId === event.messageId);
        if (bouncedEmail) {
          bouncedEmail.status = 'bounced';
        }
        tracking.status = 'bounced';
        break;

      case 'replied':
        tracking.status = 'replied';
        break;
    }

    tracking.lastUpdated = event.timestamp;
    await this.storage!.saveTracking(event.campaignId, event.prospectId, tracking);
  }

  /**
   * Get or create tracking data for a prospect
   */
  private async getOrCreateTracking(
    campaignId: string,
    prospectId: string
  ): Promise<TrackingData> {
    const existing = await this.storage!.getTracking<TrackingData>(campaignId, prospectId);
    
    if (existing) {
      return existing;
    }

    return {
      campaignId,
      prospectId,
      emailsSent: [],
      status: 'pending',
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Classify an email response
   */
  async classifyResponse(
    responseText: string,
    originalEmail: string
  ): Promise<ResponseClassification> {
    const result = await this.orchestrator.classifyResponse(responseText, originalEmail);
    
    return {
      sentiment: result.sentiment,
      requiresAction: result.requires_action,
      summary: result.summary,
      suggestedReply: result.suggested_reply,
    };
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<{
    totalProspects: number;
    contacted: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
  }> {
    if (!this.storage) {
      await this.initialize();
    }

    // Get all tracking data for the campaign
    const trackingKeys = await this.storage!.kvList(`tracking:${campaignId}:`);
    
    let contacted = 0;
    let opened = 0;
    let clicked = 0;
    let replied = 0;
    let bounced = 0;

    for (const key of trackingKeys) {
      const tracking = await this.storage!.kvGet<TrackingData>(key);
      if (!tracking) continue;

      if (tracking.status !== 'pending') contacted++;
      if (['opened', 'clicked', 'replied'].includes(tracking.status)) opened++;
      if (['clicked', 'replied'].includes(tracking.status)) clicked++;
      if (tracking.status === 'replied') replied++;
      if (tracking.status === 'bounced') bounced++;
    }

    const totalProspects = trackingKeys.length;

    return {
      totalProspects,
      contacted,
      opened,
      clicked,
      replied,
      bounced,
      openRate: contacted > 0 ? opened / contacted : 0,
      replyRate: contacted > 0 ? replied / contacted : 0,
      bounceRate: contacted > 0 ? bounced / contacted : 0,
    };
  }

  /**
   * Get prospects needing follow-up
   */
  async getProspectsNeedingFollowUp(
    campaignId: string,
    daysWithoutResponse: number = 3
  ): Promise<string[]> {
    if (!this.storage) {
      await this.initialize();
    }

    const trackingKeys = await this.storage!.kvList(`tracking:${campaignId}:`);
    const prospectsNeedingFollowUp: string[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysWithoutResponse);

    for (const key of trackingKeys) {
      const tracking = await this.storage!.kvGet<TrackingData>(key);
      if (!tracking) continue;

      // Check if they haven't replied and last email was sent more than X days ago
      if (
        tracking.status !== 'replied' &&
        tracking.status !== 'bounced' &&
        tracking.emailsSent.length > 0
      ) {
        const lastEmail = tracking.emailsSent[tracking.emailsSent.length - 1];
        const lastSentDate = new Date(lastEmail!.sentAt);
        
        if (lastSentDate < cutoffDate) {
          prospectsNeedingFollowUp.push(tracking.prospectId);
        }
      }
    }

    return prospectsNeedingFollowUp;
  }

  /**
   * Determine if a prospect should be excluded from future emails
   */
  shouldExclude(tracking: TrackingData): {
    exclude: boolean;
    reason?: string;
  } {
    // Exclude if bounced
    if (tracking.status === 'bounced') {
      return { exclude: true, reason: 'Email bounced' };
    }

    // Exclude if already replied (manual intervention needed)
    if (tracking.status === 'replied') {
      return { exclude: true, reason: 'Already replied' };
    }

    // Exclude if max emails sent (e.g., 3 email sequence)
    if (tracking.emailsSent.length >= 3) {
      return { exclude: true, reason: 'Sequence completed' };
    }

    return { exclude: false };
  }
}

