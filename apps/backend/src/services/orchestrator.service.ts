import { nanoid } from 'nanoid';
import type {
  Client,
  CreateClientInput,
  ICP,
  Campaign,
  CreateCampaignInput,
  Prospect,
  SentEmail,
  DiscoveryPhase,
  DiscoveryStatus,
} from '@cold-outreach/shared';
import { timestamp } from '@cold-outreach/shared';

// Progress callback type for discovery operations
export type DiscoveryProgressCallback = (
  phase: DiscoveryPhase,
  status: DiscoveryStatus,
  message?: string
) => void;
import { Orchestrator } from '@cold-outreach/agent';

// In-memory storage for MVP (replace with AgentFS in production)
const clients = new Map<string, Client>();
const icps = new Map<string, ICP>();
const campaigns = new Map<string, Campaign>();
const prospects = new Map<string, Prospect>();
const emails = new Map<string, SentEmail>();

// Lazy-initialized AI Orchestrator (created on first use to ensure env vars are loaded)
// The SDK uses ANTHROPIC_API_KEY env var directly, and loads skills from .claude/skills/
let _aiOrchestrator: Orchestrator | null = null;

function getAIOrchestrator(): Orchestrator {
  if (!_aiOrchestrator) {
    _aiOrchestrator = new Orchestrator({
      // projectRoot defaults to monorepo root where .claude/skills/ is located
      // SDK reads ANTHROPIC_API_KEY from environment automatically
      tursoUrl: process.env.TURSO_DATABASE_URL,
      tursoToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _aiOrchestrator;
}

export class OrchestratorService {
  // ===========================================
  // Client Operations
  // ===========================================

  async createClient(input: CreateClientInput): Promise<Client> {
    const id = `client-${nanoid(10)}`;
    const now = timestamp();
    
    const client: Client = {
      id,
      name: input.name,
      website: input.website,
      industry: input.industry,
      solution: input.solution,
      createdAt: now,
      updatedAt: now,
    };
    
    clients.set(id, client);
    return client;
  }

  async listClients(): Promise<Client[]> {
    return Array.from(clients.values());
  }

  async getClient(id: string): Promise<Client | undefined> {
    return clients.get(id);
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const client = clients.get(id);
    if (!client) throw new Error('Client not found');
    
    const updated = {
      ...client,
      ...updates,
      id,
      updatedAt: timestamp(),
    };
    
    clients.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    clients.delete(id);
    icps.delete(id);
  }

  async discoverClient(
    clientId: string,
    websiteUrl: string,
    onProgress?: DiscoveryProgressCallback
  ): Promise<ICP> {
    const id = `icp-${nanoid(10)}`;
    const now = timestamp();

    // Check if we have an API key configured
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

    let icpData: Record<string, unknown>;

    if (hasApiKey) {
      try {
        // Phase 1: Analyzing Website
        onProgress?.('analyzing_website', 'started', 'Crawling and analyzing website content');
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'OrchestratorService',
          event: 'discovery_progress',
          clientId,
          phase: 'analyzing_website',
          status: 'started',
        }));
        console.log(`[AI] Analyzing website: ${websiteUrl}`);

        const orchestrator = getAIOrchestrator();
        const businessProfile = await orchestrator.analyzeWebsite(clientId, websiteUrl);

        onProgress?.('analyzing_website', 'completed', 'Website analysis complete');
        console.log('[AI] Business profile generated');

        // Phase 2: Researching Market
        onProgress?.('researching_market', 'started', 'Researching market position and competitors');
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'OrchestratorService',
          event: 'discovery_progress',
          clientId,
          phase: 'researching_market',
          status: 'started',
        }));
        // Market research happens within website analysis, but we show it as separate phase for UX
        onProgress?.('researching_market', 'completed', 'Market research complete');

        // Phase 3: Generating ICP
        onProgress?.('generating_icp', 'started', 'Creating ideal customer profile');
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          component: 'OrchestratorService',
          event: 'discovery_progress',
          clientId,
          phase: 'generating_icp',
          status: 'started',
        }));
        console.log('[AI] Generating ICP from business profile');

        icpData = await orchestrator.generateICP(clientId, businessProfile) as Record<string, unknown>;

        onProgress?.('generating_icp', 'completed', 'ICP generated');
        console.log('[AI] ICP generated successfully');

      } catch (error) {
        console.error('[AI] Error during discovery:', error);
        onProgress?.('generating_icp', 'failed', `Discovery failed: ${error instanceof Error ? error.message : String(error)}`);
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          component: 'OrchestratorService',
          event: 'discovery_failed',
          clientId,
          error: error instanceof Error ? error.message : String(error),
        }));
        // Fall back to mock data if AI fails
        icpData = this.getMockICPData(websiteUrl);
      }
    } else {
      console.warn('[AI] No ANTHROPIC_API_KEY configured, using mock data');
      // Simulate rapid progress for mock data
      const mockPhases: Array<[DiscoveryPhase, string]> = [
        ['analyzing_website', 'Analyzing website (mock)'],
        ['researching_market', 'Researching market (mock)'],
        ['generating_icp', 'Generating ICP (mock)'],
        ['validating', 'Validating (mock)'],
      ];
      for (const [phase, message] of mockPhases) {
        onProgress?.(phase, 'started', message);
        onProgress?.(phase, 'completed', `${message} complete`);
      }
      icpData = this.getMockICPData(websiteUrl);
    }
    
    // Convert AI response to our ICP schema
    const icp: ICP = {
      id,
      clientId,
      icpSummary: (icpData.icp_summary as string) || (icpData.icpSummary as string) || `Ideal customers for ${websiteUrl}`,
      firmographicCriteria: {
        companySize: {
          employeeRanges: (icpData.firmographic_criteria as Record<string, unknown>)?.company_size?.employee_ranges as string[] ||
                          (icpData.firmographicCriteria as Record<string, unknown>)?.companySize?.employeeRanges as string[] ||
                          ['50-100', '100-500'],
          revenueRanges: (icpData.firmographic_criteria as Record<string, unknown>)?.company_size?.revenue_ranges as string[] ||
                          (icpData.firmographicCriteria as Record<string, unknown>)?.companySize?.revenueRanges as string[] ||
                          ['$5M-$20M', '$20M-$100M'],
        },
        companyStage: (icpData.firmographic_criteria as Record<string, unknown>)?.company_stage as string[] ||
                      (icpData.firmographicCriteria as Record<string, unknown>)?.companyStage as string[] ||
                      ['growth', 'established'],
        fundingStatus: (icpData.firmographic_criteria as Record<string, unknown>)?.funding_status as string[] ||
                       (icpData.firmographicCriteria as Record<string, unknown>)?.fundingStatus as string[],
      },
      geographicTargeting: {
        primaryMarkets: this.parseMarkets(icpData) || [
          { city: 'San Francisco', state: 'CA', country: 'USA', priority: 'high' },
          { city: 'New York', state: 'NY', country: 'USA', priority: 'high' },
        ],
      },
      industryTargeting: {
        primaryIndustries: this.parseIndustries(icpData) || [
          { name: 'Technology', subSegments: ['SaaS', 'B2B Software'], priority: 'high' },
        ],
      },
      decisionMakerTargeting: {
        primaryTitles: (icpData.decision_maker_targeting as Record<string, unknown>)?.primary_titles as string[] ||
                       (icpData.decisionMakerTargeting as Record<string, unknown>)?.primaryTitles as string[] ||
                       ['CEO', 'CTO', 'VP Engineering'],
        secondaryTitles: (icpData.decision_maker_targeting as Record<string, unknown>)?.secondary_titles as string[] ||
                         (icpData.decisionMakerTargeting as Record<string, unknown>)?.secondaryTitles as string[] ||
                         ['Director of Engineering', 'Head of Product'],
        departments: (icpData.decision_maker_targeting as Record<string, unknown>)?.departments as string[] ||
                     (icpData.decisionMakerTargeting as Record<string, unknown>)?.departments as string[] ||
                     ['Engineering', 'Product', 'Operations'],
      },
      messagingFramework: {
        primaryPainPointsToAddress: (icpData.messaging_framework as Record<string, unknown>)?.primary_pain_points_to_address as string[] ||
                                    (icpData.messagingFramework as Record<string, unknown>)?.primaryPainPointsToAddress as string[] ||
                                    ['Scaling efficiently', 'Reducing costs'],
        valuePropositions: (icpData.messaging_framework as Record<string, unknown>)?.value_propositions as string[] ||
                           (icpData.messagingFramework as Record<string, unknown>)?.valuePropositions as string[] ||
                           ['Increase productivity', 'Reduce time to market'],
        proofPoints: (icpData.messaging_framework as Record<string, unknown>)?.proof_points as string[] ||
                     (icpData.messagingFramework as Record<string, unknown>)?.proofPoints as string[] ||
                     ['Trusted by leading companies', 'Proven ROI'],
      },
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    
    icps.set(clientId, icp);
    return icp;
  }

  private getMockICPData(websiteUrl: string): Record<string, unknown> {
    return {
      icp_summary: `Based on analysis of ${websiteUrl}, ideal customers are mid-market B2B companies looking for innovative solutions to streamline their operations and drive growth.`,
      firmographic_criteria: {
        company_size: {
          employee_ranges: ['50-100', '100-500', '500-1000'],
          revenue_ranges: ['$5M-$20M', '$20M-$100M'],
        },
        company_stage: ['growth', 'established'],
        funding_status: ['Series A', 'Series B', 'Series C'],
      },
      geographic_targeting: {
        primary_markets: [
          { city: 'San Francisco', state: 'CA', country: 'USA', priority: 'high' },
          { city: 'New York', state: 'NY', country: 'USA', priority: 'high' },
          { city: 'Austin', state: 'TX', country: 'USA', priority: 'medium' },
        ],
      },
      industry_targeting: {
        primary_industries: [
          { name: 'Technology', sub_segments: ['SaaS', 'B2B Software', 'Enterprise Tech'], priority: 'high' },
          { name: 'Financial Services', sub_segments: ['FinTech', 'Banking'], priority: 'medium' },
        ],
      },
      decision_maker_targeting: {
        primary_titles: ['CEO', 'CTO', 'VP of Engineering', 'Chief Product Officer'],
        secondary_titles: ['Director of Engineering', 'Head of Product', 'VP of Operations'],
        departments: ['Engineering', 'Product', 'Operations', 'IT'],
      },
      messaging_framework: {
        primary_pain_points_to_address: [
          'Difficulty scaling operations efficiently',
          'High operational costs eating into margins',
          'Slow time-to-market for new features',
          'Lack of visibility into key metrics',
        ],
        value_propositions: [
          'Increase team productivity by 40%',
          'Reduce operational costs by 30%',
          'Accelerate time-to-market by 50%',
          'Real-time insights and analytics',
        ],
        proof_points: [
          '500+ companies trust our solution',
          'Average customer sees ROI within 3 months',
          '99.9% uptime SLA',
          'Named Leader in industry analyst reports',
        ],
      },
    };
  }

  private parseMarkets(icpData: Record<string, unknown>): Array<{ city: string; state: string; country: string; priority: 'high' | 'medium' | 'low' }> | null {
    const geo = icpData.geographic_targeting as Record<string, unknown> || icpData.geographicTargeting as Record<string, unknown>;
    const markets = geo?.primary_markets as Array<Record<string, unknown>> || geo?.primaryMarkets as Array<Record<string, unknown>>;
    
    if (!markets || !Array.isArray(markets)) return null;
    
    return markets.map(m => ({
      city: (m.city as string) || '',
      state: (m.state as string) || '',
      country: (m.country as string) || 'USA',
      priority: (m.priority as 'high' | 'medium' | 'low') || 'medium',
    }));
  }

  private parseIndustries(icpData: Record<string, unknown>): Array<{ name: string; subSegments: string[]; priority: 'high' | 'medium' | 'low' }> | null {
    const ind = icpData.industry_targeting as Record<string, unknown> || icpData.industryTargeting as Record<string, unknown>;
    const industries = ind?.primary_industries as Array<Record<string, unknown>> || ind?.primaryIndustries as Array<Record<string, unknown>>;
    
    if (!industries || !Array.isArray(industries)) return null;
    
    return industries.map(i => ({
      name: (i.name as string) || '',
      subSegments: (i.sub_segments as string[]) || (i.subSegments as string[]) || [],
      priority: (i.priority as 'high' | 'medium' | 'low') || 'medium',
    }));
  }

  async getClientICP(clientId: string): Promise<ICP | undefined> {
    return icps.get(clientId);
  }

  async updateClientICP(clientId: string, updates: Partial<ICP>): Promise<ICP> {
    const icp = icps.get(clientId);
    if (!icp) throw new Error('ICP not found');
    
    const updated = {
      ...icp,
      ...updates,
      clientId,
      status: 'refined' as const,
      updatedAt: timestamp(),
    };
    
    icps.set(clientId, updated);
    return updated;
  }

  async approveClientICP(clientId: string): Promise<ICP> {
    const icp = icps.get(clientId);
    if (!icp) throw new Error('ICP not found');
    
    const updated = {
      ...icp,
      status: 'approved' as const,
      updatedAt: timestamp(),
    };
    
    icps.set(clientId, updated);
    return updated;
  }

  // ===========================================
  // Campaign Operations
  // ===========================================

  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    const id = `campaign-${nanoid(10)}`;
    const now = timestamp();
    
    const campaign: Campaign = {
      id,
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      status: 'draft',
      prospectIds: input.prospectIds,
      emailTemplates: [],
      settings: {
        dailySendLimit: input.settings?.dailySendLimit ?? 50,
        sendWindowStart: input.settings?.sendWindowStart ?? '09:00',
        sendWindowEnd: input.settings?.sendWindowEnd ?? '17:00',
        timezone: input.settings?.timezone ?? 'America/New_York',
        skipWeekends: input.settings?.skipWeekends ?? true,
      },
      stats: {
        totalProspects: input.prospectIds.length,
        emailsSent: 0,
        emailsDelivered: 0,
        emailsBounced: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        responses: 0,
        positiveResponses: 0,
        meetings: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    
    campaigns.set(id, campaign);
    return campaign;
  }

  async listCampaigns(filters?: { clientId?: string; status?: string }): Promise<Campaign[]> {
    let result = Array.from(campaigns.values());
    
    if (filters?.clientId) {
      result = result.filter(c => c.clientId === filters.clientId);
    }
    if (filters?.status) {
      result = result.filter(c => c.status === filters.status);
    }
    
    return result;
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return campaigns.get(id);
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign> {
    const campaign = campaigns.get(id);
    if (!campaign) throw new Error('Campaign not found');
    
    const updated = {
      ...campaign,
      ...updates,
      id,
      updatedAt: timestamp(),
    };
    
    campaigns.set(id, updated);
    return updated;
  }

  async deleteCampaign(id: string): Promise<void> {
    campaigns.delete(id);
  }

  async startCampaign(id: string): Promise<Campaign> {
    return this.updateCampaign(id, { status: 'active' });
  }

  async pauseCampaign(id: string): Promise<Campaign> {
    return this.updateCampaign(id, { status: 'paused' });
  }

  async resumeCampaign(id: string): Promise<Campaign> {
    return this.updateCampaign(id, { status: 'active' });
  }

  async getCampaignStats(id: string): Promise<Campaign['stats'] | undefined> {
    const campaign = campaigns.get(id);
    return campaign?.stats;
  }

  async getCampaignProspects(campaignId: string): Promise<Prospect[]> {
    const campaign = campaigns.get(campaignId);
    if (!campaign) return [];
    
    return campaign.prospectIds
      .map(id => prospects.get(id))
      .filter((p): p is Prospect => p !== undefined);
  }

  async getCampaignEmails(campaignId: string): Promise<SentEmail[]> {
    return Array.from(emails.values())
      .filter(e => e.campaignId === campaignId);
  }

  async generateCampaignEmails(_campaignId: string): Promise<void> {
    // This will be replaced with actual agent call
    console.log('Generating emails for campaign...');
  }

  // ===========================================
  // Prospect Operations
  // ===========================================

  async listProspects(filters?: {
    clientId?: string;
    status?: string;
    industry?: string;
    location?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Prospect[]; total: number }> {
    let result = Array.from(prospects.values());
    
    if (filters?.status) {
      result = result.filter(p => p.status === filters.status);
    }
    if (filters?.industry) {
      result = result.filter(p => p.industry === filters.industry);
    }
    if (filters?.location) {
      result = result.filter(p => p.location.city === filters.location);
    }
    
    const total = result.length;
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    
    return {
      data: result.slice(start, start + pageSize),
      total,
    };
  }

  async discoverLeads(params: {
    clientId: string;
    phase?: string;
    locations?: Array<{ city: string; state: string; country: string }>;
    industries?: string[];
    limit?: number;
  }): Promise<{ jobId: string; message: string }> {
    // This will be replaced with actual agent call
    const jobId = `job-${nanoid(10)}`;
    console.log('Starting lead discovery...', params);
    return {
      jobId,
      message: 'Lead discovery started',
    };
  }

  async getProspect(id: string): Promise<Prospect | undefined> {
    return prospects.get(id);
  }

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect> {
    const prospect = prospects.get(id);
    if (!prospect) throw new Error('Prospect not found');
    
    const updated = {
      ...prospect,
      ...updates,
      id,
      updatedAt: timestamp(),
    };
    
    prospects.set(id, updated);
    return updated;
  }

  async deleteProspect(id: string): Promise<void> {
    prospects.delete(id);
  }

  async enrichProspect(id: string): Promise<Prospect> {
    // This will be replaced with actual enrichment
    const prospect = prospects.get(id);
    if (!prospect) throw new Error('Prospect not found');
    return prospect;
  }

  async getProspectTracking(prospectId: string): Promise<SentEmail[]> {
    return Array.from(emails.values())
      .filter(e => e.prospectId === prospectId);
  }

  async updateProspectStatus(id: string, status: Prospect['status']): Promise<Prospect> {
    return this.updateProspect(id, { status });
  }

  // ===========================================
  // Email Tracking Operations
  // ===========================================

  async markEmailDelivered(messageId: string, deliveredAt: string): Promise<SentEmail | undefined> {
    const email = Array.from(emails.values()).find(e => e.messageId === messageId);
    if (!email) return undefined;
    
    const updated: SentEmail = {
      ...email,
      status: 'delivered',
      deliveredAt,
    };
    
    emails.set(email.id, updated);
    return updated;
  }

  async markEmailBounced(
    messageId: string,
    _bounceType: string,
    bounceReason: string,
    bouncedAt: string
  ): Promise<SentEmail | undefined> {
    const email = Array.from(emails.values()).find(e => e.messageId === messageId);
    if (!email) return undefined;
    
    const updated: SentEmail = {
      ...email,
      status: 'bounced',
      bouncedAt,
      bounceReason,
    };
    
    emails.set(email.id, updated);
    return updated;
  }

  async markEmailOpened(
    messageId: string,
    openedAt: string,
    _metadata: { userAgent?: string; ip?: string }
  ): Promise<SentEmail | undefined> {
    const email = Array.from(emails.values()).find(e => e.messageId === messageId);
    if (!email) return undefined;
    
    const updated: SentEmail = {
      ...email,
      status: 'opened',
      openedAt,
    };
    
    emails.set(email.id, updated);
    return updated;
  }

  async markEmailClicked(
    messageId: string,
    clickedAt: string,
    _link: string,
    _metadata: { userAgent?: string; ip?: string }
  ): Promise<SentEmail | undefined> {
    const email = Array.from(emails.values()).find(e => e.messageId === messageId);
    if (!email) return undefined;
    
    const updated: SentEmail = {
      ...email,
      status: 'clicked',
      clickedAt,
    };
    
    emails.set(email.id, updated);
    return updated;
  }

  async markEmailComplained(
    messageId: string,
    _timestamp: string,
    _complaintType: string
  ): Promise<void> {
    const email = Array.from(emails.values()).find(e => e.messageId === messageId);
    if (!email) return;
    
    // Mark prospect as rejected
    await this.updateProspectStatus(email.prospectId, 'rejected');
  }
}

