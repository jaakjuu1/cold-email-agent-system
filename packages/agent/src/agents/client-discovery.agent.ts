import { Orchestrator } from '../orchestrator.js';
import { AgentFSManager } from '../storage/agentfs-manager.js';
import type { DiscoveryResult, BusinessProfile, ICPResult } from '../types/index.js';

/**
 * Client Discovery Agent
 * Responsible for analyzing client websites and generating ICPs
 */
export class ClientDiscoveryAgent {
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
   * Run full client discovery process
   */
  async discover(websiteUrl: string): Promise<DiscoveryResult> {
    if (!this.storage) {
      await this.initialize();
    }

    // Step 1: Analyze website
    console.log(`[ClientDiscovery] Analyzing website: ${websiteUrl}`);
    const businessProfile = await this.analyzeWebsite(websiteUrl);

    // Step 2: Generate ICP
    console.log('[ClientDiscovery] Generating ICP...');
    const icp = await this.generateICP(businessProfile);

    // Step 3: Save results
    await this.storage!.saveClientProfile(businessProfile);
    await this.storage!.saveICP(icp);

    return {
      businessProfile,
      icp,
    };
  }

  /**
   * Analyze a website and extract business profile
   */
  private async analyzeWebsite(websiteUrl: string): Promise<BusinessProfile> {
    const result = await this.orchestrator.analyzeWebsite(this.clientId, websiteUrl);
    
    // Transform to BusinessProfile type
    const data = result as Record<string, unknown>;
    
    return {
      companyName: String(data.company_name || ''),
      website: String(data.website || websiteUrl),
      industry: String(data.industry || ''),
      subIndustry: data.sub_industry ? String(data.sub_industry) : undefined,
      valueProposition: String(data.value_proposition || ''),
      productsServices: Array.isArray(data.products_services) 
        ? data.products_services.map(String) 
        : [],
      targetMarket: String(data.target_market || ''),
      keyDifferentiators: Array.isArray(data.key_differentiators)
        ? data.key_differentiators.map(String)
        : [],
      estimatedSize: String(data.estimated_size || ''),
      companyStage: String(data.company_stage || ''),
      headquarters: data.headquarters ? String(data.headquarters) : undefined,
      summary: String(data.summary || ''),
    };
  }

  /**
   * Generate ICP from business profile
   */
  private async generateICP(businessProfile: BusinessProfile): Promise<ICPResult> {
    const result = await this.orchestrator.generateICP(this.clientId, businessProfile);
    
    const data = result as Record<string, unknown>;
    
    // Parse the nested structure
    const firmographic = data.firmographic_criteria as Record<string, unknown> || {};
    const companySize = firmographic.company_size as Record<string, unknown> || {};
    
    const geographic = data.geographic_targeting as Record<string, unknown> || {};
    const industry = data.industry_targeting as Record<string, unknown> || {};
    const decisionMaker = data.decision_maker_targeting as Record<string, unknown> || {};
    const messaging = data.messaging_framework as Record<string, unknown> || {};
    
    return {
      icpSummary: String(data.icp_summary || ''),
      firmographicCriteria: {
        companySize: {
          employeeRanges: Array.isArray(companySize.employee_ranges)
            ? companySize.employee_ranges.map(String)
            : [],
          revenueRanges: Array.isArray(companySize.revenue_ranges)
            ? companySize.revenue_ranges.map(String)
            : [],
        },
        companyStage: Array.isArray(firmographic.company_stage)
          ? firmographic.company_stage.map(String)
          : [],
        fundingStatus: Array.isArray(firmographic.funding_status)
          ? firmographic.funding_status.map(String)
          : undefined,
      },
      geographicTargeting: {
        primaryMarkets: Array.isArray(geographic.primary_markets)
          ? geographic.primary_markets.map((m: unknown) => {
              const market = m as Record<string, unknown>;
              return {
                city: String(market.city || ''),
                state: String(market.state || ''),
                country: String(market.country || ''),
                priority: (market.priority as 'high' | 'medium' | 'low') || 'medium',
              };
            })
          : [],
        expansionMarkets: Array.isArray(geographic.expansion_markets)
          ? geographic.expansion_markets.map((m: unknown) => {
              const market = m as Record<string, unknown>;
              return {
                city: String(market.city || ''),
                state: String(market.state || ''),
                country: String(market.country || ''),
              };
            })
          : undefined,
      },
      industryTargeting: {
        primaryIndustries: Array.isArray(industry.primary_industries)
          ? industry.primary_industries.map((i: unknown) => {
              const ind = i as Record<string, unknown>;
              return {
                name: String(ind.name || ''),
                subSegments: Array.isArray(ind.sub_segments)
                  ? ind.sub_segments.map(String)
                  : [],
                priority: (ind.priority as 'high' | 'medium' | 'low') || 'medium',
              };
            })
          : [],
        secondaryIndustries: Array.isArray(industry.secondary_industries)
          ? industry.secondary_industries.map((i: unknown) => {
              const ind = i as Record<string, unknown>;
              return {
                name: String(ind.name || ''),
                subSegments: Array.isArray(ind.sub_segments)
                  ? ind.sub_segments.map(String)
                  : [],
              };
            })
          : undefined,
      },
      decisionMakerTargeting: {
        primaryTitles: Array.isArray(decisionMaker.primary_titles)
          ? decisionMaker.primary_titles.map(String)
          : [],
        secondaryTitles: Array.isArray(decisionMaker.secondary_titles)
          ? decisionMaker.secondary_titles.map(String)
          : [],
        departments: Array.isArray(decisionMaker.departments)
          ? decisionMaker.departments.map(String)
          : [],
      },
      messagingFramework: {
        primaryPainPointsToAddress: Array.isArray(messaging.primary_pain_points_to_address)
          ? messaging.primary_pain_points_to_address.map(String)
          : [],
        valuePropositions: Array.isArray(messaging.value_propositions)
          ? messaging.value_propositions.map(String)
          : [],
        proofPoints: Array.isArray(messaging.proof_points)
          ? messaging.proof_points.map(String)
          : [],
        objectionHandlers: typeof messaging.objection_handlers === 'object' && messaging.objection_handlers
          ? messaging.objection_handlers as Record<string, string>
          : undefined,
      },
    };
  }

  /**
   * Refine existing ICP with user feedback
   */
  async refineICP(feedback: string): Promise<ICPResult> {
    if (!this.storage) {
      await this.initialize();
    }

    const existingICP = await this.storage!.getICP<ICPResult>();
    if (!existingICP) {
      throw new Error('No existing ICP found. Run discovery first.');
    }

    const systemPrompt = `You are an expert at refining Ideal Customer Profiles based on user feedback.`;
    
    const prompt = `Refine this ICP based on the user's feedback:

Current ICP:
${JSON.stringify(existingICP, null, 2)}

User Feedback:
${feedback}

Return the refined ICP in the same JSON format.`;

    const result = await this.orchestrator.runPrompt(prompt, { systemPrompt });
    
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const refinedICP = JSON.parse(jsonMatch[0]) as ICPResult;
        await this.storage!.saveICP(refinedICP);
        return refinedICP;
      }
    } catch {
      // Return existing if parsing fails
    }

    return existingICP;
  }
}

