/**
 * Orchestrator - Main agent coordinator using Vercel AI SDK with DeepSeek
 * Migrated from Claude Agent SDK to Vercel AI SDK for DeepSeek V3.2 support
 */

import { generateText, stepCountIs } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';

/**
 * Helper to extract JSON from AI response text
 * DeepSeek doesn't support structured outputs, so we parse manually
 */
function extractJSON<T>(text: string): T | null {
  try {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Normalize field names from AI response to match expected schema
 * AI may use different naming conventions (camelCase vs snake_case, slight variations)
 */
function normalizeBusinessProfile(data: Record<string, unknown>): Record<string, unknown> {
  return {
    company_name: data.company_name || data.companyName,
    website: data.website,
    industry: data.industry,
    sub_industry: data.sub_industry || data.subIndustry,
    value_proposition: data.value_proposition || data.valueProposition,
    products_services: data.products_services || data.productsServices ||
                       data.products_services_offered || data.productsServicesOffered || [],
    target_market: data.target_market || data.targetMarket,
    key_differentiators: data.key_differentiators || data.keyDifferentiators || [],
    estimated_size: data.estimated_size || data.estimatedSize ||
                    data.estimated_company_size || data.estimatedCompanySize || 'Unknown',
    company_stage: data.company_stage || data.companyStage || 'Unknown',
    headquarters: data.headquarters || data.headquarters_location || data.headquartersLocation,
    summary: data.summary || data.brief_summary || data.briefSummary || '',
  };
}

/**
 * Normalize ICP data from AI response to match expected schema
 */
function normalizeICP(data: Record<string, unknown>): Record<string, unknown> {
  const firmographic = (data.firmographic_criteria || data.firmographicCriteria || {}) as Record<string, unknown>;
  const companySize = (firmographic.company_size || firmographic.companySize || {}) as Record<string, unknown>;
  const geo = (data.geographic_targeting || data.geographicTargeting || {}) as Record<string, unknown>;
  const industry = (data.industry_targeting || data.industryTargeting || {}) as Record<string, unknown>;
  const decision = (data.decision_maker_targeting || data.decisionMakerTargeting || {}) as Record<string, unknown>;
  const messaging = (data.messaging_framework || data.messagingFramework || {}) as Record<string, unknown>;

  // Normalize markets - handle both flat structure and region-based structure
  const normalizeMarkets = (markets: unknown[]): Array<{ city: string; state: string; country: string; priority?: string }> => {
    if (!Array.isArray(markets)) return [];
    return markets.map((m: unknown) => {
      const market = m as Record<string, unknown>;
      // Handle region-based structure (what AI returns)
      if (market.region && !market.city) {
        const areas = (market.specific_areas || market.specificAreas || []) as string[];
        const firstArea = areas[0] || market.region;
        return {
          city: String(firstArea).split(',')[0] || String(market.region),
          state: '',
          country: String(market.region),
          priority: String(market.priority || 'medium').toLowerCase(),
        };
      }
      // Handle flat structure (what schema expects)
      return {
        city: String(market.city || ''),
        state: String(market.state || ''),
        country: String(market.country || 'USA'),
        priority: String(market.priority || 'medium').toLowerCase(),
      };
    });
  };

  // Normalize industries - handle both name-based and industry-based keys
  const normalizeIndustries = (industries: unknown[]): Array<{ name: string; sub_segments: string[]; priority?: string }> => {
    if (!Array.isArray(industries)) return [];
    return industries.map((i: unknown) => {
      const ind = i as Record<string, unknown>;
      return {
        name: String(ind.name || ind.industry || ''),
        sub_segments: (ind.sub_segments || ind.subSegments || ind.sub_segments || []) as string[],
        priority: String(ind.priority || 'medium').toLowerCase(),
      };
    });
  };

  // Handle employee_ranges - could be array or single string
  let employeeRanges = companySize.employee_ranges || companySize.employeeRanges || companySize.employee_range;
  if (typeof employeeRanges === 'string') {
    employeeRanges = [employeeRanges];
  }

  // Handle revenue_ranges - could be array or single string
  let revenueRanges = companySize.revenue_ranges || companySize.revenueRanges || companySize.revenue_range;
  if (typeof revenueRanges === 'string') {
    revenueRanges = [revenueRanges];
  }

  // Handle company_stage - could be array or single string
  let companyStage = firmographic.company_stage || firmographic.companyStage || firmographic.stage;
  if (typeof companyStage === 'string') {
    companyStage = [companyStage];
  }

  // Handle funding_status - could be array or single string
  let fundingStatus = firmographic.funding_status || firmographic.fundingStatus;
  if (typeof fundingStatus === 'string') {
    fundingStatus = [fundingStatus];
  }

  return {
    icp_summary: data.icp_summary || data.icpSummary || '',
    solution_description: data.solution_description || data.solutionDescription || '',
    firmographic_criteria: {
      company_size: {
        employee_ranges: employeeRanges || ['50-200', '200-500'],
        revenue_ranges: revenueRanges || ['$5M-$20M', '$20M-$100M'],
      },
      company_stage: companyStage || ['growth'],
      funding_status: fundingStatus,
    },
    geographic_targeting: {
      primary_markets: normalizeMarkets((geo.primary_markets || geo.primaryMarkets || []) as unknown[]),
      expansion_markets: normalizeMarkets((geo.expansion_markets || geo.expansionMarkets || []) as unknown[]),
    },
    industry_targeting: {
      primary_industries: normalizeIndustries((industry.primary_industries || industry.primaryIndustries || []) as unknown[]),
      secondary_industries: normalizeIndustries((industry.secondary_industries || industry.secondaryIndustries || []) as unknown[]),
    },
    decision_maker_targeting: {
      primary_titles: decision.primary_titles || decision.primaryTitles || decision.job_titles || decision.jobTitles || [],
      secondary_titles: decision.secondary_titles || decision.secondaryTitles,
      departments: decision.departments || [],
    },
    messaging_framework: {
      primary_pain_points_to_address: messaging.primary_pain_points_to_address ||
                                       messaging.primaryPainPointsToAddress ||
                                       messaging.pain_points ||
                                       messaging.painPoints || [],
      value_propositions: messaging.value_propositions || messaging.valuePropositions || [],
      proof_points: messaging.proof_points || messaging.proofPoints || [],
      objection_handlers: typeof messaging.objection_handlers === 'object' && !Array.isArray(messaging.objection_handlers)
        ? messaging.objection_handlers
        : undefined,
    },
  };
}
import path from 'path';
import { fileURLToPath } from 'url';

import { AgentFSManager } from './storage/agentfs-manager.js';
import {
  websiteAnalyzerTool,
  marketResearcherTool,
  googleMapsScraperTool,
  prospectParserTool,
  companyEnricherTool,
  contactFinderTool,
  dataValidatorTool,
  emailQualityCheckerTool,
  classifyResponse as classifyResponseUtil,
  bounceDetectorTool,
  engagementScorerTool,
  rateLimiterTool,
} from './tools/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===========================================
// DeepSeek Model Configuration
// ===========================================

// Create the DeepSeek provider once
const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// Get the DeepSeek chat model (V3.2)
function getDeepSeekModel() {
  return deepseek('deepseek-chat');
}

// ===========================================
// Zod Schemas for Structured Outputs
// ===========================================

const BusinessProfileSchema = z.object({
  company_name: z.string(),
  website: z.string(),
  industry: z.string(),
  sub_industry: z.string().optional(),
  value_proposition: z.string(),
  products_services: z.array(z.string()),
  target_market: z.string(),
  key_differentiators: z.array(z.string()),
  estimated_size: z.string(),
  company_stage: z.string(),
  headquarters: z.string().optional(),
  summary: z.string(),
});

const MarketSchema = z.object({
  city: z.string(),
  state: z.string(),
  country: z.string(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

const IndustrySchema = z.object({
  name: z.string(),
  sub_segments: z.array(z.string()),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

const ICPSchema = z.object({
  icp_summary: z.string(),
  firmographic_criteria: z.object({
    company_size: z.object({
      employee_ranges: z.array(z.string()),
      revenue_ranges: z.array(z.string()),
    }),
    company_stage: z.array(z.string()),
    funding_status: z.array(z.string()).optional(),
  }),
  geographic_targeting: z.object({
    primary_markets: z.array(MarketSchema),
    expansion_markets: z.array(MarketSchema).optional(),
  }),
  industry_targeting: z.object({
    primary_industries: z.array(IndustrySchema),
    secondary_industries: z.array(IndustrySchema).optional(),
  }),
  decision_maker_targeting: z.object({
    primary_titles: z.array(z.string()),
    secondary_titles: z.array(z.string()).optional(),
    departments: z.array(z.string()),
  }),
  messaging_framework: z.object({
    primary_pain_points_to_address: z.array(z.string()),
    value_propositions: z.array(z.string()),
    proof_points: z.array(z.string()),
    objection_handlers: z.record(z.string()).optional(),
  }),
});

const ResponseClassificationSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'out_of_office', 'unsubscribe']),
  requires_action: z.boolean(),
  summary: z.string(),
  suggested_reply: z.string().optional(),
});

// Export types
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
export type ICP = z.infer<typeof ICPSchema>;
export type ResponseClassification = z.infer<typeof ResponseClassificationSchema>;

// Progress callback type for discovery operations
export type ProgressCallback = (
  phase: string,
  status: string,
  message?: string
) => void;

// ===========================================
// Logging Utility
// ===========================================

const LOG_PREFIX = '[Orchestrator]';

function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}]`;

  if (data !== undefined) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `${prefix} ${message}`,
      typeof data === 'object' ? JSON.stringify(data, null, 2) : data
    );
  } else {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`${prefix} ${message}`);
  }
}

// Structured JSON logging for machine-parseable output
interface StructuredLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  event: string;
  clientId?: string;
  phase?: string;
  status?: string;
  durationMs?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

function structuredLog(entry: StructuredLogEntry): void {
  console.log(JSON.stringify(entry));
}

// ===========================================
// Orchestrator Configuration
// ===========================================

export interface OrchestratorConfig {
  projectRoot?: string;
  tursoUrl?: string;
  tursoToken?: string;
}

// ===========================================
// Main Orchestrator Class
// ===========================================

/**
 * Main orchestrator that coordinates all agent activities using Vercel AI SDK with DeepSeek.
 * Tools are defined in packages/agent/src/tools/ and executed by the AI model.
 * Uses generateObject for guaranteed structured JSON responses.
 */
export class Orchestrator {
  private projectRoot: string;
  private storageManagers: Map<string, AgentFSManager> = new Map();
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = config;
    // Default to the monorepo root (3 levels up from this file)
    this.projectRoot = config.projectRoot || path.resolve(__dirname, '..', '..', '..', '..');
    log('info', `Initialized with projectRoot: ${this.projectRoot}`);
  }

  /**
   * Get or create storage manager for a client
   */
  async getStorage(clientId: string): Promise<AgentFSManager> {
    if (!this.storageManagers.has(clientId)) {
      log('debug', `Creating storage manager for client: ${clientId}`);
      const manager = new AgentFSManager({
        url: this.config.tursoUrl || process.env.TURSO_DATABASE_URL || 'file:local.db',
        authToken: this.config.tursoToken || process.env.TURSO_AUTH_TOKEN,
      });
      await manager.initialize(clientId);
      this.storageManagers.set(clientId, manager);
    }
    return this.storageManagers.get(clientId)!;
  }

  /**
   * Run a simple prompt and get text response
   */
  async runPrompt(
    prompt: string,
    options: {
      systemPrompt?: string;
      maxOutputTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
    const model = getDeepSeekModel();

    const { text } = await generateText({
      model,
      system: options.systemPrompt,
      prompt,
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature,
    });

    return text;
  }

  /**
   * Run a conversation with the AI (multi-turn)
   */
  async runConversation(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: {
      systemPrompt?: string;
      maxOutputTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
    const model = getDeepSeekModel();

    const { text } = await generateText({
      model,
      system: options.systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature,
    });

    return text;
  }

  /**
   * Analyze a website and generate business profile
   */
  async analyzeWebsite(
    clientId: string,
    websiteUrl: string,
    additionalPrompt?: string
  ): Promise<BusinessProfile | { raw: string }> {
    // No-op: progress handled by backend via WebSocket
    const onProgress = (_phase: string, _status: string, _message?: string) => {};
    const phaseStartTime = Date.now();
    log('info', `Starting website analysis for client ${clientId}`, { websiteUrl });

    // Emit progress: started
    onProgress?.('analyzing_website', 'started', 'Crawling and analyzing website content');
    structuredLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'Orchestrator',
      event: 'discovery_progress',
      clientId,
      phase: 'analyzing_website',
      status: 'started',
      message: `Analyzing website: ${websiteUrl}`,
    });

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;
    const model = getDeepSeekModel();

    try {
      // Step 1: Analyze website using tool
      onProgress?.('analyzing_website', 'in_progress', 'Crawling website with Firecrawl');

      const { text: websiteAnalysis } = await generateText({
        model,
        tools: {
          analyzeWebsite: websiteAnalyzerTool,
          researchMarket: marketResearcherTool,
        },
        stopWhen: stepCountIs(5),
        onStepFinish: ({ toolCalls }) => {
          if (toolCalls && toolCalls.length > 0 && toolCalls[0]) {
            const toolName = toolCalls[0].toolName;
            log('info', `Tool completed: ${toolName}`);
            onProgress?.('analyzing_website', 'in_progress', `Completed: ${toolName}`);
          }
        },
        prompt: `Analyze the website at ${websiteUrl} for a B2B cold outreach system.

1. Use the analyzeWebsite tool to crawl and analyze the website
2. Use the researchMarket tool to gather competitive intelligence about the company

After gathering the data, provide a comprehensive analysis of the business.${additionalPrompt ? `

ADDITIONAL GUIDANCE FROM USER:
${additionalPrompt}` : ''}`,
      });

      // Step 2: Generate structured business profile using generateText (DeepSeek doesn't support generateObject)
      onProgress?.('analyzing_website', 'in_progress', 'Generating business profile');

      const { text: profileText } = await generateText({
        model,
        prompt: `Based on this website analysis, generate a structured business profile as JSON.

${websiteAnalysis}
${additionalPrompt ? `
ADDITIONAL GUIDANCE FROM USER:
${additionalPrompt}
` : ''}
Return ONLY a valid JSON object with these exact fields:
{
  "company_name": "string",
  "website": "string",
  "industry": "string",
  "sub_industry": "string (optional)",
  "value_proposition": "string",
  "products_services": ["array", "of", "strings"],
  "target_market": "string",
  "key_differentiators": ["array", "of", "strings"],
  "estimated_size": "string (e.g. 'Small', '50-100 employees')",
  "company_stage": "string (startup, growth, or enterprise)",
  "headquarters": "string (optional)",
  "summary": "string - brief 2-3 sentence summary"
}

Return ONLY the JSON, no markdown, no explanation.`,
      });

      // Parse and normalize the JSON response
      const rawProfile = extractJSON<Record<string, unknown>>(profileText);
      if (!rawProfile) {
        throw new Error('Failed to parse business profile from AI response');
      }
      const businessProfile = normalizeBusinessProfile(rawProfile) as BusinessProfile;

      const endTime = Date.now() / 1000;
      const durationMs = Date.now() - phaseStartTime;

      // Record the tool call
      await storage.recordToolCall(
        'analyze_website',
        startTime,
        endTime,
        { websiteUrl },
        businessProfile
      );

      log('info', 'Website analysis completed successfully', { company: businessProfile.company_name });
      onProgress?.('analyzing_website', 'completed', 'Website analysis complete');
      structuredLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'Orchestrator',
        event: 'discovery_progress',
        clientId,
        phase: 'analyzing_website',
        status: 'completed',
        durationMs,
        message: 'Website analysis completed successfully',
      });

      return businessProfile;
    } catch (error) {
      log('error', 'Website analysis failed', error);
      onProgress?.('analyzing_website', 'failed', 'Website analysis failed');
      return { raw: String(error) };
    }
  }

  /**
   * Generate ICP from business profile
   */
  async generateICP(
    clientId: string,
    businessProfile: unknown,
    additionalPrompt?: string
  ): Promise<ICP | { raw: string }> {
    // No-op: progress handled by backend via WebSocket
    const onProgress = (_phase: string, _status: string, _message?: string) => {};
    const phaseStartTime = Date.now();
    log('info', `Generating ICP for client ${clientId}`);

    // Emit progress: started
    onProgress?.('generating_icp', 'started', 'Creating ideal customer profile');
    structuredLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      component: 'Orchestrator',
      event: 'discovery_progress',
      clientId,
      phase: 'generating_icp',
      status: 'started',
      message: 'Starting ICP generation',
    });

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;
    const model = getDeepSeekModel();

    try {
      // Generate ICP using generateText (DeepSeek doesn't support generateObject)
      onProgress?.('generating_icp', 'in_progress', 'Analyzing business profile');

      const { text: icpText } = await generateText({
        model,
        prompt: `Generate a comprehensive Ideal Customer Profile (ICP) based on this business profile:

${JSON.stringify(businessProfile, null, 2)}
${additionalPrompt ? `
ADDITIONAL GUIDANCE FROM USER:
${additionalPrompt}
` : ''}
Create an ICP that includes:
1. ICP Summary - brief overview of ideal customer
2. Firmographic Criteria - company size (employee/revenue ranges), stage, funding status
3. Geographic Targeting - primary and expansion markets with priorities
4. Industry Targeting - primary and secondary industries with sub-segments
5. Decision Maker Targeting - job titles, departments to target
6. Messaging Framework - pain points, value propositions, proof points, objection handlers

Focus on B2B cold outreach use cases. Be specific and actionable.

Return ONLY a valid JSON object with this structure:
{
  "icp_summary": "string - brief overview of ideal customer",
  "solution_description": "string - description of what the company offers and how it solves problems for customers",
  "firmographic_criteria": {
    "company_size": {
      "employee_ranges": ["50-200", "200-500"],
      "revenue_ranges": ["$5M-$20M", "$20M-$100M"]
    },
    "company_stage": ["growth", "enterprise"],
    "funding_status": ["Series A", "Series B"]
  },
  "geographic_targeting": {
    "primary_markets": [{ "city": "string", "state": "string", "country": "string", "priority": "high" }],
    "expansion_markets": [{ "city": "string", "state": "string", "country": "string", "priority": "medium" }]
  },
  "industry_targeting": {
    "primary_industries": [{ "name": "string", "sub_segments": ["string"], "priority": "high" }],
    "secondary_industries": [{ "name": "string", "sub_segments": ["string"], "priority": "medium" }]
  },
  "decision_maker_targeting": {
    "primary_titles": ["VP of Sales", "Head of Marketing"],
    "secondary_titles": ["Director of Operations"],
    "departments": ["Sales", "Marketing"]
  },
  "messaging_framework": {
    "primary_pain_points_to_address": ["pain point 1", "pain point 2"],
    "value_propositions": ["value prop 1"],
    "proof_points": ["case study 1"],
    "objection_handlers": { "objection": "response" }
  }
}

Return ONLY the JSON, no markdown, no explanation.`,
      });

      // Parse and normalize the JSON response
      const rawICP = extractJSON<Record<string, unknown>>(icpText);
      if (!rawICP) {
        throw new Error('Failed to parse ICP from AI response');
      }
      const icp = normalizeICP(rawICP) as ICP;

      // Validate ICP
      onProgress?.('validating', 'started', 'Validating ICP data');
      structuredLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'Orchestrator',
        event: 'discovery_progress',
        clientId,
        phase: 'validating',
        status: 'started',
        message: 'Starting ICP validation',
      });

      const endTime = Date.now() / 1000;
      const durationMs = Date.now() - phaseStartTime;

      await storage.recordToolCall(
        'generate_icp',
        startTime,
        endTime,
        { businessProfile },
        icp
      );

      log('info', 'ICP generation completed successfully');
      await storage.saveICP(icp);

      onProgress?.('validating', 'completed', 'ICP validation complete');
      structuredLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'Orchestrator',
        event: 'discovery_progress',
        clientId,
        phase: 'validating',
        status: 'completed',
        message: 'ICP validation completed',
      });

      onProgress?.('generating_icp', 'completed', 'ICP generated successfully');
      structuredLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        component: 'Orchestrator',
        event: 'discovery_progress',
        clientId,
        phase: 'generating_icp',
        status: 'completed',
        durationMs,
        message: 'ICP generation completed successfully',
      });

      return icp;
    } catch (error) {
      log('error', 'ICP generation failed', error);
      onProgress?.('generating_icp', 'failed', 'ICP generation failed');
      return { raw: String(error) };
    }
  }

  /**
   * Discover leads using Google Maps and enrichment tools
   */
  async discoverLeads(
    clientId: string,
    icp: unknown,
    options: {
      location: string;
      industry: string;
      limit?: number;
    }
  ): Promise<unknown[]> {
    log('info', `Discovering leads for client ${clientId}`, options);

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;
    const model = getDeepSeekModel();

    try {
      // Use tools for lead discovery pipeline
      const { text, toolResults } = await generateText({
        model,
        tools: {
          searchGoogleMaps: googleMapsScraperTool,
          parseProspects: prospectParserTool,
          enrichCompanies: companyEnricherTool,
          findContacts: contactFinderTool,
          validateData: dataValidatorTool,
        },
        stopWhen: stepCountIs(10),
        prompt: `Find and enrich B2B leads matching this ICP:

Location: ${options.location}
Industry: ${options.industry}
Limit: ${options.limit || 50}

ICP:
${JSON.stringify(icp, null, 2)}

Steps:
1. Use searchGoogleMaps to find businesses in ${options.location} matching ${options.industry}
2. Use parseProspects to structure the results
3. Use enrichCompanies to add website content and company research
4. Use findContacts to discover decision maker contacts
5. Use validateData to score prospects against the ICP

Return the validated prospect list.`,
      });

      const endTime = Date.now() / 1000;

      // Extract prospects from tool results
      let prospects: unknown[] = [];

      if (toolResults && toolResults.length > 0) {
        for (const result of toolResults) {
          if (result && typeof result === 'object' && 'output' in result) {
            const output = result.output as Record<string, unknown>;
            if (Array.isArray(output.prospects)) {
              prospects = output.prospects;
            } else if (Array.isArray(output.valid_prospects)) {
              prospects = output.valid_prospects;
            }
          }
        }
      }

      // Also try to parse from text if no tool results
      if (prospects.length === 0 && text) {
        try {
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            prospects = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // Ignore parse errors
        }
      }

      await storage.recordToolCall(
        'discover_leads',
        startTime,
        endTime,
        { icp, options },
        prospects
      );

      if (prospects.length > 0) {
        log('info', `Found ${prospects.length} leads`);
        await storage.saveProspects(options.location, options.industry, prospects);
        return prospects;
      }

      log('warn', 'Lead discovery did not return prospects');
      return [];
    } catch (error) {
      log('error', 'Lead discovery failed', error);
      return [];
    }
  }

  /**
   * Generate personalized email sequence
   */
  async generateEmailSequence(
    clientId: string,
    prospect: unknown,
    icp: unknown,
    senderName?: string
  ): Promise<unknown[]> {
    log('info', `Generating email sequence for client ${clientId}`);

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;
    const model = getDeepSeekModel();

    // Get client profile to use in email generation
    const clientProfile = await storage.getClientProfile<{
      companyName?: string;
      industry?: string;
      solution?: string;
      summary?: string;
      website?: string;
    }>();

    // Build client context for the prompt
    const clientContext = clientProfile ? `
=== SENDER COMPANY (WHO IS SELLING) ===
Company: ${clientProfile.companyName || 'Unknown'}
Industry: ${clientProfile.industry || 'Technology'}
What We Sell: ${clientProfile.solution || 'Our solution'}
Company Summary: ${clientProfile.summary || ''}
Website: ${clientProfile.website || ''}
` : '';

    try {
      // Generate email sequence using generateText (DeepSeek doesn't support generateObject)
      const { text: emailsText } = await generateText({
        model,
        prompt: `Generate a 3-email cold outreach sequence.

CONTEXT: You are writing emails on behalf of the SENDER company to sell their services to the PROSPECT company.${senderName ? ` Sign all emails as "${senderName}".` : ''}
${clientContext}

=== PROSPECT COMPANY (WHO WE'RE SELLING TO) ===
${JSON.stringify(prospect, null, 2)}

=== ICP & MESSAGING FRAMEWORK ===
${JSON.stringify(icp, null, 2)}

Requirements:
1. Email 1: Initial outreach (send immediately)
   - Personalized subject line
   - Reference specific prospect company details
   - Clear value proposition showing how the sender can help
   - Soft CTA (question, not hard sell)

2. Email 2: Follow-up (3 days later)
   - Different angle/value proposition from the sender
   - Social proof or case study reference
   - Slightly stronger CTA

3. Email 3: Break-up email (7 days later)
   - Acknowledge they're busy
   - Final value proposition from the sender
   - Clear next step or graceful exit

Keep emails under 150 words. Avoid spam trigger words. Be specific and personalized.${senderName ? ` Sign all emails as "${senderName}".` : ''}

Return ONLY a valid JSON array with this structure:
[
  {
    "sequence": 1,
    "subject": "email subject line",
    "body": "email body text",
    "delay_days": 0,
    "personalization_points": ["point 1", "point 2"]
  },
  {
    "sequence": 2,
    "subject": "follow-up subject",
    "body": "follow-up body",
    "delay_days": 3,
    "personalization_points": ["point 1"]
  },
  {
    "sequence": 3,
    "subject": "break-up subject",
    "body": "break-up body",
    "delay_days": 7,
    "personalization_points": ["point 1"]
  }
]

Return ONLY the JSON array, no markdown, no explanation.`,
      });

      // Parse the JSON response
      const jsonMatch = emailsText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse email sequence from AI response');
      }
      const emails = JSON.parse(jsonMatch[0]) as Array<{
        sequence: number;
        subject: string;
        body: string;
        delay_days: number;
        personalization_points?: string[];
      }>;

      const endTime = Date.now() / 1000;

      await storage.recordToolCall(
        'generate_email_sequence',
        startTime,
        endTime,
        { prospect, icp },
        emails
      );

      // Check quality of each email (optional validation)
      for (const email of emails) {
        try {
          await generateText({
            model,
            tools: { checkQuality: emailQualityCheckerTool },
            prompt: `Check the quality of this email:
Subject: ${email.subject}
Body: ${email.body}`,
          });
        } catch {
          // Ignore quality check errors
        }
      }

      log('info', `Generated ${emails.length} emails with quality checks`);
      return emails;
    } catch (error) {
      log('error', 'Email sequence generation failed', error);
      return [];
    }
  }

  /**
   * Generate a single email using a custom prompt
   * This allows the backend to pass in a rich, context-aware prompt
   */
  async generateSingleEmailWithPrompt(
    clientId: string,
    prompt: string
  ): Promise<{
    subject: string;
    body: string;
    personalization_used: Array<{ type: string; source: string; text: string }>;
    quality_score: number;
    spam_risk_score: number;
    suggested_improvements: string[];
  } | null> {
    log('info', `Generating single email for client ${clientId}`);

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;
    const model = getDeepSeekModel();

    try {
      const { text: emailText } = await generateText({
        model,
        prompt,
      });

      // Parse the JSON response
      const jsonMatch = emailText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse email from AI response');
      }

      const email = JSON.parse(jsonMatch[0]) as {
        subject: string;
        body: string;
        personalization_used?: Array<{ type: string; source: string; text: string }>;
        quality_score?: number;
        spam_risk_score?: number;
        suggested_improvements?: string[];
      };

      const endTime = Date.now() / 1000;

      await storage.recordToolCall(
        'generate_single_email',
        startTime,
        endTime,
        { promptLength: prompt.length },
        email
      );

      log('info', 'Single email generated successfully');

      return {
        subject: email.subject,
        body: email.body,
        personalization_used: email.personalization_used || [],
        quality_score: email.quality_score || 80,
        spam_risk_score: email.spam_risk_score || 10,
        suggested_improvements: email.suggested_improvements || [],
      };
    } catch (error) {
      log('error', 'Single email generation failed', error);
      return null;
    }
  }

  /**
   * Generate email templates using a custom prompt
   * This allows the backend to pass in a rich, context-aware prompt for template mode
   */
  async generateTemplatesWithPrompt(
    clientId: string,
    prompt: string
  ): Promise<Array<{
    sequence: number;
    subject: string;
    body: string;
    delay_days: number;
  }>> {
    log('info', `Generating email templates for client ${clientId}`);

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;
    const model = getDeepSeekModel();

    try {
      const { text: templatesText } = await generateText({
        model,
        prompt,
      });

      // Parse the JSON array response
      const jsonMatch = templatesText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Failed to parse templates from AI response');
      }

      const templates = JSON.parse(jsonMatch[0]) as Array<{
        sequence: number;
        subject: string;
        body: string;
        delay_days: number;
      }>;

      const endTime = Date.now() / 1000;

      await storage.recordToolCall(
        'generate_email_templates',
        startTime,
        endTime,
        { promptLength: prompt.length },
        templates
      );

      log('info', `Generated ${templates.length} email templates`);
      return templates;
    } catch (error) {
      log('error', 'Template generation failed', error);
      return [];
    }
  }

  /**
   * Classify email response sentiment
   */
  async classifyResponse(
    responseText: string,
    originalEmail: string
  ): Promise<ResponseClassification> {
    log('info', 'Classifying email response');

    try {
      // Use the utility function from response-classifier tool
      const classification = await classifyResponseUtil(
        'Re: ' + originalEmail.substring(0, 50),
        responseText,
        originalEmail
      );

      log('info', 'Response classification successful', { sentiment: classification.sentiment });

      return {
        sentiment: classification.sentiment,
        requires_action: classification.requiresAction,
        summary: classification.summary,
        suggested_reply: classification.suggestedReply,
      };
    } catch (error) {
      log('warn', 'Response classification failed, using fallback', error);

      // Fallback using generateText (DeepSeek doesn't support generateObject)
      const model = getDeepSeekModel();

      try {
        const { text: classificationText } = await generateText({
          model,
          prompt: `Classify this email response:

Original Email:
${originalEmail}

Response:
${responseText}

Determine:
- Sentiment (positive, neutral, negative, out_of_office, unsubscribe)
- Whether action is required
- Brief summary
- Suggested reply if action needed

Return ONLY a valid JSON object with this structure:
{
  "sentiment": "positive" | "neutral" | "negative" | "out_of_office" | "unsubscribe",
  "requires_action": true | false,
  "summary": "brief summary of the response",
  "suggested_reply": "optional suggested reply text"
}

Return ONLY the JSON, no markdown, no explanation.`,
        });

        const parsed = extractJSON<{
          sentiment: string;
          requires_action: boolean;
          summary: string;
          suggested_reply?: string;
        }>(classificationText);

        if (parsed) {
          return {
            sentiment: (parsed.sentiment as ResponseClassification['sentiment']) || 'neutral',
            requires_action: parsed.requires_action ?? true,
            summary: parsed.summary || 'Unable to classify response',
            suggested_reply: parsed.suggested_reply,
          };
        }

        return {
          sentiment: 'neutral',
          requires_action: true,
          summary: 'Unable to classify response',
        };
      } catch {
        return {
          sentiment: 'neutral',
          requires_action: true,
          summary: 'Unable to classify response',
        };
      }
    }
  }

  /**
   * Score a prospect against ICP
   */
  async scoreProspect(prospect: unknown, icp: unknown): Promise<number> {
    log('debug', 'Scoring prospect against ICP');

    const model = getDeepSeekModel();

    const { text } = await generateText({
      model,
      prompt: `Score this prospect against the ICP on a scale of 0 to 1.

Prospect:
${JSON.stringify(prospect, null, 2)}

ICP:
${JSON.stringify(icp, null, 2)}

Consider: company size, industry, location, and decision maker fit.
Return ONLY a number between 0 and 1 (e.g., 0.85). No other text.`,
    });

    const score = parseFloat(text.trim());
    const finalScore = isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));

    log('debug', `Prospect score: ${finalScore}`);
    return finalScore;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<unknown> {
    log('info', `Getting analytics for campaign ${campaignId}`);

    const model = getDeepSeekModel();

    try {
      const { text } = await generateText({
        model,
        tools: {
          getRateLimitStatus: rateLimiterTool,
          getEngagementScore: engagementScorerTool,
        },
        prompt: `Generate analytics summary for campaign ${campaignId}.

Use the available tools to get rate limit status and engagement metrics.
Return a comprehensive analytics report.`,
      });

      // Parse the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return { summary: text };
        }
      }

      return { summary: text };
    } catch (error) {
      log('error', 'Campaign analytics failed', error);
      return { error: String(error) };
    }
  }

  /**
   * Process bounce event
   */
  async processBounce(event: {
    campaignId: string;
    prospectId: string;
    emailId: string;
    bounceType: 'hard' | 'soft';
    reason: string;
  }): Promise<{
    isHardBounce: boolean;
    shouldRetry: boolean;
    actions: string[];
  }> {
    log('info', `Processing bounce for prospect ${event.prospectId}`);

    const model = getDeepSeekModel();

    const { text } = await generateText({
      model,
      tools: { analyzeBounce: bounceDetectorTool },
      prompt: `Analyze this email bounce:
Bounce type: ${event.bounceType}
Reason: ${event.reason}
Campaign: ${event.campaignId}
Prospect: ${event.prospectId}`,
    });

    // Extract structured result
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return {
          isHardBounce: result.analysis?.isHardBounce ?? event.bounceType === 'hard',
          shouldRetry: result.analysis?.shouldRetry ?? event.bounceType !== 'hard',
          actions: result.analysis?.actions ?? [],
        };
      } catch {
        // Fall through to default
      }
    }

    return {
      isHardBounce: event.bounceType === 'hard',
      shouldRetry: event.bounceType !== 'hard',
      actions: event.bounceType === 'hard' ? ['remove_from_campaign'] : ['schedule_retry'],
    };
  }

  /**
   * Check rate limit status
   */
  async checkRateLimit(accountId: string = 'default'): Promise<{
    canSend: boolean;
    waitTimeMs: number;
    remainingDaily: number;
  }> {
    const model = getDeepSeekModel();

    const { text } = await generateText({
      model,
      tools: { checkRateLimit: rateLimiterTool },
      prompt: `Check rate limit status for account ${accountId}`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return {
          canSend: result.canSend ?? true,
          waitTimeMs: result.waitTimeMs ?? 0,
          remainingDaily: result.remainingDaily ?? 200,
        };
      } catch {
        // Fall through
      }
    }

    return { canSend: true, waitTimeMs: 0, remainingDaily: 200 };
  }

  /**
   * Clean up and close connections
   */
  async shutdown(): Promise<void> {
    log('info', 'Shutting down orchestrator');
    for (const manager of this.storageManagers.values()) {
      manager.close();
    }
    this.storageManagers.clear();
  }
}
