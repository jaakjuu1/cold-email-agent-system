import { Orchestrator } from '../orchestrator.js';
import { AgentFSManager } from '../storage/agentfs-manager.js';
import { nanoid } from 'nanoid';
import type {
  LeadDiscoveryParams,
  LeadDiscoveryResult,
  ProspectData,
  ICPResult,
} from '../types/index.js';

/**
 * Lead Discovery Agent
 * Responsible for finding and enriching prospects based on ICP
 */
export class LeadDiscoveryAgent {
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
   * Discover leads based on ICP
   */
  async discover(params: LeadDiscoveryParams): Promise<LeadDiscoveryResult> {
    if (!this.storage) {
      await this.initialize();
    }

    const { icp, locations, industries, limit = 100 } = params;
    const allProspects: ProspectData[] = [];
    const locationBreakdown: Record<string, number> = {};
    const industryBreakdown: Record<string, number> = {};

    // Iterate through location/industry combinations
    for (const location of locations) {
      const locationKey = `${location.city}, ${location.state}`;
      locationBreakdown[locationKey] = 0;

      for (const industry of industries) {
        if (allProspects.length >= limit) break;

        console.log(`[LeadDiscovery] Searching: ${industry} in ${locationKey}`);

        // Generate mock prospects (in production, this would call Google Maps API)
        const prospects = await this.searchProspects(location, industry, icp);
        
        for (const prospect of prospects) {
          if (allProspects.length >= limit) break;

          // Score against ICP
          const score = await this.orchestrator.scoreProspect(prospect, icp);
          prospect.icpMatchScore = score;

          // Only include prospects with decent match
          if (score >= 0.5) {
            allProspects.push(prospect);
            locationBreakdown[locationKey] = (locationBreakdown[locationKey] || 0) + 1;
            industryBreakdown[industry] = (industryBreakdown[industry] || 0) + 1;
          }
        }

        // Save prospects for this location/industry
        await this.storage!.saveProspects(
          locationKey.replace(', ', '-'),
          industry.replace(/\s+/g, '-').toLowerCase(),
          prospects.filter(p => p.icpMatchScore >= 0.5)
        );
      }
    }

    return {
      prospects: allProspects,
      totalFound: allProspects.length,
      locationBreakdown,
      industryBreakdown,
    };
  }

  /**
   * Search for prospects in a specific location and industry
   * In production, this would integrate with Google Maps Places API
   */
  private async searchProspects(
    location: { city: string; state: string; country: string },
    industry: string,
    _icp: ICPResult
  ): Promise<ProspectData[]> {
    // Mock implementation - in production, call Google Maps API
    const mockProspects: ProspectData[] = [];
    const numProspects = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < numProspects; i++) {
      mockProspects.push({
        id: `prospect-${nanoid(10)}`,
        companyName: `${industry} Company ${i + 1}`,
        website: `https://company${i + 1}.example.com`,
        industry,
        location: {
          city: location.city,
          state: location.state,
          country: location.country,
          address: `${Math.floor(Math.random() * 1000) + 100} Main St`,
        },
        employeeCount: ['10-50', '50-100', '100-250'][Math.floor(Math.random() * 3)],
        rating: Math.round((Math.random() * 2 + 3) * 10) / 10,
        reviewCount: Math.floor(Math.random() * 100) + 10,
        contacts: [
          {
            id: `contact-${nanoid(8)}`,
            name: 'John Smith',
            title: ['CEO', 'CTO', 'VP Engineering', 'Director'][Math.floor(Math.random() * 4)]!,
            email: `john@company${i + 1}.example.com`,
            isPrimary: true,
          },
        ],
        icpMatchScore: 0, // Will be calculated
      });
    }

    return mockProspects;
  }

  /**
   * Enrich a single prospect with additional data
   */
  async enrichProspect(prospect: ProspectData): Promise<ProspectData> {
    const systemPrompt = `You are an expert at researching companies and finding relevant business information.`;

    const prompt = `Research and provide additional details about this company:

Company: ${prospect.companyName}
Website: ${prospect.website || 'N/A'}
Industry: ${prospect.industry}
Location: ${prospect.location.city}, ${prospect.location.state}

Provide enrichment data in JSON format:
{
  "description": "Brief company description",
  "pain_points": ["Likely pain points based on industry"],
  "recent_news": "Any recent relevant news or updates",
  "technologies": ["Technologies they likely use"],
  "decision_makers": [
    {
      "name": "Name if findable",
      "title": "Title",
      "linkedin_url": "LinkedIn URL if available"
    }
  ]
}`;

    const result = await this.orchestrator.runPrompt(prompt, { systemPrompt });

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const enrichment = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        
        return {
          ...prospect,
          description: String(enrichment.description || prospect.description || ''),
          painPoints: Array.isArray(enrichment.pain_points)
            ? enrichment.pain_points.map(String)
            : prospect.painPoints,
          recentNews: String(enrichment.recent_news || prospect.recentNews || ''),
          technologies: Array.isArray(enrichment.technologies)
            ? enrichment.technologies.map(String)
            : prospect.technologies,
        };
      }
    } catch {
      // Return original if enrichment fails
    }

    return prospect;
  }

  /**
   * Find contacts for a prospect
   */
  async findContacts(prospect: ProspectData): Promise<ProspectData> {
    // In production, this would use Hunter.io, Apollo, or similar
    // For now, return the prospect as-is since we already have mock contacts
    return prospect;
  }

  /**
   * Validate prospect data quality
   */
  validateProspect(prospect: ProspectData): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!prospect.companyName) {
      issues.push('Missing company name');
    }

    if (!prospect.contacts || prospect.contacts.length === 0) {
      issues.push('No contacts found');
    } else {
      const primaryContact = prospect.contacts.find(c => c.isPrimary);
      if (!primaryContact?.email) {
        issues.push('Primary contact missing email');
      }
    }

    if (!prospect.industry) {
      issues.push('Missing industry classification');
    }

    if (prospect.icpMatchScore < 0.5) {
      issues.push('Low ICP match score');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

