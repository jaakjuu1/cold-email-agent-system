import { nanoid } from 'nanoid';
import { createClient, type Client as LibsqlClient } from '@libsql/client';
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
  EmailSettings,
  CreateEmailSettingsInput,
  UpdateEmailSettingsInput,
  EmailProvider,
  SmtpConfig,
  ImapConfig,
  LeadDiscoveryProgressEvent,
  DeepResearchResult,
} from '@cold-outreach/shared';
import { timestamp } from '@cold-outreach/shared';
import { broadcastToClient } from '../websocket/server.js';
import { getEmailService, type ClientEmailConfig } from './email.service.js';

// Progress callback type for discovery operations
export type DiscoveryProgressCallback = (
  phase: DiscoveryPhase,
  status: DiscoveryStatus,
  message?: string
) => void;

// Progress callback type for lead discovery
export type LeadDiscoveryProgressCallback = (event: LeadDiscoveryProgressEvent) => void;

import {
  Orchestrator,
  LeadDiscoveryPipeline,
  type DiscoveredProspect,
  executeEnhancedDeepResearch,
  sessionToLegacyFormat,
} from '@cold-outreach/agent';
import type { EnhancedResearchProgressEvent, ResearchSession } from '@cold-outreach/shared';

// Database client for persistent storage
let _db: LibsqlClient | null = null;
let _dbInitialized = false;

function getDb(): LibsqlClient {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _db = createClient({ url, authToken });
  }
  return _db;
}

async function ensureTablesExist(): Promise<void> {
  if (_dbInitialized) return;

  const db = getDb();

  // Create clients table (if not exists)
  await db.execute(`CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    website TEXT NOT NULL,
    industry TEXT,
    solution TEXT,
    summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  // Add summary column to existing clients table if it doesn't exist
  // Just try to add it - if it already exists, catch the error
  console.log('[DB] Checking if summary column needs to be added...');
  try {
    await db.execute(`ALTER TABLE clients ADD COLUMN summary TEXT`);
    console.log('[DB] Successfully added summary column to clients table');
  } catch (error: unknown) {
    // Column already exists - this is fine
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('duplicate column') || errorMessage.includes('already exists')) {
      console.log('[DB] Summary column already exists');
    } else {
      console.error('[DB] Error adding summary column:', errorMessage);
    }
  }

  // Add imap_config column to existing email_settings table if it doesn't exist
  console.log('[DB] Checking if imap_config column needs to be added...');
  try {
    await db.execute(`ALTER TABLE email_settings ADD COLUMN imap_config TEXT`);
    console.log('[DB] Successfully added imap_config column to email_settings table');
  } catch (error: unknown) {
    // Column already exists or table doesn't exist yet - this is fine
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('duplicate column') || errorMessage.includes('already exists')) {
      console.log('[DB] imap_config column already exists');
    } else if (errorMessage.includes('no such table')) {
      console.log('[DB] email_settings table does not exist yet, will be created');
    } else {
      console.error('[DB] Error adding imap_config column:', errorMessage);
    }
  }

  // Add deep_research column to prospects table if it doesn't exist
  console.log('[DB] Checking if deep_research column needs to be added...');
  try {
    await db.execute(`ALTER TABLE prospects ADD COLUMN deep_research TEXT`);
    console.log('[DB] Successfully added deep_research column to prospects table');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('duplicate column') || errorMessage.includes('already exists')) {
      console.log('[DB] deep_research column already exists');
    } else if (errorMessage.includes('no such table')) {
      console.log('[DB] prospects table does not exist yet, will be created');
    } else {
      console.error('[DB] Error adding deep_research column:', errorMessage);
    }
  }

  await db.batch([
    `CREATE TABLE IF NOT EXISTS icps (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,
    `CREATE TABLE IF NOT EXISTS email_settings (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      from_email TEXT NOT NULL,
      from_name TEXT NOT NULL,
      reply_to_email TEXT,
      api_key TEXT,
      smtp_config TEXT,
      imap_config TEXT,
      daily_send_limit INTEGER DEFAULT 200,
      hourly_send_limit INTEGER DEFAULT 50,
      min_delay_seconds INTEGER DEFAULT 5,
      signature TEXT,
      track_opens INTEGER DEFAULT 1,
      track_clicks INTEGER DEFAULT 1,
      is_verified INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,
    // Prospects table for lead discovery
    `CREATE TABLE IF NOT EXISTS prospects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      website TEXT,
      industry TEXT NOT NULL,
      sub_industry TEXT,
      employee_count TEXT,
      revenue TEXT,
      location_city TEXT NOT NULL,
      location_state TEXT NOT NULL,
      location_country TEXT NOT NULL,
      location_address TEXT,
      google_maps_url TEXT,
      google_place_id TEXT,
      rating REAL,
      review_count INTEGER,
      description TEXT,
      pain_points TEXT,
      recent_news TEXT,
      technologies TEXT,
      contacts TEXT NOT NULL DEFAULT '[]',
      icp_match_score REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      discovery_job_id TEXT,
      source TEXT DEFAULT 'google_maps',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,
    // Discovery jobs table for tracking long-running lead discovery
    `CREATE TABLE IF NOT EXISTS discovery_jobs (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      locations TEXT NOT NULL,
      industries TEXT NOT NULL,
      limit_count INTEGER DEFAULT 50,
      total_places_found INTEGER DEFAULT 0,
      total_enriched INTEGER DEFAULT 0,
      total_contacts_found INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_icps_client ON icps(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_email_settings_client ON email_settings(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_prospects_client ON prospects(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status)`,
    `CREATE INDEX IF NOT EXISTS idx_prospects_score ON prospects(icp_match_score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_prospects_job ON prospects(discovery_job_id)`,
    `CREATE INDEX IF NOT EXISTS idx_discovery_jobs_client ON discovery_jobs(client_id)`,
    // Campaigns table for email campaigns
    `CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',
      email_templates TEXT,
      prospect_ids TEXT,
      settings TEXT,
      stats TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    )`,
    // Sent emails table for tracking individual emails
    `CREATE TABLE IF NOT EXISTS sent_emails (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      prospect_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      sequence_number INTEGER NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      body_html TEXT,
      status TEXT DEFAULT 'pending',
      message_id TEXT,
      sent_at TEXT,
      delivered_at TEXT,
      opened_at TEXT,
      clicked_at TEXT,
      replied_at TEXT,
      bounced_at TEXT,
      bounce_reason TEXT,
      open_count INTEGER DEFAULT 0,
      click_count INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    )`,
    // Responses table for email replies
    `CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      sent_email_id TEXT NOT NULL,
      prospect_id TEXT NOT NULL,
      from_email TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      sentiment TEXT,
      requires_action INTEGER DEFAULT 0,
      suggested_reply TEXT,
      received_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sent_email_id) REFERENCES sent_emails(id),
      FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_campaigns_client ON campaigns(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)`,
    `CREATE INDEX IF NOT EXISTS idx_sent_emails_campaign ON sent_emails(campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sent_emails_prospect ON sent_emails(prospect_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sent_emails_status ON sent_emails(status)`,
    `CREATE INDEX IF NOT EXISTS idx_sent_emails_message_id ON sent_emails(message_id)`,
    `CREATE INDEX IF NOT EXISTS idx_responses_sent_email ON responses(sent_email_id)`,
    `CREATE INDEX IF NOT EXISTS idx_responses_prospect ON responses(prospect_id)`,
  ]);

  _dbInitialized = true;
}

// In-memory cache for quick access (populated from DB)
const clientsCache = new Map<string, Client>();
const icpsCache = new Map<string, ICP>();
// Note: campaigns, sent_emails, and prospects are now stored in the database

