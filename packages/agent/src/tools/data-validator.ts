/**
 * Data Validator Tool - Validates prospects against ICP criteria
 */

import { tool } from 'ai';
import { z } from 'zod';

interface Prospect {
  id: string;
  company_name: string;
  domain?: string;
  industry?: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
  contacts?: Array<{
    email?: string;
    title?: string;
  }>;
  [key: string]: unknown;
}

interface ICP {
  industry_targeting?: {
    industries?: string[];
  };
  geographic_targeting?: {
    markets?: Array<{
      city?: string;
      state?: string;
      country?: string;
    }>;
  };
  firmographic_criteria?: {
    company_size?: string;
  };
  decision_maker_targeting?: {
    titles?: string[];
  };
}

interface ValidationResult {
  prospect: Prospect;
  icp_score: number;
  is_valid: boolean;
  issues: string[];
  score_breakdown: {
    industry_match: number;
    location_match: number;
    contact_match: number;
    email_valid: number;
  };
}

function validateEmail(email?: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function calculateIndustryScore(prospect: Prospect, icp: ICP): number {
  const targetIndustries = icp.industry_targeting?.industries || [];
  if (targetIndustries.length === 0) return 25; // Full points if no criteria

  const prospectIndustry = prospect.industry?.toLowerCase() || '';

  for (const industry of targetIndustries) {
    if (prospectIndustry.includes(industry.toLowerCase()) ||
        industry.toLowerCase().includes(prospectIndustry)) {
      return 25;
    }
  }

  return 0;
}

function calculateLocationScore(prospect: Prospect, icp: ICP): number {
  const targetMarkets = icp.geographic_targeting?.markets || [];
  if (targetMarkets.length === 0) return 20; // Full points if no criteria

  const address = prospect.address;
  if (!address) return 0;

  for (const market of targetMarkets) {
    const cityMatch = !market.city ||
      address.city?.toLowerCase() === market.city.toLowerCase();
    const stateMatch = !market.state ||
      address.state?.toLowerCase() === market.state.toLowerCase();
    const countryMatch = !market.country ||
      address.country?.toLowerCase() === market.country.toLowerCase();

    if (cityMatch && stateMatch && countryMatch) {
      return 20;
    }
  }

  return 5; // Partial score if no exact match
}

function calculateContactScore(prospect: Prospect, icp: ICP): number {
  const targetTitles = icp.decision_maker_targeting?.titles || [];
  const contacts = prospect.contacts || [];

  if (contacts.length === 0) return 0;
  if (targetTitles.length === 0) return 25; // Full points if no criteria

  for (const contact of contacts) {
    const title = contact.title?.toLowerCase() || '';
    for (const targetTitle of targetTitles) {
      if (title.includes(targetTitle.toLowerCase()) ||
          targetTitle.toLowerCase().includes(title)) {
        return 25;
      }
    }
  }

  return 10; // Partial score for having contacts
}

function calculateEmailScore(prospect: Prospect): number {
  const contacts = prospect.contacts || [];
  if (contacts.length === 0) return 0;

  const hasValidEmail = contacts.some(c => validateEmail(c.email));
  return hasValidEmail ? 15 : 0;
}

function validateProspect(prospect: Prospect, icp: ICP): ValidationResult {
  const issues: string[] = [];

  // Calculate individual scores
  const industryScore = calculateIndustryScore(prospect, icp);
  const locationScore = calculateLocationScore(prospect, icp);
  const contactScore = calculateContactScore(prospect, icp);
  const emailScore = calculateEmailScore(prospect);

  // Track issues
  if (industryScore === 0) {
    issues.push('Industry does not match ICP criteria');
  }
  if (locationScore === 0) {
    issues.push('Location does not match target markets');
  }
  if (contactScore === 0) {
    issues.push('No contacts found');
  }
  if (emailScore === 0) {
    issues.push('No valid email addresses');
  }
  if (!prospect.domain) {
    issues.push('Missing domain');
  }

  const totalScore = industryScore + locationScore + contactScore + emailScore;
  const normalizedScore = totalScore / 85; // Max possible score

  return {
    prospect,
    icp_score: Math.round(normalizedScore * 100) / 100,
    is_valid: normalizedScore >= 0.5 && issues.length <= 2,
    issues,
    score_breakdown: {
      industry_match: industryScore,
      location_match: locationScore,
      contact_match: contactScore,
      email_valid: emailScore,
    },
  };
}

// Input types for standalone execute function
interface ProspectInput {
  id: string;
  company_name: string;
  domain?: string;
  industry?: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
  contacts?: Array<{
    email?: string;
    title?: string;
  }>;
  [key: string]: unknown;
}

interface ICPInput {
  industry_targeting?: {
    industries?: string[];
  };
  geographic_targeting?: {
    markets?: Array<{
      city?: string;
      state?: string;
      country?: string;
    }>;
  };
  firmographic_criteria?: {
    company_size?: string;
  };
  decision_maker_targeting?: {
    titles?: string[];
  };
}

// Standalone execute function for direct use in pipelines
export async function executeDataValidator({
  prospects,
  icp,
  minScore = 0.5,
}: {
  prospects: ProspectInput[];
  icp: ICPInput;
  minScore?: number;
}) {
  const results = prospects.map(p => validateProspect(p as Prospect, icp as ICP));

  // Sort by score descending
  results.sort((a, b) => b.icp_score - a.icp_score);

  const validProspects = results.filter(r => r.icp_score >= minScore && r.is_valid);
  const invalidProspects = results.filter(r => r.icp_score < minScore || !r.is_valid);

  return {
    success: true as const,
    total_prospects: results.length,
    valid_count: validProspects.length,
    invalid_count: invalidProspects.length,
    average_score: results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.icp_score, 0) / results.length * 100) / 100
      : 0,
    valid_prospects: validProspects.map(r => r.prospect),
    invalid_prospects: invalidProspects.map(r => ({
      prospect: r.prospect,
      issues: r.issues,
      score: r.icp_score,
    })),
    all_results: results,
  };
}