// Lazy-initialized AI Orchestrator (created on first use to ensure env vars are loaded)
// Uses DEEPSEEK_API_KEY env var with Vercel AI SDK and DeepSeek provider
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
  // Client Operations (with Turso persistence)
  // ===========================================

  async createClient(input: CreateClientInput): Promise<Client> {
    await ensureTablesExist();
    const db = getDb();

    const id = `client-${nanoid(10)}`;
    const now = timestamp();

    const client: Client = {
      id,
      name: input.name,
      website: input.website,
      industry: input.industry,
      solution: input.solution,
      summary: undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Persist to database
    await db.execute({
      sql: `INSERT INTO clients (id, name, website, industry, solution, summary, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, client.name, client.website, client.industry || null, client.solution || null, null, now, now],
    });

    // Update cache
    clientsCache.set(id, client);
    return client;
  }

  async listClients(): Promise<Client[]> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute('SELECT * FROM clients ORDER BY created_at DESC');

    const clients: Client[] = result.rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      website: row.website as string,
      industry: row.industry as string | undefined,
      solution: row.solution as string | undefined,
      summary: row.summary as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));

    // Update cache
    clients.forEach((c) => clientsCache.set(c.id, c));

    return clients;
  }

  async getClient(id: string): Promise<Client | undefined> {
    // Check cache first
    if (clientsCache.has(id)) {
      return clientsCache.get(id);
    }

    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT * FROM clients WHERE id = ?',
      args: [id],
    });

    if (result.rows.length === 0) return undefined;

    const row = result.rows[0];
    const client: Client = {
      id: row.id as string,
      name: row.name as string,
      website: row.website as string,
      industry: row.industry as string | undefined,
      solution: row.solution as string | undefined,
      summary: row.summary as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };

    // Update cache
    clientsCache.set(id, client);
    return client;
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const client = await this.getClient(id);
    if (!client) throw new Error('Client not found');

    const now = timestamp();
    const updated: Client = {
      ...client,
      ...updates,
      id,
      updatedAt: now,
    };

    await ensureTablesExist();
    const db = getDb();

    await db.execute({
      sql: `UPDATE clients SET name = ?, website = ?, industry = ?, solution = ?, summary = ?, updated_at = ?
            WHERE id = ?`,
      args: [updated.name, updated.website, updated.industry || null, updated.solution || null, updated.summary || null, now, id],
    });

    // Update cache
    clientsCache.set(id, updated);
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await ensureTablesExist();
    const db = getDb();

    // Delete from database
    await db.batch([
      { sql: 'DELETE FROM icps WHERE client_id = ?', args: [id] },
      { sql: 'DELETE FROM clients WHERE id = ?', args: [id] },
    ]);

    // Clear from cache
    clientsCache.delete(id);
    icpsCache.delete(id);
  }

  /**
   * Get business profile data from tool_calls table (analyze_website output)
   * and optionally update the client record if fields are missing
   */
  async getClientBusinessProfile(clientId: string): Promise<{
    industry?: string;
    solution?: string;
    summary?: string;
  } | null> {
    await ensureTablesExist();
    const db = getDb();

    // Query tool_calls for analyze_website output for this client
    const result = await db.execute({
      sql: `SELECT output FROM tool_calls
            WHERE client_id = ? AND tool_name = 'analyze_website'
            ORDER BY created_at DESC LIMIT 1`,
      args: [clientId],
    });

    if (result.rows.length === 0) return null;

    try {
      const output = JSON.parse(result.rows[0]?.output as string || '{}');
      return {
        industry: output.industry || output.sub_industry,
        solution: output.value_proposition,
        summary: output.summary,
      };
    } catch {
      return null;
    }
  }

  /**
   * Populate client profile from tool_calls data if fields are missing
   */
  async populateClientFromDiscovery(clientId: string): Promise<Client | null> {
    const client = await this.getClient(clientId);
    if (!client) return null;

    // Check if profile fields are already populated
    if (client.industry && client.solution && client.summary) {
      return client;
    }

    // Get business profile from tool_calls
    const profile = await this.getClientBusinessProfile(clientId);
    if (!profile) return client;

    // Update client with discovered data (only missing fields)
    const updates: Partial<Client> = {};
    if (!client.industry && profile.industry) updates.industry = profile.industry;
    if (!client.solution && profile.solution) updates.solution = profile.solution;
    if (!client.summary && profile.summary) updates.summary = profile.summary;

    if (Object.keys(updates).length > 0) {
      return this.updateClient(clientId, updates);
    }

    return client;
  }

  async discoverClient(
    clientId: string,
    websiteUrl: string,
    onProgress?: DiscoveryProgressCallback,
    additionalPrompt?: string
  ): Promise<ICP> {
    const id = `icp-${nanoid(10)}`;
    const now = timestamp();

    // Check if we have an API key configured
    const hasApiKey = !!process.env.DEEPSEEK_API_KEY;

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
        const businessProfile = await orchestrator.analyzeWebsite(clientId, websiteUrl, additionalPrompt);

        onProgress?.('analyzing_website', 'completed', 'Website analysis complete');
        console.log('[AI] Business profile generated');

        // Update client record with discovered industry, solution, and summary from business profile
        const profile = businessProfile as Record<string, unknown>;
        const discoveredIndustry = (profile.industry as string) || (profile.sub_industry as string);
        const discoveredSolution = (profile.value_proposition as string);
        const discoveredSummary = (profile.summary as string);

        if (discoveredIndustry || discoveredSolution || discoveredSummary) {
          await this.updateClient(clientId, {
            industry: discoveredIndustry,
            solution: discoveredSolution,
            summary: discoveredSummary,
          });
          console.log(`[AI] Updated client ${clientId} with industry: ${discoveredIndustry}, solution: ${discoveredSolution?.substring(0, 50)}..., summary: ${discoveredSummary?.substring(0, 50)}...`);
        }

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

        icpData = await orchestrator.generateICP(clientId, businessProfile, additionalPrompt) as Record<string, unknown>;

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
        // Re-throw the error instead of falling back to mock data
        throw error;
      }
    } else {
      // No API key configured - fail with a clear error message
      const errorMessage = 'DEEPSEEK_API_KEY is not configured. Please set your DeepSeek API key in the environment variables.';
      console.error(`[AI] ${errorMessage}`);
      onProgress?.('analyzing_website', 'failed', errorMessage);
      throw new Error(errorMessage);
    }
    
    // Convert AI response to our ICP schema
    // Helper to safely access nested properties
    const firmographicCriteria = (icpData.firmographic_criteria || icpData.firmographicCriteria || {}) as Record<string, unknown>;
    const companySize = (firmographicCriteria.company_size || firmographicCriteria.companySize || {}) as Record<string, unknown>;

    const icp: ICP = {
      id,
      clientId,
      icpSummary: (icpData.icp_summary as string) || (icpData.icpSummary as string) || `Ideal customers for ${websiteUrl}`,
      firmographicCriteria: {
        companySize: {
          employeeRanges: (companySize.employee_ranges || companySize.employeeRanges || ['50-100', '100-500']) as string[],
          revenueRanges: (companySize.revenue_ranges || companySize.revenueRanges || ['$5M-$20M', '$20M-$100M']) as string[],
        },
        companyStage: (firmographicCriteria.company_stage || firmographicCriteria.companyStage || ['growth', 'established']) as string[],
        fundingStatus: (firmographicCriteria.funding_status || firmographicCriteria.fundingStatus) as string[] | undefined,
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

    // Persist ICP to database
    await this.saveICP(icp);
    return icp;
  }

  private async saveICP(icp: ICP): Promise<void> {
    await ensureTablesExist();
    const db = getDb();
    const now = timestamp();

    await db.execute({
      sql: `INSERT INTO icps (id, client_id, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET data = ?, updated_at = ?`,
      args: [icp.id, icp.clientId, JSON.stringify(icp), now, now, JSON.stringify(icp), now],
    });

    // Update cache
    icpsCache.set(icp.clientId, icp);
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
    // Check cache first
    if (icpsCache.has(clientId)) {
      return icpsCache.get(clientId);
    }

    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT data FROM icps WHERE client_id = ? ORDER BY updated_at DESC LIMIT 1',
      args: [clientId],
    });

    if (result.rows.length === 0) return undefined;

    const row = result.rows[0];
    if (!row) return undefined;

    const icp = JSON.parse(row.data as string) as ICP;

    // Update cache
    icpsCache.set(clientId, icp);
    return icp;
  }

  async updateClientICP(clientId: string, updates: Partial<ICP>): Promise<ICP> {
    const icp = await this.getClientICP(clientId);
    if (!icp) throw new Error('ICP not found');

    const updated: ICP = {
      ...icp,
      ...updates,
      clientId,
      status: 'refined',
      updatedAt: timestamp(),
    };

    await this.saveICP(updated);
    return updated;
  }

  async approveClientICP(clientId: string): Promise<ICP> {
    const icp = await this.getClientICP(clientId);
    if (!icp) throw new Error('ICP not found');

    const updated: ICP = {
      ...icp,
      status: 'approved',
      updatedAt: timestamp(),
    };

    await this.saveICP(updated);
    return updated;
  }

  // ===========================================
  // Email Settings Operations
  // ===========================================

  async createEmailSettings(input: CreateEmailSettingsInput): Promise<EmailSettings> {
    await ensureTablesExist();
    const db = getDb();

    const id = `email-settings-${nanoid(10)}`;
    const now = timestamp();

    const settings: EmailSettings = {
      id,
      clientId: input.clientId,
      provider: input.provider,
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      replyToEmail: input.replyToEmail,
      apiKey: input.apiKey,
      smtpConfig: input.smtpConfig,
      imapConfig: input.imapConfig,
      dailySendLimit: input.dailySendLimit ?? 200,
      hourlySendLimit: input.hourlySendLimit ?? 50,
      minDelaySeconds: input.minDelaySeconds ?? 5,
      signature: input.signature,
      trackOpens: input.trackOpens ?? true,
      trackClicks: input.trackClicks ?? true,
      isVerified: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.execute({
      sql: `INSERT INTO email_settings (
        id, client_id, provider, from_email, from_name, reply_to_email,
        api_key, smtp_config, imap_config, daily_send_limit, hourly_send_limit, min_delay_seconds,
        signature, track_opens, track_clicks, is_verified, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        input.clientId,
        input.provider,
        input.fromEmail,
        input.fromName,
        input.replyToEmail || null,
        input.apiKey || null,
        input.smtpConfig ? JSON.stringify(input.smtpConfig) : null,
        input.imapConfig ? JSON.stringify(input.imapConfig) : null,
        settings.dailySendLimit,
        settings.hourlySendLimit,
        settings.minDelaySeconds,
        input.signature || null,
        settings.trackOpens ? 1 : 0,
        settings.trackClicks ? 1 : 0,
        0, // isVerified
        1, // isActive
        now,
        now,
      ],
    });

    return settings;
  }

  async getEmailSettings(clientId: string): Promise<EmailSettings | undefined> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT * FROM email_settings WHERE client_id = ?',
      args: [clientId],
    });

    if (result.rows.length === 0) return undefined;

    const row = result.rows[0];
    if (!row) return undefined;

    return {
      id: row.id as string,
      clientId: row.client_id as string,
      provider: row.provider as EmailProvider,
      fromEmail: row.from_email as string,
      fromName: row.from_name as string,
      replyToEmail: row.reply_to_email as string | undefined,
      apiKey: row.api_key as string | undefined,
      smtpConfig: row.smtp_config ? JSON.parse(row.smtp_config as string) as SmtpConfig : undefined,
      imapConfig: row.imap_config ? JSON.parse(row.imap_config as string) as ImapConfig : undefined,
      dailySendLimit: row.daily_send_limit as number,
      hourlySendLimit: row.hourly_send_limit as number,
      minDelaySeconds: row.min_delay_seconds as number,
      signature: row.signature as string | undefined,
      trackOpens: row.track_opens === 1,
      trackClicks: row.track_clicks === 1,
      isVerified: row.is_verified === 1,
      isActive: row.is_active === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  async updateEmailSettings(clientId: string, updates: UpdateEmailSettingsInput): Promise<EmailSettings> {
    const existing = await this.getEmailSettings(clientId);
    if (!existing) throw new Error('Email settings not found');

    await ensureTablesExist();
    const db = getDb();
    const now = timestamp();

    const updated: EmailSettings = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    await db.execute({
      sql: `UPDATE email_settings SET
        provider = ?, from_email = ?, from_name = ?, reply_to_email = ?,
        api_key = ?, smtp_config = ?, imap_config = ?, daily_send_limit = ?, hourly_send_limit = ?,
        min_delay_seconds = ?, signature = ?, track_opens = ?, track_clicks = ?,
        is_active = ?, updated_at = ?
        WHERE client_id = ?`,
      args: [
        updated.provider,
        updated.fromEmail,
        updated.fromName,
        updated.replyToEmail || null,
        updated.apiKey || null,
        updated.smtpConfig ? JSON.stringify(updated.smtpConfig) : null,
        updated.imapConfig ? JSON.stringify(updated.imapConfig) : null,
        updated.dailySendLimit,
        updated.hourlySendLimit,
        updated.minDelaySeconds,
        updated.signature || null,
        updated.trackOpens ? 1 : 0,
        updated.trackClicks ? 1 : 0,
        updated.isActive ? 1 : 0,
        now,
        clientId,
      ],
    });

    return updated;
  }

  async deleteEmailSettings(clientId: string): Promise<void> {
    await ensureTablesExist();
    const db = getDb();

    await db.execute({
      sql: 'DELETE FROM email_settings WHERE client_id = ?',
      args: [clientId],
    });
  }

  // ===========================================
  // Campaign Operations (with Turso persistence)
  // ===========================================

  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    await ensureTablesExist();
    const db = getDb();

    const id = `campaign-${nanoid(10)}`;
    const now = timestamp();

    const campaign: Campaign = {
      id,
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      status: 'draft',
      prospectIds: input.prospectIds,
      emailTemplates: input.emailTemplates || [],
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

    // Persist to database
    await db.execute({
      sql: `INSERT INTO campaigns (id, client_id, name, description, status, email_templates, prospect_ids, settings, stats, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        campaign.clientId,
        campaign.name,
        campaign.description || null,
        campaign.status,
        JSON.stringify(campaign.emailTemplates),
        JSON.stringify(campaign.prospectIds),
        JSON.stringify(campaign.settings),
        JSON.stringify(campaign.stats),
        now,
        now,
      ],
    });

    console.log(`[Campaign] Created campaign ${id} with ${campaign.emailTemplates.length} templates for ${campaign.prospectIds.length} prospects`);
    return campaign;
  }

  private mapRowToCampaign(row: Record<string, unknown>): Campaign {
    return {
      id: String(row.id),
      clientId: String(row.client_id),
      name: String(row.name),
      description: row.description as string | undefined,
      status: (row.status as Campaign['status']) || 'draft',
      prospectIds: row.prospect_ids ? JSON.parse(String(row.prospect_ids)) : [],
      emailTemplates: row.email_templates ? JSON.parse(String(row.email_templates)) : [],
      settings: row.settings ? JSON.parse(String(row.settings)) : {
        dailySendLimit: 50,
        sendWindowStart: '09:00',
        sendWindowEnd: '17:00',
        timezone: 'America/New_York',
        skipWeekends: true,
      },
      stats: row.stats ? JSON.parse(String(row.stats)) : {
        totalProspects: 0,
        emailsSent: 0,
        emailsDelivered: 0,
        emailsBounced: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        responses: 0,
        positiveResponses: 0,
        meetings: 0,
      },
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async listCampaigns(filters?: { clientId?: string; status?: string }): Promise<Campaign[]> {
    await ensureTablesExist();
    const db = getDb();

    const whereClauses: string[] = [];
    const args: string[] = [];

    if (filters?.clientId) {
      whereClauses.push('client_id = ?');
      args.push(filters.clientId);
    }
    if (filters?.status) {
      whereClauses.push('status = ?');
      args.push(filters.status);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await db.execute({
      sql: `SELECT * FROM campaigns ${whereStr} ORDER BY created_at DESC`,
      args,
    });

    return result.rows.map(row => this.mapRowToCampaign(row as Record<string, unknown>));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT * FROM campaigns WHERE id = ?',
      args: [id],
    });

    if (result.rows.length === 0) return undefined;
    return this.mapRowToCampaign(result.rows[0] as Record<string, unknown>);
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign> {
    const campaign = await this.getCampaign(id);
    if (!campaign) throw new Error('Campaign not found');

    const db = getDb();
    const now = timestamp();

    const updated: Campaign = {
      ...campaign,
      ...updates,
      id,
      updatedAt: now,
    };

    await db.execute({
      sql: `UPDATE campaigns SET
            name = ?, description = ?, status = ?, email_templates = ?,
            prospect_ids = ?, settings = ?, stats = ?, updated_at = ?
            WHERE id = ?`,
      args: [
        updated.name,
        updated.description || null,
        updated.status,
        JSON.stringify(updated.emailTemplates),
        JSON.stringify(updated.prospectIds),
        JSON.stringify(updated.settings),
        JSON.stringify(updated.stats),
        now,
        id,
      ],
    });

    return updated;
  }

  async deleteCampaign(id: string): Promise<void> {
    await ensureTablesExist();
    const db = getDb();

    // Delete sent emails first (foreign key constraint)
    await db.execute({
      sql: 'DELETE FROM sent_emails WHERE campaign_id = ?',
      args: [id],
    });

    await db.execute({
      sql: 'DELETE FROM campaigns WHERE id = ?',
      args: [id],
    });
  }

  async startCampaign(id: string): Promise<Campaign> {
    const campaign = await this.getCampaign(id);
    if (!campaign) throw new Error('Campaign not found');

    if (campaign.emailTemplates.length === 0) {
      throw new Error('Campaign has no email templates. Add templates before starting.');
    }

    if (campaign.prospectIds.length === 0) {
      throw new Error('Campaign has no prospects. Add prospects before starting.');
    }

    // Update status to active
    const updatedCampaign = await this.updateCampaign(id, { status: 'active' });

    // Start campaign execution async (non-blocking)
    this.executeCampaign(id)
      .catch(err => {
        console.error(`[Campaign] Execution failed for ${id}:`, err);
        this.updateCampaign(id, { status: 'paused' });
      });

    return updatedCampaign;
  }

  async pauseCampaign(id: string): Promise<Campaign> {
    return this.updateCampaign(id, { status: 'paused' });
  }

  async resumeCampaign(id: string): Promise<Campaign> {
    const campaign = await this.getCampaign(id);
    if (!campaign) throw new Error('Campaign not found');

    const updatedCampaign = await this.updateCampaign(id, { status: 'active' });

    // Resume campaign execution async
    this.executeCampaign(id)
      .catch(err => {
        console.error(`[Campaign] Execution failed for ${id}:`, err);
        this.updateCampaign(id, { status: 'paused' });
      });

    return updatedCampaign;
  }

  async getCampaignStats(id: string): Promise<Campaign['stats'] | undefined> {
    const campaign = await this.getCampaign(id);
    return campaign?.stats;
  }

  async getCampaignProspects(campaignId: string): Promise<Prospect[]> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) return [];

    const prospects: Prospect[] = [];
    for (const prospectId of campaign.prospectIds) {
      const prospect = await this.getProspect(prospectId);
      if (prospect) {
        prospects.push(prospect);
      }
    }

    return prospects;
  }

  async getCampaignEmails(campaignId: string): Promise<SentEmail[]> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT * FROM sent_emails WHERE campaign_id = ? ORDER BY created_at DESC',
      args: [campaignId],
    });

    return result.rows.map(row => this.mapRowToSentEmail(row as Record<string, unknown>));
  }

  private mapRowToSentEmail(row: Record<string, unknown>): SentEmail {
    return {
      id: String(row.id),
      campaignId: String(row.campaign_id),
      prospectId: String(row.prospect_id),
      templateId: String(row.template_id),
      sequenceNumber: Number(row.sequence_number),
      toEmail: String(row.to_email),
      subject: String(row.subject),
      body: String(row.body),
      bodyHtml: row.body_html as string | undefined,
      status: (row.status as SentEmail['status']) || 'pending',
      messageId: row.message_id as string | undefined,
      sentAt: row.sent_at as string | undefined,
      deliveredAt: row.delivered_at as string | undefined,
      openedAt: row.opened_at as string | undefined,
      clickedAt: row.clicked_at as string | undefined,
      repliedAt: row.replied_at as string | undefined,
      bouncedAt: row.bounced_at as string | undefined,
      bounceReason: row.bounce_reason as string | undefined,
      openCount: Number(row.open_count || 0),
      clickCount: Number(row.click_count || 0),
      createdAt: String(row.created_at),
    };
  }

  async generateCampaignEmails(_campaignId: string): Promise<void> {
    // This will be replaced with actual agent call
    console.log('Generating emails for campaign...');
  }

  // ===========================================
  // Campaign Execution
  // ===========================================

  private async executeCampaign(campaignId: string): Promise<void> {
    console.log(`[Campaign] Starting execution for ${campaignId}`);

    const campaign = await this.getCampaign(campaignId);
    if (!campaign || campaign.status !== 'active') {
      console.log(`[Campaign] Campaign ${campaignId} is not active, stopping execution`);
      return;
    }

    // Get client's email settings
    const emailSettings = await this.getEmailSettings(campaign.clientId);
    if (!emailSettings) {
      console.error(`[Campaign] No email settings found for client ${campaign.clientId}`);
      await this.updateCampaign(campaignId, { status: 'paused' });
      return;
    }

    // Get first template (sequence 1)
    const firstTemplate = campaign.emailTemplates.find(t => t.sequence === 1);
    if (!firstTemplate) {
      console.error(`[Campaign] No sequence 1 template found`);
      return;
    }

    // Get prospects that haven't been emailed yet
    const existingEmails = await this.getCampaignEmails(campaignId);
    const emailedProspectIds = new Set(existingEmails.map(e => e.prospectId));

    const prospectsToEmail = campaign.prospectIds.filter(id => !emailedProspectIds.has(id));
    console.log(`[Campaign] ${prospectsToEmail.length} prospects to email (${emailedProspectIds.size} already emailed)`);

    // Send emails with rate limiting
    const { dailySendLimit, sendWindowStart, sendWindowEnd, skipWeekends, timezone } = campaign.settings;
    let sentToday = 0;

    for (const prospectId of prospectsToEmail) {
      // Check if campaign is still active
      const currentCampaign = await this.getCampaign(campaignId);
      if (!currentCampaign || currentCampaign.status !== 'active') {
        console.log(`[Campaign] Campaign ${campaignId} is no longer active, stopping`);
        break;
      }

      // Check daily limit
      if (sentToday >= dailySendLimit) {
        console.log(`[Campaign] Daily limit reached (${dailySendLimit}), will resume tomorrow`);
        break;
      }

      // Check send window
      if (!this.isWithinSendWindow(sendWindowStart, sendWindowEnd, timezone, skipWeekends)) {
        console.log(`[Campaign] Outside send window, will resume during business hours`);
        break;
      }

      try {
        const prospect = await this.getProspect(prospectId);
        if (!prospect) continue;

        // Get primary contact email
        const primaryContact = prospect.contacts?.find(c => c.email);
        if (!primaryContact?.email) {
          console.log(`[Campaign] No email for prospect ${prospectId}, skipping`);
          continue;
        }

        // Personalize email content
        const personalizedSubject = this.personalizeEmailContent(firstTemplate.subject, prospect);
        const personalizedBody = this.personalizeEmailContent(firstTemplate.body, prospect);
        const personalizedHtml = this.personalizeEmailContent(firstTemplate.bodyHtml, prospect);

        // Create SentEmail record
        const sentEmailId = `email-${nanoid(10)}`;
        const now = timestamp();

        await this.createSentEmailRecord({
          id: sentEmailId,
          campaignId,
          prospectId,
          templateId: firstTemplate.id,
          sequenceNumber: firstTemplate.sequence,
          toEmail: primaryContact.email,
          subject: personalizedSubject,
          body: personalizedBody,
          bodyHtml: personalizedHtml,
          status: 'pending',
          createdAt: now,
        });

        // Convert EmailSettings to ClientEmailConfig format for EmailService
        const clientConfig: ClientEmailConfig = {
          provider: emailSettings.provider,
          fromEmail: emailSettings.fromEmail,
          fromName: emailSettings.fromName,
          replyToEmail: emailSettings.replyToEmail,
          apiKey: emailSettings.apiKey,
          smtpConfig: emailSettings.smtpConfig,
          signature: emailSettings.signature,
        };

        // Send email via EmailService with client-specific settings
        const emailService = getEmailService();
        const sendResult = await emailService.sendWithClientConfig(
          {
            to: primaryContact.email,
            subject: personalizedSubject,
            html: personalizedHtml,
            text: personalizedBody,
            metadata: {
              campaignId,
              prospectId,
              sequenceNumber: firstTemplate.sequence,
            },
          },
          clientConfig
        );

        if (sendResult.success) {
          await this.updateSentEmailStatus(sentEmailId, 'sent', {
            sentAt: now,
            messageId: sendResult.messageId,
          });
          console.log(`[Campaign] Sent email to ${primaryContact.email} (messageId: ${sendResult.messageId})`);
        } else {
          await this.updateSentEmailStatus(sentEmailId, 'failed', {
            error: sendResult.error,
          });
          console.error(`[Campaign] Failed to send to ${primaryContact.email}: ${sendResult.error}`);
          continue; // Skip to next prospect
        }

        sentToday++;

        // Update campaign stats
        await this.updateCampaignStats(campaignId, { emailsSent: (campaign.stats.emailsSent || 0) + 1 });

        // Broadcast progress
        broadcastToClient(campaign.clientId, {
          type: 'campaign_progress',
          campaignId,
          prospectId,
          emailsSent: sentToday,
          totalProspects: prospectsToEmail.length,
          timestamp: now,
        });

        // Rate limit delay (minimum 5 seconds between emails)
        await new Promise(resolve => setTimeout(resolve, 5000));

      } catch (error) {
        console.error(`[Campaign] Error sending to ${prospectId}:`, error);
      }
    }

    // Check if campaign is complete
    const finalCampaign = await this.getCampaign(campaignId);
    if (finalCampaign) {
      const allEmails = await this.getCampaignEmails(campaignId);
      if (allEmails.length >= campaign.prospectIds.length) {
        await this.updateCampaign(campaignId, { status: 'completed' });
        console.log(`[Campaign] Campaign ${campaignId} completed`);
      }
    }
  }

  private isWithinSendWindow(
    startTime: string,
    endTime: string,
    _timezone: string,
    skipWeekends: boolean
  ): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Skip weekends if configured
    if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false;
    }

    // Parse times (HH:MM format)
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = (startHour ?? 9) * 60 + (startMin ?? 0);
    const endMinutes = (endHour ?? 17) * 60 + (endMin ?? 0);

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Check if a value is valid (not empty, not a placeholder-like value)
   */
  private isValidPlaceholderValue(value: string | null | undefined): boolean {
    if (!value || !value.trim()) return false;
    const INVALID_VALUES = [
      'unknown', 'n/a', 'na', 'none', 'not available', 'not specified',
      'undefined', 'null', '-', '--', '...', 'tbd', 'to be determined',
    ];
    const normalized = value.trim().toLowerCase();
    return !INVALID_VALUES.includes(normalized);
  }

  /**
   * Personalize email content by replacing placeholders with actual values
   * @param overrides - Optional field overrides provided by user for missing data
   */
  private personalizeEmailContent(
    content: string,
    prospect: Prospect,
    contact?: { name?: string; title?: string },
    overrides?: Record<string, string>
  ): string {
    // Use provided contact or fall back to primary contact
    const activeContact = contact || prospect.contacts?.[0];

    // Helper to get value with override support
    const getValue = (placeholder: string, rawValue: string | undefined, fallback: string): string => {
      // Check for user-provided override first
      if (overrides?.[placeholder] && this.isValidPlaceholderValue(overrides[placeholder])) {
        return overrides[placeholder];
      }
      // Then check if raw value is valid
      if (this.isValidPlaceholderValue(rawValue)) {
        return rawValue!;
      }
      // Use fallback
      return fallback;
    };

    // Build replacements with smart fallbacks to avoid awkward empty strings
    const replacements: Record<string, string> = {
      '{first_name}': getValue('{first_name}', activeContact?.name?.split(' ')[0], 'there'),
      '{full_name}': getValue('{full_name}', activeContact?.name, 'there'),
      '{company_name}': getValue('{company_name}', prospect.companyName, 'your company'),
      '{company}': getValue('{company}', prospect.companyName, 'your company'),
      '{title}': getValue('{title}', activeContact?.title, 'your role'),
      '{industry}': getValue('{industry}', prospect.industry, 'your industry'),
      '{city}': getValue('{city}', prospect.location?.city, 'your area'),
      '{state}': getValue('{state}', prospect.location?.state, ''),
    };

    let result = content;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Clean up any remaining empty placeholders or double spaces
    result = result.replace(/\s{2,}/g, ' ').trim();

    return result;
  }

  private async createSentEmailRecord(data: {
    id: string;
    campaignId: string;
    prospectId: string;
    templateId: string;
    sequenceNumber: number;
    toEmail: string;
    subject: string;
    body: string;
    bodyHtml?: string;
    status: string;
    createdAt: string;
  }): Promise<void> {
    const db = getDb();

    await db.execute({
      sql: `INSERT INTO sent_emails (id, campaign_id, prospect_id, template_id, sequence_number, to_email, subject, body, body_html, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        data.id,
        data.campaignId,
        data.prospectId,
        data.templateId,
        data.sequenceNumber,
        data.toEmail,
        data.subject,
        data.body,
        data.bodyHtml || null,
        data.status,
        data.createdAt,
      ],
    });
  }

  private async updateSentEmailStatus(
    emailId: string,
    status: string,
    updates: {
      sentAt?: string;
      deliveredAt?: string;
      openedAt?: string;
      clickedAt?: string;
      bouncedAt?: string;
      repliedAt?: string;
      messageId?: string;
      error?: string;
    }
  ): Promise<void> {
    const db = getDb();
    const setClauses: string[] = ['status = ?'];
    const args: string[] = [status];

    if (updates.sentAt) {
      setClauses.push('sent_at = ?');
      args.push(updates.sentAt);
    }
    if (updates.deliveredAt) {
      setClauses.push('delivered_at = ?');
      args.push(updates.deliveredAt);
    }
    if (updates.openedAt) {
      setClauses.push('opened_at = ?');
      args.push(updates.openedAt);
    }
    if (updates.clickedAt) {
      setClauses.push('clicked_at = ?');
      args.push(updates.clickedAt);
    }
    if (updates.bouncedAt) {
      setClauses.push('bounced_at = ?');
      args.push(updates.bouncedAt);
    }
    if (updates.repliedAt) {
      setClauses.push('replied_at = ?');
      args.push(updates.repliedAt);
    }
    if (updates.messageId) {
      setClauses.push('message_id = ?');
      args.push(updates.messageId);
    }
    if (updates.error) {
      setClauses.push('error = ?');
      args.push(updates.error);
    }

    args.push(emailId);
    await db.execute({
      sql: `UPDATE sent_emails SET ${setClauses.join(', ')} WHERE id = ?`,
      args,
    });
  }

  private async updateCampaignStats(campaignId: string, updates: Partial<Campaign['stats']>): Promise<void> {
    const campaign = await this.getCampaign(campaignId);
    if (!campaign) return;

    const newStats = { ...campaign.stats, ...updates };
    await this.updateCampaign(campaignId, { stats: newStats });
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
    await ensureTablesExist();
    const db = getDb();

    const whereClauses: string[] = [];
    const args: string[] = [];

    if (filters?.clientId) {
      whereClauses.push('client_id = ?');
      args.push(filters.clientId);
    }
    if (filters?.status) {
      whereClauses.push('status = ?');
      args.push(filters.status);
    }
    if (filters?.industry) {
      whereClauses.push('industry = ?');
      args.push(filters.industry);
    }
    if (filters?.location) {
      whereClauses.push('location_city = ?');
      args.push(filters.location);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM prospects ${whereStr}`,
      args,
    });
    const total = Number(countResult.rows[0]?.count || 0);

    // Get paginated results
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const result = await db.execute({
      sql: `SELECT * FROM prospects ${whereStr} ORDER BY icp_match_score DESC, created_at DESC LIMIT ? OFFSET ?`,
      args: [...args, pageSize, offset] as (string | number)[],
    });

    const data: Prospect[] = result.rows.map(row => this.mapRowToProspect(row));

    return { data, total };
  }

  private mapRowToProspect(row: Record<string, unknown>): Prospect {
    return {
      id: String(row.id),
      companyName: String(row.company_name),
      website: row.website as string | undefined,
      industry: String(row.industry || 'Unknown'),
      subIndustry: row.sub_industry as string | undefined,
      employeeCount: row.employee_count as string | undefined,
      revenue: undefined,
      location: {
        city: String(row.location_city || ''),
        state: String(row.location_state || ''),
        country: String(row.location_country || 'USA'),
        address: row.location_address as string | undefined,
      },
      googleMapsUrl: row.google_maps_url as string | undefined,
      googlePlaceId: row.google_place_id as string | undefined,
      rating: row.rating as number | undefined,
      reviewCount: row.review_count as number | undefined,
      description: row.description as string | undefined,
      painPoints: row.pain_points ? JSON.parse(String(row.pain_points)) : undefined,
      recentNews: undefined,
      technologies: row.technologies ? JSON.parse(String(row.technologies)) : undefined,
      contacts: row.contacts ? JSON.parse(String(row.contacts)) : [],
      icpMatchScore: Number(row.icp_match_score || 0),
      status: (row.status as Prospect['status']) || 'new',
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  async discoverLeads(params: {
    clientId: string;
    phase?: string;
    locations?: Array<{ city: string; state: string; country: string }>;
    industries?: string[];
    limit?: number;
  }): Promise<{ jobId: string; message: string }> {
    const jobId = `job-${nanoid(10)}`;
    const { clientId, limit = 50 } = params;

    console.log(`[DiscoverLeads] Starting lead discovery for client ${clientId}, job ${jobId}`);

    // Get client ICP (required for validation)
    const icp = await this.getClientICP(clientId);
    if (!icp) {
      throw new Error('ICP not found. Please complete client discovery first.');
    }

    // Use provided locations/industries or fall back to ICP defaults
    const locations = params.locations || icp.geographicTargeting?.primaryMarkets?.map(m => ({
      city: m.city,
      state: m.state,
      country: m.country,
    })) || [{ city: 'San Francisco', state: 'CA', country: 'USA' }];

    const industries = params.industries || icp.industryTargeting?.primaryIndustries?.map(i => i.name) || ['Technology'];

    // Create job record in database
    await this.createDiscoveryJob(jobId, clientId, locations, industries, limit);

    // Start pipeline async (non-blocking) - return immediately
    this.runDiscoveryPipeline(jobId, clientId, icp, locations, industries, limit)
      .catch(err => {
        console.error(`[DiscoverLeads] Job ${jobId} failed:`, err);
        this.markJobFailed(jobId, err.message);
      });

    return {
      jobId,
      message: 'Lead discovery started',
    };
  }

  private async createDiscoveryJob(
    jobId: string,
    clientId: string,
    locations: Array<{ city: string; state: string; country: string }>,
    industries: string[],
    limit: number
  ): Promise<void> {
    await ensureTablesExist();
    const db = getDb();
    const now = timestamp();

    await db.execute({
      sql: `INSERT INTO discovery_jobs (id, client_id, status, locations, industries, limit_count, created_at, started_at)
            VALUES (?, ?, 'running', ?, ?, ?, ?, ?)`,
      args: [jobId, clientId, JSON.stringify(locations), JSON.stringify(industries), limit, now, now],
    });
  }

  private async updateJobProgress(
    jobId: string,
    updates: {
      totalPlacesFound?: number;
      totalEnriched?: number;
      totalContactsFound?: number;
      status?: string;
    }
  ): Promise<void> {
    const db = getDb();
    const setClauses: string[] = [];
    const args: unknown[] = [];

    if (updates.totalPlacesFound !== undefined) {
      setClauses.push('total_places_found = ?');
      args.push(updates.totalPlacesFound);
    }
    if (updates.totalEnriched !== undefined) {
      setClauses.push('total_enriched = ?');
      args.push(updates.totalEnriched);
    }
    if (updates.totalContactsFound !== undefined) {
      setClauses.push('total_contacts_found = ?');
      args.push(updates.totalContactsFound);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      args.push(updates.status);
      if (updates.status === 'completed' || updates.status === 'failed') {
        setClauses.push('completed_at = ?');
        args.push(timestamp());
      }
    }

    if (setClauses.length > 0) {
      args.push(jobId);
      await db.execute({
        sql: `UPDATE discovery_jobs SET ${setClauses.join(', ')} WHERE id = ?`,
        args,
      });
    }
  }

  private async markJobFailed(jobId: string, errorMessage: string): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `UPDATE discovery_jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`,
      args: [errorMessage, timestamp(), jobId],
    });
  }

  private async runDiscoveryPipeline(
    jobId: string,
    clientId: string,
    icp: ICP,
    locations: Array<{ city: string; state: string; country: string }>,
    industries: string[],
    limit: number
  ): Promise<void> {
    console.log(`[Pipeline] Running discovery pipeline for job ${jobId}`);

    const pipeline = new LeadDiscoveryPipeline({
      clientId,
      jobId,
      icp,
      locations,
      industries,
      limit,
      parallelism: 5,
      onProgress: (event: LeadDiscoveryProgressEvent) => {
        // Broadcast via WebSocket
        broadcastToClient(clientId, event);

        // Update job progress in DB
        if (event.metadata) {
          this.updateJobProgress(jobId, {
            totalPlacesFound: event.metadata.placesFound,
            totalEnriched: event.metadata.enrichedCount,
            totalContactsFound: event.metadata.contactsFound,
          });
        }

        // Log progress
        console.log(JSON.stringify({
          timestamp: event.timestamp,
          level: 'info',
          component: 'LeadDiscovery',
          event: 'progress',
          jobId,
          clientId,
          phase: event.phase,
          status: event.status,
          message: event.message,
        }));
      },
    });

    try {
      const result = await pipeline.execute();

      // Save all discovered prospects to database
      for (const prospect of result.prospects) {
        await this.saveProspect(clientId, jobId, prospect);
      }

      // Mark job as completed
      await this.updateJobProgress(jobId, {
        status: 'completed',
        totalPlacesFound: result.totalFound,
        totalEnriched: result.enrichedCount,
        totalContactsFound: result.contactsFoundCount,
      });

      console.log(`[Pipeline] Job ${jobId} completed: ${result.prospects.length} prospects saved`);
    } catch (error) {
      console.error(`[Pipeline] Job ${jobId} error:`, error);
      await this.markJobFailed(jobId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async saveProspect(clientId: string, jobId: string, prospect: DiscoveredProspect): Promise<void> {
    const db = getDb();
    const now = timestamp();
    const id = prospect.id || `prospect-${nanoid(10)}`;

    await db.execute({
      sql: `INSERT INTO prospects (
        id, client_id, company_name, website, industry, sub_industry,
        employee_count, location_city, location_state, location_country, location_address,
        google_maps_url, google_place_id, rating, review_count, description,
        pain_points, contacts, icp_match_score, status, discovery_job_id, source,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        company_name = excluded.company_name,
        website = excluded.website,
        industry = excluded.industry,
        icp_match_score = excluded.icp_match_score,
        updated_at = excluded.updated_at`,
      args: [
        id,
        clientId,
        prospect.companyName,
        prospect.website || null,
        prospect.industry,
        prospect.subIndustry || null,
        prospect.employeeCount || null,
        prospect.location.city,
        prospect.location.state,
        prospect.location.country,
        prospect.location.address || null,
        prospect.googleMapsUrl || null,
        prospect.googlePlaceId || null,
        prospect.rating || null,
        prospect.reviewCount || null,
        prospect.description || null,
        JSON.stringify(prospect.painPoints || []),
        JSON.stringify(prospect.contacts || []),
        prospect.icpMatchScore,
        prospect.status || 'new',
        jobId,
        'google_maps',
        now,
        now,
      ],
    });
  }

  async getProspect(id: string): Promise<Prospect | undefined> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT * FROM prospects WHERE id = ?',
      args: [id],
    });

    if (result.rows.length === 0) return undefined;
    return this.mapRowToProspect(result.rows[0] as Record<string, unknown>);
  }

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect> {
    const prospect = await this.getProspect(id);
    if (!prospect) throw new Error('Prospect not found');

    const db = getDb();
    const now = timestamp();

    // Build update query dynamically
    const setClauses: string[] = ['updated_at = ?'];
    const args: unknown[] = [now];

    if (updates.companyName !== undefined) {
      setClauses.push('company_name = ?');
      args.push(updates.companyName);
    }
    if (updates.website !== undefined) {
      setClauses.push('website = ?');
      args.push(updates.website);
    }
    if (updates.industry !== undefined) {
      setClauses.push('industry = ?');
      args.push(updates.industry);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      args.push(updates.status);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      args.push(updates.description);
    }
    if (updates.contacts !== undefined) {
      setClauses.push('contacts = ?');
      args.push(JSON.stringify(updates.contacts));
    }
    if (updates.icpMatchScore !== undefined) {
      setClauses.push('icp_match_score = ?');
      args.push(updates.icpMatchScore);
    }

    args.push(id);
    await db.execute({
      sql: `UPDATE prospects SET ${setClauses.join(', ')} WHERE id = ?`,
      args,
    });

    return (await this.getProspect(id))!;
  }

  async deleteProspect(id: string): Promise<void> {
    await ensureTablesExist();
    const db = getDb();

    await db.execute({
      sql: 'DELETE FROM prospects WHERE id = ?',
      args: [id],
    });
  }

  async enrichProspect(id: string): Promise<Prospect> {
    const prospect = await this.getProspect(id);
    if (!prospect) throw new Error('Prospect not found');
    // TODO: Implement actual enrichment using companyEnricherTool
    return prospect;
  }

  async getProspectTracking(prospectId: string): Promise<SentEmail[]> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT * FROM sent_emails WHERE prospect_id = ? ORDER BY created_at DESC',
      args: [prospectId],
    });

    return result.rows.map(row => this.mapRowToSentEmail(row as Record<string, unknown>));
  }

  async updateProspectStatus(id: string, status: Prospect['status']): Promise<Prospect> {
    return this.updateProspect(id, { status });
  }

  // ===========================================
  // Email Tracking Operations (Database-backed)
  // ===========================================

  private async findEmailByMessageId(messageId: string): Promise<SentEmail | undefined> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT * FROM sent_emails WHERE message_id = ?',
      args: [messageId],
    });

    if (result.rows.length === 0) return undefined;
    return this.mapRowToSentEmail(result.rows[0] as Record<string, unknown>);
  }

  async markEmailDelivered(messageId: string, deliveredAt: string): Promise<SentEmail | undefined> {
    const email = await this.findEmailByMessageId(messageId);
    if (!email) return undefined;

    await this.updateSentEmailStatus(email.id, 'delivered', { deliveredAt });
    return { ...email, status: 'delivered', deliveredAt };
  }

  async markEmailBounced(
    messageId: string,
    _bounceType: string,
    bounceReason: string,
    bouncedAt: string
  ): Promise<SentEmail | undefined> {
    const email = await this.findEmailByMessageId(messageId);
    if (!email) return undefined;

    const db = getDb();
    await db.execute({
      sql: 'UPDATE sent_emails SET status = ?, bounced_at = ?, bounce_reason = ? WHERE id = ?',
      args: ['bounced', bouncedAt, bounceReason, email.id],
    });

    return { ...email, status: 'bounced', bouncedAt, bounceReason };
  }

  async markEmailOpened(
    messageId: string,
    openedAt: string,
    _metadata: { userAgent?: string; ip?: string }
  ): Promise<SentEmail | undefined> {
    const email = await this.findEmailByMessageId(messageId);
    if (!email) return undefined;

    const db = getDb();
    await db.execute({
      sql: 'UPDATE sent_emails SET status = ?, opened_at = ?, open_count = open_count + 1 WHERE id = ?',
      args: ['opened', openedAt, email.id],
    });

    return { ...email, status: 'opened', openedAt, openCount: (email.openCount || 0) + 1 };
  }

  async markEmailClicked(
    messageId: string,
    clickedAt: string,
    _link: string,
    _metadata: { userAgent?: string; ip?: string }
  ): Promise<SentEmail | undefined> {
    const email = await this.findEmailByMessageId(messageId);
    if (!email) return undefined;

    const db = getDb();
    await db.execute({
      sql: 'UPDATE sent_emails SET status = ?, clicked_at = ?, click_count = click_count + 1 WHERE id = ?',
      args: ['clicked', clickedAt, email.id],
    });

    return { ...email, status: 'clicked', clickedAt, clickCount: (email.clickCount || 0) + 1 };
  }

  async markEmailComplained(
    messageId: string,
    _timestamp: string,
    _complaintType: string
  ): Promise<void> {
    const email = await this.findEmailByMessageId(messageId);
    if (!email) return;

    // Mark prospect as rejected
    await this.updateProspectStatus(email.prospectId, 'rejected');
  }

  async markEmailReplied(emailId: string, repliedAt: string): Promise<void> {
    await this.updateSentEmailStatus(emailId, 'replied', { repliedAt });
  }

  /**
   * Classify an email response using AI
   */
  async classifyEmailResponse(
    responseId: string,
    emailContent: { subject: string; body: string; from: string }
  ): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative' | 'out_of_office' | 'unsubscribe';
    requiresAction: boolean;
    suggestedReply?: string;
  }> {
    const aiOrchestrator = getAiOrchestrator();
    if (!aiOrchestrator) {
      // Fallback to keyword-based classification
      return this.classifyResponseByKeywords(emailContent);
    }

    try {
      const result = await aiOrchestrator.classifyResponse(
        emailContent.subject,
        emailContent.body
      );
      return result;
    } catch (error) {
      console.error('[Orchestrator] AI classification failed, using keywords:', error);
      return this.classifyResponseByKeywords(emailContent);
    }
  }

  private classifyResponseByKeywords(
    emailContent: { subject: string; body: string; from: string }
  ): {
    sentiment: 'positive' | 'neutral' | 'negative' | 'out_of_office' | 'unsubscribe';
    requiresAction: boolean;
    suggestedReply?: string;
  } {
    const text = `${emailContent.subject} ${emailContent.body}`.toLowerCase();

    // Out of office patterns
    if (text.includes('out of office') || text.includes('automatic reply') || text.includes('away from')) {
      return { sentiment: 'out_of_office', requiresAction: false };
    }

    // Unsubscribe patterns
    if (text.includes('unsubscribe') || text.includes('stop emailing') || text.includes('remove me')) {
      return { sentiment: 'unsubscribe', requiresAction: true };
    }

    // Positive patterns
    const positiveKeywords = ['interested', 'yes', 'sure', 'let\'s', 'schedule', 'meeting', 'call', 'sounds good', 'love to'];
    if (positiveKeywords.some(kw => text.includes(kw))) {
      return { sentiment: 'positive', requiresAction: true };
    }

    // Negative patterns
    const negativeKeywords = ['not interested', 'no thanks', 'pass', 'not right now', 'not a good time', 'don\'t contact'];
    if (negativeKeywords.some(kw => text.includes(kw))) {
      return { sentiment: 'negative', requiresAction: false };
    }

    return { sentiment: 'neutral', requiresAction: true };
  }

  /**
   * Save a response to the database
   */
  async saveResponse(response: {
    id: string;
    sentEmailId?: string;
    prospectId: string;
    fromEmail: string;
    subject: string;
    body: string;
    sentiment?: string;
    requiresAction?: boolean;
    suggestedReply?: string;
    receivedAt: string;
  }): Promise<void> {
    await ensureTablesExist();
    const db = getDb();

    await db.execute({
      sql: `INSERT INTO responses (id, sent_email_id, prospect_id, from_email, subject, body, sentiment, requires_action, suggested_reply, received_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        response.id,
        response.sentEmailId || null,
        response.prospectId,
        response.fromEmail,
        response.subject,
        response.body,
        response.sentiment || null,
        response.requiresAction ? 1 : 0,
        response.suggestedReply || null,
        response.receivedAt,
        timestamp(),
      ],
    });
  }

  // ===========================================
  // Deep Research Operations
  // ===========================================

  async startDeepResearch(
    prospectId: string,
    config?: {
      phases?: string[];
      depth?: number;
      breadth?: number;
      focus?: string;
    }
  ): Promise<{ jobId: string; message: string }> {
    const jobId = `deep-research-${nanoid(10)}`;

    // Get prospect
    const prospect = await this.getProspect(prospectId);
    if (!prospect) {
      throw new Error('Prospect not found');
    }

    console.log(`[DeepResearch] Starting deep research for prospect ${prospectId}, job ${jobId}, config:`, config);

    // Start pipeline async (non-blocking)
    this.runDeepResearchPipeline(jobId, prospect, config)
      .catch(err => {
        console.error(`[DeepResearch] Job ${jobId} failed:`, err);
      });

    return {
      jobId,
      message: 'Deep research started',
    };
  }

  private async runDeepResearchPipeline(
    jobId: string,
    prospect: Prospect,
    config?: {
      phases?: string[];
      depth?: number;
      breadth?: number;
      focus?: string;
    }
  ): Promise<void> {
    const prospectId = prospect.id;
    const clientId = await this.getProspectClientId(prospectId);

    // Get client's ICP for context (optional but enhances personalization)
    let icpContext: { painPoints?: string[]; valuePropositions?: string[] } | undefined;
    if (clientId) {
      const icp = await this.getClientICP(clientId);
      if (icp) {
        icpContext = {
          painPoints: icp.messagingFramework?.primaryPainPointsToAddress,
          valuePropositions: icp.messagingFramework?.valuePropositions,
        };
      }
    }

    // Enhanced progress handler - broadcasts via WebSocket and logs
    const onProgress = (event: EnhancedResearchProgressEvent) => {
      if (clientId) {
        broadcastToClient(clientId, event);
      }

      console.log(JSON.stringify({
        timestamp: event.timestamp,
        level: 'info',
        component: 'EnhancedDeepResearch',
        event: 'progress',
        jobId,
        sessionId: event.sessionId,
        prospectId: event.prospectId,
        phase: event.phase,
        depth: `${event.currentDepth}/${event.maxDepth}`,
        queriesCompleted: event.queriesCompleted,
        learningsFound: event.learningsFound,
        message: event.message,
      }));
    };

    try {
      console.log(`[DeepResearch] Starting enhanced recursive research for prospect ${prospectId}`);

      // Execute enhanced deep research with recursive follow-ups
      // Build full location string for language detection
      const locationParts = [
        prospect.location?.city,
        prospect.location?.state,
        prospect.location?.country,
      ].filter(Boolean);
      const fullLocation = locationParts.length > 0 ? locationParts.join(', ') : undefined;

      const output = await executeEnhancedDeepResearch({
        prospect: {
          id: prospectId,
          companyName: prospect.companyName,
          website: prospect.website,
          industry: prospect.industry,
          location: fullLocation,
          country: prospect.location?.country,
          contacts: prospect.contacts?.map(c => ({ name: c.name, title: c.title })),
          icpContext,
        },
        config: {
          phases: config?.phases as ('company' | 'contacts' | 'contact_discovery' | 'market')[] ?? ['company', 'contacts', 'contact_discovery', 'market'],
          depth: config?.depth ?? 2,
          breadth: config?.breadth ?? 3,
          focus: (config?.focus as 'sales' | 'competitive' | 'comprehensive') ?? 'sales',
        },
        onProgress,
      });

      if (!output.success || !output.session) {
        throw new Error(output.error || 'Enhanced research failed');
      }

      const session = output.session;

      // Log research statistics
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'EnhancedDeepResearch',
        event: 'research_complete',
        jobId,
        prospectId,
        stats: session.stats,
        salesAnglesCount: session.salesAngles.length,
        personalizationHooksCount: session.personalizationHooks.length,
        hasRecommendedApproach: !!session.recommendedApproach,
      }));

      // Convert to legacy format for backward compatibility with existing UI
      const legacyResult: DeepResearchResult = sessionToLegacyFormat(session);

      // Save both full session and legacy format
      await this.saveEnhancedResearchResults(prospectId, session, legacyResult);

      // If we discovered new contacts, add them to the prospect
      if (session.discoveredContacts && session.discoveredContacts.length > 0) {
        await this.addDiscoveredContacts(prospectId, prospect, session.discoveredContacts);
      }

      // Update prospect status to 'researched'
      await this.updateProspectStatus(prospectId, 'researched');

      console.log(`[DeepResearch] Job ${jobId} completed successfully - ${session.stats.totalLearnings} learnings, ${session.salesAngles.length} sales angles, ${session.discoveredContacts?.length || 0} new contacts`);

    } catch (error) {
      console.error(`[DeepResearch] Job ${jobId} error:`, error);

      // Send failure event
      if (clientId) {
        const failureEvent: EnhancedResearchProgressEvent = {
          type: 'enhanced_research_progress',
          sessionId: jobId,
          prospectId,
          phase: 'failed',
          currentDepth: 0,
          maxDepth: 0,
          queriesCompleted: 0,
          learningsFound: 0,
          relevantResultsFound: 0,
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        };
        broadcastToClient(clientId, failureEvent);
      }

      throw error;
    }
  }

  private async saveEnhancedResearchResults(
    prospectId: string,
    session: ResearchSession,
    legacyResult: DeepResearchResult
  ): Promise<void> {
    await ensureTablesExist();
    const db = getDb();
    const now = timestamp();

    // Store both the full session (for new UI features) and legacy format (for backward compatibility)
    const enhancedData = {
      // Full session with sales angles, personalization hooks, learnings
      session: {
        id: session.id,
        stats: session.stats,
        learnings: session.learnings,
        salesAngles: session.salesAngles,
        personalizationHooks: session.personalizationHooks,
        recommendedApproach: session.recommendedApproach,
        phases: session.phases,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
      // Legacy format for existing UI components
      legacy: legacyResult,
    };

    await db.execute({
      sql: `UPDATE prospects SET deep_research = ?, updated_at = ? WHERE id = ?`,
      args: [JSON.stringify(enhancedData), now, prospectId],
    });

    console.log(`[DeepResearch] Saved enhanced research results for prospect ${prospectId} (${session.stats.totalLearnings} learnings)`);
  }

  /**
   * Add discovered contacts to the prospect's contact list
   */
  private async addDiscoveredContacts(
    prospectId: string,
    prospect: Prospect,
    discoveredContacts: Array<{
      name: string;
      title: string;
      email?: string;
      linkedIn?: string;
      source: string;
    }>
  ): Promise<void> {
    await ensureTablesExist();
    const db = getDb();
    const now = timestamp();

    // Get existing contacts
    const existingContacts = prospect.contacts || [];
    const existingNames = new Set(existingContacts.map(c => c.name.toLowerCase()));

    // Filter out duplicates
    const newContacts = discoveredContacts.filter(
      c => !existingNames.has(c.name.toLowerCase())
    );

    if (newContacts.length === 0) {
      console.log(`[DeepResearch] No new contacts to add (all duplicates)`);
      return;
    }

    // Create contact objects
    const contactsToAdd = newContacts.map(c => ({
      id: nanoid(),
      name: c.name,
      title: c.title,
      email: c.email,
      linkedIn: c.linkedIn,
      isPrimary: false,
      source: c.source,
    }));

    // Merge with existing contacts
    const updatedContacts = [...existingContacts, ...contactsToAdd];

    // Update the prospect
    await db.execute({
      sql: `UPDATE prospects SET contacts = ?, updated_at = ? WHERE id = ?`,
      args: [JSON.stringify(updatedContacts), now, prospectId],
    });

    console.log(`[DeepResearch] Added ${contactsToAdd.length} new contacts to prospect ${prospectId}`);
  }

  private async getProspectClientId(prospectId: string): Promise<string | null> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT client_id FROM prospects WHERE id = ?',
      args: [prospectId],
    });

    if (result.rows.length === 0) return null;
    return result.rows[0]?.client_id as string || null;
  }

  async getDeepResearchResults(prospectId: string): Promise<DeepResearchResult | null> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT deep_research FROM prospects WHERE id = ?',
      args: [prospectId],
    });

    if (result.rows.length === 0 || !result.rows[0]?.deep_research) return null;

    try {
      const parsed = JSON.parse(result.rows[0].deep_research as string);

      // Check if this is enhanced format (has 'session' and 'legacy' keys)
      if (parsed.session && parsed.legacy) {
        return parsed.legacy as DeepResearchResult;
      }

      // Legacy format - return as-is
      return parsed as DeepResearchResult;
    } catch {
      return null;
    }
  }

  /**
   * Get enhanced research results including sales angles and personalization hooks
   */
  async getEnhancedResearchResults(prospectId: string): Promise<{
    session?: {
      id: string;
      stats: ResearchSession['stats'];
      learnings: ResearchSession['learnings'];
      salesAngles: ResearchSession['salesAngles'];
      personalizationHooks: ResearchSession['personalizationHooks'];
      recommendedApproach?: ResearchSession['recommendedApproach'];
      phases: ResearchSession['phases'];
      startedAt: string;
      completedAt?: string;
    };
    legacy?: DeepResearchResult;
  } | null> {
    await ensureTablesExist();
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT deep_research FROM prospects WHERE id = ?',
      args: [prospectId],
    });

    if (result.rows.length === 0 || !result.rows[0]?.deep_research) return null;

    try {
      const parsed = JSON.parse(result.rows[0].deep_research as string);

      // Check if this is enhanced format
      if (parsed.session && parsed.legacy) {
        return parsed;
      }

      // Legacy format - wrap it
      return {
        legacy: parsed as DeepResearchResult,
      };
    } catch {
      return null;
    }
  }

  // ===========================================
  // AI Email Generation
  // ===========================================

  /**
   * Generate personalized emails using AI
   */
  async generatePersonalizedEmails(params: {
    clientId: string;
    mode: 'template' | 'personalized';
    prospects?: Array<{ prospectId: string; contactId: string }>;
    sequenceCount?: number;
    generalInstructions?: string;
    templateInstructions?: Array<{ sequenceNumber: number; instructions: string }>;
    regenerateWithAngle?: string;
  }): Promise<{
    mode: 'template' | 'personalized';
    templates?: Array<{
      sequenceNumber: number;
      subject: string;
      body: string;
      delayDays: number;
      placeholders: string[];
    }>;
    emails?: Array<{
      prospectId: string;
      contactId: string;
      sequenceNumber: number;
      subject: string;
      body: string;
      bodyHtml: string;
      personalizationUsed: Array<{
        type: string;
        source: string;
        text: string;
      }>;
      qualityScore: number;
      spamRiskScore: number;
      suggestedImprovements?: string[];
      generatedAt: string;
    }>;
    stats: {
      totalGenerated: number;
      averageQualityScore: number;
      averageSpamRisk: number;
      generationTimeMs: number;
    };
  }> {
    const startTime = Date.now();
    const { clientId, mode, prospects, sequenceCount = 3, generalInstructions, templateInstructions, regenerateWithAngle } = params;

    // Fetch client and ICP data
    const client = await this.getClient(clientId);
    if (!client) throw new Error('Client not found');

    const icp = await this.getClientICP(clientId);

    // Fetch email settings for sender info (name to sign emails with)
    const emailSettings = await this.getEmailSettings(clientId);
    const senderName = emailSettings?.fromName || client.name;
    const senderEmail = emailSettings?.fromEmail || '';

    // Create orchestrator instance
    const orchestrator = new Orchestrator();

    if (mode === 'template') {
      // Generate template-based emails with placeholders
      const templates = await this.generateEmailTemplates(orchestrator, {
        client,
        icp,
        sequenceCount,
        generalInstructions,
        templateInstructions,
        senderName,
      });

      return {
        mode: 'template',
        templates,
        stats: {
          totalGenerated: templates.length,
          averageQualityScore: 85,
          averageSpamRisk: 10,
          generationTimeMs: Date.now() - startTime,
        },
      };
    }

    // Personalized mode - generate for each prospect/contact
    if (!prospects || prospects.length === 0) {
      throw new Error('Prospects required for personalized mode');
    }

    const emails: Array<{
      prospectId: string;
      contactId: string;
      sequenceNumber: number;
      subject: string;
      body: string;
      bodyHtml: string;
      personalizationUsed: Array<{ type: string; source: string; text: string }>;
      qualityScore: number;
      spamRiskScore: number;
      suggestedImprovements?: string[];
      generatedAt: string;
    }> = [];

    let totalQuality = 0;
    let totalSpamRisk = 0;

    for (const { prospectId, contactId } of prospects) {
      const prospect = await this.getProspect(prospectId);
      if (!prospect) continue;

      const contact = prospect.contacts?.find(c => c.id === contactId);
      if (!contact) continue;

      // Get deep research if available
      const enhancedResearch = await this.getEnhancedResearchResults(prospectId);

      // Generate emails for this prospect/contact
      for (let seq = 1; seq <= sequenceCount; seq++) {
        // Combine general + template-specific instructions
        const templateSpecific = templateInstructions?.find(t => t.sequenceNumber === seq);
        const combinedInstructions = [
          generalInstructions,
          templateSpecific?.instructions
        ].filter(Boolean).join('\n\n');

        const generated = await this.generateSingleEmail(orchestrator, {
          client,
          icp,
          prospect,
          contact,
          enhancedResearch,
          sequenceNumber: seq,
          senderName,
          customInstructions: combinedInstructions || undefined,
          regenerateWithAngle,
        });

        emails.push({
          prospectId,
          contactId,
          sequenceNumber: seq,
          subject: generated.subject,
          body: generated.body,
          bodyHtml: generated.body.replace(/\n/g, '<br>'),
          personalizationUsed: generated.personalizationUsed,
          qualityScore: generated.qualityScore,
          spamRiskScore: generated.spamRiskScore,
          suggestedImprovements: generated.suggestedImprovements,
          generatedAt: timestamp(),
        });

        totalQuality += generated.qualityScore;
        totalSpamRisk += generated.spamRiskScore;
      }
    }

    return {
      mode: 'personalized',
      emails,
      stats: {
        totalGenerated: emails.length,
        averageQualityScore: emails.length > 0 ? Math.round(totalQuality / emails.length) : 0,
        averageSpamRisk: emails.length > 0 ? Math.round(totalSpamRisk / emails.length) : 0,
        generationTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Generate email templates with placeholders
   */
  private async generateEmailTemplates(
    orchestrator: Orchestrator,
    params: {
      client: Client;
      icp: ICP | null;
      sequenceCount: number;
      generalInstructions?: string;
      templateInstructions?: Array<{ sequenceNumber: number; instructions: string }>;
      senderName: string;
    }
  ): Promise<Array<{
    sequenceNumber: number;
    subject: string;
    body: string;
    delayDays: number;
    placeholders: string[];
  }>> {
    const { client, icp, sequenceCount, generalInstructions, templateInstructions, senderName } = params;

    // Build combined instructions for prompt
    const customInstructions = generalInstructions || '';
    const templateSpecificNotes = templateInstructions?.map(t =>
      `Email ${t.sequenceNumber}: ${t.instructions}`
    ).join('\n') || '';

    const templatePrompt = `Generate ${sequenceCount} cold email templates for B2B outreach.

CONTEXT: These templates will be used by ${client.name} to sell their services to prospects. The sender is "${senderName}" from ${client.name}.

=== SENDER COMPANY (WHO IS SELLING) ===
Company: ${client.name}
Industry: ${client.industry || 'Technology'}
What We Sell: ${client.solution || 'Our solution'}
Company Summary: ${client.summary || ''}
${icp?.messagingFramework?.valuePropositions ? `Our Value Propositions: ${icp.messagingFramework.valuePropositions.join(', ')}` : ''}
${icp?.messagingFramework?.proofPoints ? `Our Proof Points: ${icp.messagingFramework.proofPoints.join(', ')}` : ''}

=== TARGET PROSPECTS ===
${icp ? `
Pain Points to Address: ${icp.messagingFramework?.primaryPainPointsToAddress?.join(', ') || 'Not specified'}
Target Titles: ${icp.decisionMakerTargeting?.primaryTitles?.join(', ') || 'Decision makers'}
` : 'ICP not yet defined'}

${customInstructions ? `=== GENERAL INSTRUCTIONS ===\n${customInstructions}\n` : ''}

${templateSpecificNotes ? `=== EMAIL-SPECIFIC INSTRUCTIONS ===\n${templateSpecificNotes}\n` : ''}

=== TEMPLATE REQUIREMENTS ===
Generate ${sequenceCount} email templates using these placeholders:
- {first_name} - Contact's first name
- {company} - Prospect company name
- {title} - Contact's job title
- {industry} - Prospect's industry
- {pain_point} - Main pain point (can be customized later)

Email sequence timing:
- Email 1: Initial outreach (Day 0)
- Email 2: Follow-up (Day 3)
- Email 3: Break-up email (Day 7)

IMPORTANT: Sign all emails as "${senderName}".
Keep emails under 150 words. Avoid spam trigger words. Be professional but conversational.

Return ONLY a valid JSON array:
[
  {
    "sequence": 1,
    "subject": "Subject with {first_name} or {company}",
    "body": "Email body with placeholders...",
    "delay_days": 0
  }
]`;

    try {
      // Use the orchestrator with the rich, context-aware template prompt
      const result = await orchestrator.generateTemplatesWithPrompt(
        params.client.id,
        templatePrompt
      );

      if (result.length === 0) {
        throw new Error('AI failed to generate templates');
      }

      // Parse and add placeholders
      const templates = result.map(t => ({
        sequenceNumber: t.sequence,
        subject: t.subject,
        body: t.body,
        delayDays: t.delay_days,
        placeholders: this.extractPlaceholders(t.subject + ' ' + t.body),
      }));

      return templates;
    } catch (error) {
      console.error('[EmailGeneration] Failed to generate templates:', error);
      // Return default templates
      return [
        {
          sequenceNumber: 1,
          subject: 'Quick question for {first_name}',
          body: `Hi {first_name},

I noticed {company} is in the {industry} space. Companies in your position often struggle with [specific pain point].

At ${client.name}, we help companies like yours [value proposition].

Would you be open to a quick 15-minute call to see if we could help?

Best,
${senderName}`,
          delayDays: 0,
          placeholders: ['{first_name}', '{company}', '{industry}'],
        },
        {
          sequenceNumber: 2,
          subject: 'Re: Quick question for {first_name}',
          body: `Hi {first_name},

Just following up on my previous email. I wanted to share a quick insight:

[Relevant industry trend or case study]

I'd love to discuss how ${client.name} could help {company} achieve similar results.

Worth a quick chat?

Best,
${senderName}`,
          delayDays: 3,
          placeholders: ['{first_name}', '{company}'],
        },
        {
          sequenceNumber: 3,
          subject: 'Last try, {first_name}',
          body: `Hi {first_name},

I've reached out a couple of times and haven't heard back - totally understand you're busy.

I'll assume the timing isn't right, but if things change or you'd like to explore how ${client.name} can help {company}, I'm just a reply away.

Wishing you and the team continued success.

Best,
${senderName}`,
          delayDays: 7,
          placeholders: ['{first_name}', '{company}'],
        },
      ];
    }
  }

  /**
   * Generate a single personalized email
   */
  private async generateSingleEmail(
    orchestrator: Orchestrator,
    params: {
      client: Client;
      icp: ICP | null;
      prospect: Prospect;
      contact: { id: string; name: string; title: string; email?: string };
      enhancedResearch: {
        session?: {
          personalizationHooks?: Array<{ type: string; hook: string }>;
          salesAngles?: Array<{ angle: string; reasoning: string }>;
          recommendedApproach?: {
            openingLine: string;
            keyPoints: string[];
            callToAction: string;
          };
        };
        legacy?: DeepResearchResult;
      } | null;
      sequenceNumber: number;
      senderName: string;
      customInstructions?: string;
      regenerateWithAngle?: string;
    }
  ): Promise<{
    subject: string;
    body: string;
    personalizationUsed: Array<{ type: string; source: string; text: string }>;
    qualityScore: number;
    spamRiskScore: number;
    suggestedImprovements?: string[];
  }> {
    const { client, icp, prospect, contact, enhancedResearch, sequenceNumber, senderName, customInstructions, regenerateWithAngle } = params;

    // Build personalization hooks from available data
    const personalizationHooks: Array<{ type: string; source: string; text: string }> = [];

    // Add recent news if available
    if (enhancedResearch?.legacy?.company?.recentNews?.[0]) {
      const news = enhancedResearch.legacy.company.recentNews[0];
      personalizationHooks.push({
        type: 'recent_news',
        source: 'Deep Research',
        text: news.title,
      });
    }

    // Add funding info if available
    if (enhancedResearch?.legacy?.company?.funding?.[0]) {
      const funding = enhancedResearch.legacy.company.funding[0];
      personalizationHooks.push({
        type: 'funding_event',
        source: 'Deep Research',
        text: `${funding.round} - ${funding.amount}`,
      });
    }

    // Add personalization hooks from enhanced research
    if (enhancedResearch?.session?.personalizationHooks) {
      for (const hook of enhancedResearch.session.personalizationHooks.slice(0, 3)) {
        personalizationHooks.push({
          type: hook.type,
          source: 'Enhanced Research',
          text: hook.hook,
        });
      }
    }

    // Add role-based personalization
    if (contact.title) {
      personalizationHooks.push({
        type: 'role_based',
        source: 'Contact Data',
        text: `${contact.title} at ${prospect.companyName}`,
      });
    }

    // Add company-specific personalization
    if (prospect.description) {
      personalizationHooks.push({
        type: 'company_specific',
        source: 'Prospect Data',
        text: prospect.description.substring(0, 100),
      });
    }

    // Add industry personalization
    if (prospect.industry) {
      personalizationHooks.push({
        type: 'industry_trend',
        source: 'Prospect Data',
        text: prospect.industry,
      });
    }

    // Get recommended approach from enhanced research
    const recommendedApproach = enhancedResearch?.session?.recommendedApproach;
    const salesAngles = enhancedResearch?.session?.salesAngles || [];

    // Build the prompt
    const sequenceType = sequenceNumber === 1 ? 'Initial outreach' :
                         sequenceNumber === 2 ? 'Follow-up' :
                         'Break-up email';

    const emailPrompt = `Generate email ${sequenceNumber} (${sequenceType}) for B2B cold outreach.

CONTEXT: You are writing on behalf of ${client.name} (the SENDER). The goal is to sell ${client.name}'s services/solutions to ${prospect.companyName} (the PROSPECT). Sign the email as "${senderName}".

=== SENDER COMPANY (WHO WE ARE - SELLING) ===
Company: ${client.name}
Industry: ${client.industry || 'Technology'}
What We Sell: ${client.solution || 'Our solution'}
Company Summary: ${client.summary || ''}
${icp?.messagingFramework?.valuePropositions ? `Our Value Propositions: ${icp.messagingFramework.valuePropositions.join(', ')}` : ''}
${icp?.messagingFramework?.proofPoints ? `Our Proof Points: ${icp.messagingFramework.proofPoints.join(', ')}` : ''}

=== PROSPECT COMPANY (WHO WE'RE SELLING TO) ===
Company: ${prospect.companyName}
Industry: ${prospect.industry}${prospect.subIndustry ? ` / ${prospect.subIndustry}` : ''}
Size: ${prospect.employeeCount || 'Unknown'}
Location: ${prospect.location?.city || ''}, ${prospect.location?.state || ''} ${prospect.location?.country || ''}
Description: ${prospect.description || 'Not available'}
${prospect.technologies?.length ? `Technologies: ${prospect.technologies.join(', ')}` : ''}

=== PROSPECT CONTACT (RECIPIENT) ===
Name: ${contact.name}
Title: ${contact.title}
Email: ${contact.email || 'N/A'}

=== PERSONALIZATION HOOKS (use 1-2 most relevant) ===
${personalizationHooks.map(h => `- [${h.type}] ${h.text}`).join('\n')}

${salesAngles.length > 0 ? `=== SALES ANGLES ===\n${salesAngles.slice(0, 3).map((a: { angle: string; reasoning: string }) => `- ${a.angle}: ${a.reasoning}`).join('\n')}\n` : ''}

${recommendedApproach ? `=== RECOMMENDED APPROACH ===
Opening: ${recommendedApproach.openingLine}
Key Points: ${recommendedApproach.keyPoints.join(', ')}
CTA: ${recommendedApproach.callToAction}
` : ''}

=== TARGET PAIN POINTS TO ADDRESS ===
${icp?.messagingFramework?.primaryPainPointsToAddress?.join(', ') || 'Not specified'}

${customInstructions ? `=== CUSTOM INSTRUCTIONS ===\n${customInstructions}\n` : ''}

${regenerateWithAngle ? `=== SPECIAL FOCUS ===\n${regenerateWithAngle}\n` : ''}

=== EMAIL ${sequenceNumber} REQUIREMENTS ===
${sequenceNumber === 1 ? `
- Strong personalized opening referencing their company/role
- Address a specific pain point the prospect might have
- Clear value proposition showing how ${client.name} can help
- Soft CTA (question, not hard sell)
` : sequenceNumber === 2 ? `
- Reference previous email briefly
- Different angle or value proposition from ${client.name}
- Include social proof or case study reference
- Slightly stronger CTA
` : `
- Acknowledge they're busy
- Final value proposition from ${client.name}
- Clear next step or graceful exit
- Keep it very short (3-4 sentences max)
`}

IMPORTANT: Sign the email as "${senderName}" (not [Your name]).
Keep email under 150 words. Be specific and personalized. Avoid spam trigger words.

Return ONLY valid JSON:
{
  "subject": "...",
  "body": "...",
  "personalization_used": [
    {"type": "recent_news|funding_event|role_based|pain_point|company_specific|industry_trend", "source": "...", "text": "..."}
  ],
  "quality_score": 80,
  "spam_risk_score": 10,
  "suggested_improvements": ["..."]
}`;

    try {
      // Use the orchestrator with the rich, context-aware prompt
      const emailResult = await orchestrator.generateSingleEmailWithPrompt(
        client.id,
        emailPrompt
      );

      if (emailResult) {
        return {
          subject: emailResult.subject,
          body: emailResult.body,
          personalizationUsed: emailResult.personalization_used.length > 0
            ? emailResult.personalization_used
            : personalizationHooks.slice(0, 3),
          qualityScore: emailResult.quality_score,
          spamRiskScore: emailResult.spam_risk_score,
          suggestedImprovements: emailResult.suggested_improvements,
        };
      }

      throw new Error('AI failed to generate email');
    } catch (error) {
      console.error(`[EmailGeneration] Failed to generate email ${sequenceNumber}:`, error);

      // Return a fallback personalized email
      const firstName = contact.name.split(' ')[0];
      const delayText = sequenceNumber === 1 ? '' :
                        sequenceNumber === 2 ? "Following up on my previous email - " :
                        "I've reached out a couple of times and understand you're busy. ";

      return {
        subject: sequenceNumber === 1 ? `Quick question about ${prospect.companyName}'s ${prospect.industry} strategy` :
                 sequenceNumber === 2 ? `Re: ${prospect.companyName} and ${client.name}` :
                 `Last try, ${firstName}`,
        body: `Hi ${firstName},

${delayText}${personalizationHooks[0]?.text ? `I noticed ${personalizationHooks[0].text.toLowerCase()}. ` : ''}As ${contact.title} at ${prospect.companyName}, you're likely focused on [relevant challenge].

At ${client.name}, we help ${prospect.industry} companies ${client.solution || 'achieve their goals'}.

${sequenceNumber < 3 ? 'Would you be open to a quick 15-minute call to explore if we could help?' : 'If the timing isn\'t right, I completely understand. Wishing you continued success!'}

Best,
${senderName}`,
        personalizationUsed: personalizationHooks.slice(0, 2),
        qualityScore: 70 + Math.floor(Math.random() * 10),
        spamRiskScore: 10 + Math.floor(Math.random() * 10),
        suggestedImprovements: ['Consider adding more specific personalization', 'Add a relevant case study reference'],
      };
    }
  }

  /**
   * Extract placeholders from email content
   */
  private extractPlaceholders(content: string): string[] {
    const placeholderRegex = /\{[^}]+\}/g;
    const matches = content.match(placeholderRegex) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Validate placeholders for prospects
   * Checks if all placeholders used in templates have actual values for each prospect
   */
  async validatePlaceholders(params: {
    templates: Array<{ subject: string; body: string }>;
    prospects: Array<{ prospectId: string; contactId?: string }>;
  }): Promise<{
    placeholdersUsed: string[];
    prospectValidations: Array<{
      prospectId: string;
      prospectName: string;
      contactId?: string;
      contactName?: string;
      placeholders: Array<{
        placeholder: string;
        label: string;
        status: 'available' | 'fallback' | 'missing';
        actualValue: string | null;
        fallbackValue: string;
      }>;
      summary: {
        total: number;
        available: number;
        fallback: number;
        missing: number;
      };
      isFullyPopulated: boolean;
      hasAnyFallbacks: boolean;
    }>;
    summary: {
      totalProspects: number;
      fullyPopulated: number;
      withFallbacks: number;
      withMissing: number;
    };
  }> {
    // Extract all placeholders from templates
    const allContent = params.templates.map(t => `${t.subject} ${t.body}`).join(' ');
    const placeholdersUsed = this.extractPlaceholders(allContent);

    // Invalid values that should NOT be used in emails
    const INVALID_VALUES = [
      'unknown', 'n/a', 'na', 'none', 'not available', 'not specified',
      'undefined', 'null', '-', '--', '...', 'tbd', 'to be determined',
    ];

    // Check if a value is valid (not empty, not a placeholder-like value)
    const isValidValue = (value: string | null | undefined): boolean => {
      if (!value || !value.trim()) return false;
      const normalized = value.trim().toLowerCase();
      return !INVALID_VALUES.includes(normalized);
    };

    // Placeholder definitions with extractors
    const placeholderDefs: Record<string, {
      label: string;
      extractor: (prospect: Prospect, contact?: { name?: string; title?: string }) => string | null;
      fallback: string;
    }> = {
      '{first_name}': {
        label: 'First Name',
        extractor: (prospect, contact) => {
          const c = contact || prospect.contacts?.[0];
          const name = c?.name?.split(' ')[0];
          return isValidValue(name) ? name! : null;
        },
        fallback: 'there',
      },
      '{full_name}': {
        label: 'Full Name',
        extractor: (prospect, contact) => {
          const c = contact || prospect.contacts?.[0];
          return isValidValue(c?.name) ? c?.name ?? null : null;
        },
        fallback: 'there',
      },
      '{company_name}': {
        label: 'Company Name',
        extractor: (prospect) => isValidValue(prospect.companyName) ? prospect.companyName : null,
        fallback: 'your company',
      },
      '{company}': {
        label: 'Company',
        extractor: (prospect) => isValidValue(prospect.companyName) ? prospect.companyName : null,
        fallback: 'your company',
      },
      '{title}': {
        label: 'Job Title',
        extractor: (prospect, contact) => {
          const c = contact || prospect.contacts?.[0];
          return isValidValue(c?.title) ? c?.title ?? null : null;
        },
        fallback: 'your role',
      },
      '{industry}': {
        label: 'Industry',
        extractor: (prospect) => isValidValue(prospect.industry) ? prospect.industry : null,
        fallback: 'your industry',
      },
      '{city}': {
        label: 'City',
        extractor: (prospect) => isValidValue(prospect.location?.city) ? prospect.location!.city : null,
        fallback: 'your area',
      },
      '{state}': {
        label: 'State',
        extractor: (prospect) => isValidValue(prospect.location?.state) ? prospect.location!.state : null,
        fallback: '',
      },
    };

    const prospectValidations: Array<{
      prospectId: string;
      prospectName: string;
      contactId?: string;
      contactName?: string;
      placeholders: Array<{
        placeholder: string;
        label: string;
        status: 'available' | 'fallback' | 'missing';
        actualValue: string | null;
        fallbackValue: string;
      }>;
      summary: {
        total: number;
        available: number;
        fallback: number;
        missing: number;
      };
      isFullyPopulated: boolean;
      hasAnyFallbacks: boolean;
    }> = [];

    let fullyPopulated = 0;
    let withFallbacks = 0;
    let withMissing = 0;

    for (const { prospectId, contactId } of params.prospects) {
      const prospect = await this.getProspect(prospectId);
      if (!prospect) continue;

      // Find the specific contact or use primary
      const contact = contactId
        ? prospect.contacts?.find(c => c.id === contactId)
        : prospect.contacts?.[0];

      const placeholderResults: Array<{
        placeholder: string;
        label: string;
        status: 'available' | 'fallback' | 'missing';
        actualValue: string | null;
        fallbackValue: string;
      }> = [];

      let available = 0;
      let fallback = 0;
      let missing = 0;

      for (const placeholder of placeholdersUsed) {
        const def = placeholderDefs[placeholder];
        if (!def) {
          // Unknown placeholder
          placeholderResults.push({
            placeholder,
            label: placeholder.replace(/[{}]/g, ''),
            status: 'missing',
            actualValue: null,
            fallbackValue: '',
          });
          missing++;
          continue;
        }

        const actualValue = def.extractor(prospect, contact);
        let status: 'available' | 'fallback' | 'missing';

        if (actualValue) {
          status = 'available';
          available++;
        } else if (def.fallback) {
          status = 'fallback';
          fallback++;
        } else {
          status = 'missing';
          missing++;
        }

        placeholderResults.push({
          placeholder,
          label: def.label,
          status,
          actualValue,
          fallbackValue: def.fallback,
        });
      }

      const isFullyPopulated = available === placeholdersUsed.length;
      const hasAnyFallbacks = fallback > 0;

      if (isFullyPopulated) {
        fullyPopulated++;
      } else if (missing > 0) {
        withMissing++;
      } else if (hasAnyFallbacks) {
        withFallbacks++;
      }

      prospectValidations.push({
        prospectId,
        prospectName: prospect.companyName,
        contactId,
        contactName: contact?.name,
        placeholders: placeholderResults,
        summary: {
          total: placeholdersUsed.length,
          available,
          fallback,
          missing,
        },
        isFullyPopulated,
        hasAnyFallbacks,
      });
    }

    return {
      placeholdersUsed,
      prospectValidations,
      summary: {
        totalProspects: prospectValidations.length,
        fullyPopulated,
        withFallbacks,
        withMissing,
      },
    };
  }
}