export const dataValidatorTool = tool({
  description: 'Validate prospects against ICP criteria and calculate match scores',
  inputSchema: z.object({
    prospects: z.array(z.object({
      id: z.string(),
      company_name: z.string(),
      domain: z.string().optional(),
      industry: z.string().optional(),
      address: z.object({
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
      }).optional(),
      contacts: z.array(z.object({
        email: z.string().optional(),
        title: z.string().optional(),
      })).optional(),
    }).passthrough()).describe('Array of prospects to validate'),
    icp: z.object({
      industry_targeting: z.object({
        industries: z.array(z.string()).optional(),
      }).optional(),
      geographic_targeting: z.object({
        markets: z.array(z.object({
          city: z.string().optional(),
          state: z.string().optional(),
          country: z.string().optional(),
        })).optional(),
      }).optional(),
      firmographic_criteria: z.object({
        company_size: z.string().optional(),
      }).optional(),
      decision_maker_targeting: z.object({
        titles: z.array(z.string()).optional(),
      }).optional(),
    }).describe('ICP criteria to validate against'),
    minScore: z.number().default(0.5).describe('Minimum ICP score to be considered valid'),
  }),
  execute: async ({ prospects, icp, minScore }) => {
    const results = prospects.map(p => validateProspect(p as Prospect, icp as ICP));

    // Sort by score descending
    results.sort((a, b) => b.icp_score - a.icp_score);

    const validProspects = results.filter(r => r.icp_score >= minScore && r.is_valid);
    const invalidProspects = results.filter(r => r.icp_score < minScore || !r.is_valid);

    return {
      success: true,
      total_prospects: results.length,
      valid_count: validProspects.length,
      invalid_count: invalidProspects.length,
      average_score: results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.icp_score, 0) / results.length * 100) / 100
        : 0,
      valid_prospects: validProspects.map(r => r.prospect),
      invalid_prospects: invalidProspects.map(r => ({
        prospect: r.prospect,
        issues: r.issues,
        score: r.icp_score,
      })),
      all_results: results,
    };
  },
});
