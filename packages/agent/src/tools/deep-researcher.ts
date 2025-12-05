/**
 * Deep Researcher Tool - Comprehensive research for prospects using Perplexity API
 *
 * Three research modes:
 * 1. Company: Funding, news, products, competitors, positioning
 * 2. Contacts: Career history, education, insights for decision makers
 * 3. Market: Industry trends, market size, pain points, buying signals
 */

import { tool } from 'ai';
import { z } from 'zod';
import type {
  DeepResearchResult,
  FundingRound,
  NewsItem,
  ContactResearch,
} from '@cold-outreach/shared';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Structured logging helper
function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'DeepResearcher',
    event,
    ...data,
  }));
}

interface PerplexityResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

async function queryPerplexity(
  prompt: string,
  systemPrompt: string,
  apiKey: string
): Promise<string | null> {
  const startTime = Date.now();

  try {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(60000), // 60s timeout for deep research
    });

    if (!response.ok) {
      log('perplexity_error', {
        status: response.status,
        durationMs: Date.now() - startTime,
      });
      return null;
    }

    const data = await response.json() as PerplexityResponse;
    const content = data.choices?.[0]?.message?.content || null;

    log('perplexity_complete', {
      durationMs: Date.now() - startTime,
      contentLength: content?.length || 0,
      success: !!content,
    });

    return content;
  } catch (error) {
    log('perplexity_error', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    return null;
  }
}

function parseJsonFromResponse<T>(content: string, fallback: T): T {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      return JSON.parse(jsonMatch[1].trim()) as T;
    }
    // Try parsing the whole content as JSON
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

// ===== COMPANY RESEARCH =====

interface CompanyResearchResult {
  funding?: FundingRound[];
  recentNews?: NewsItem[];
  products?: string[];
  competitors?: string[];
  positioning?: string;
  strengths?: string[];
  weaknesses?: string[];
}

async function researchCompany(
  companyName: string,
  website: string | undefined,
  industry: string | undefined,
  apiKey: string
): Promise<CompanyResearchResult | null> {
  log('company_research_start', { companyName, website, industry });

  const systemPrompt = `You are a business intelligence analyst. Research companies and provide structured data about their business, funding, and competitive position. Always respond with valid JSON only, no markdown.`;

  const prompt = `Research "${companyName}"${website ? ` (${website})` : ''}${industry ? ` in the ${industry} industry` : ''}.

Provide the following information in JSON format:
{
  "funding": [{"round": "Series A", "amount": "$10M", "date": "2023-01", "investors": ["Investor 1"]}],
  "recentNews": [{"title": "News headline", "date": "2024-01", "summary": "Brief summary", "url": "https://..."}],
  "products": ["Product 1", "Service 1"],
  "competitors": ["Competitor 1", "Competitor 2"],
  "positioning": "How they position themselves in the market",
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"]
}

Focus on:
1. Recent funding rounds (last 3 years) with amounts, dates, and investors
2. Major news from the last 6 months
3. Main products and services
4. Direct competitors
5. Market positioning and unique value proposition
6. Business strengths and potential weaknesses

If information is not available, omit that field. Respond ONLY with the JSON object, no explanations.`;

  const response = await queryPerplexity(prompt, systemPrompt, apiKey);
  if (!response) return null;

  const result = parseJsonFromResponse<CompanyResearchResult>(response, {});

  log('company_research_complete', {
    companyName,
    hasData: Object.keys(result).length > 0,
    fundingRounds: result.funding?.length || 0,
    newsItems: result.recentNews?.length || 0,
    competitors: result.competitors?.length || 0,
  });

  return result;
}

// ===== CONTACT RESEARCH =====

async function researchContacts(
  companyName: string,
  contacts: Array<{ name: string; title: string }>,
  apiKey: string
): Promise<ContactResearch[] | null> {
  if (!contacts || contacts.length === 0) {
    log('contact_research_skip', { companyName, reason: 'no_contacts' });
    return null;
  }

  log('contact_research_start', { companyName, contactCount: contacts.length });

  const systemPrompt = `You are a professional researcher. Research business professionals and their career backgrounds. Provide structured data. Always respond with valid JSON only, no markdown.`;

  // Limit to top 5 contacts to avoid too long queries
  const topContacts = contacts.slice(0, 5);
  const contactList = topContacts.map(c => `- ${c.name} (${c.title})`).join('\n');

  const prompt = `Research the professional backgrounds of these executives at "${companyName}":

${contactList}

For each person, provide:
{
  "contacts": [
    {
      "name": "Full Name",
      "careerHistory": [{"company": "Previous Company", "title": "Previous Title", "duration": "2020-2023"}],
      "education": "University name and degree if available",
      "insights": "Notable achievements, publications, speaking engagements, or relevant background"
    }
  ]
}

Focus on:
1. Previous work experience (last 3-4 positions)
2. Education background
3. Notable achievements or expertise
4. Any public presence (conferences, publications, interviews)

If you cannot find information about a person, include them with available fields only. Respond ONLY with the JSON object.`;

  const response = await queryPerplexity(prompt, systemPrompt, apiKey);
  if (!response) return null;

  const result = parseJsonFromResponse<{ contacts?: ContactResearch[] }>(response, {});

  log('contact_research_complete', {
    companyName,
    contactsResearched: result.contacts?.length || 0,
  });

  return result.contacts || null;
}

// ===== MARKET RESEARCH =====

interface MarketResearchResult {
  trends?: string[];
  marketSize?: string;
  growthRate?: string;
  painPoints?: string[];
  buyingSignals?: string[];
  opportunities?: string[];
}

async function researchMarket(
  companyName: string,
  industry: string | undefined,
  apiKey: string
): Promise<MarketResearchResult | null> {
  log('market_research_start', { companyName, industry });

  const systemPrompt = `You are a market research analyst. Analyze industry trends and market dynamics. Always respond with valid JSON only, no markdown.`;

  const industryContext = industry || 'their industry';

  const prompt = `Analyze the market context for "${companyName}" in ${industryContext}.

Provide the following information in JSON format:
{
  "trends": ["Trend 1", "Trend 2", "Trend 3"],
  "marketSize": "$X billion (2024)",
  "growthRate": "X% CAGR",
  "painPoints": ["Pain point 1", "Pain point 2"],
  "buyingSignals": ["Signal 1", "Signal 2"],
  "opportunities": ["Opportunity 1", "Opportunity 2"]
}

Focus on:
1. Current industry trends affecting this type of business
2. Market size and growth projections
3. Common pain points companies in this space face
4. Buying signals that indicate readiness to purchase solutions
5. Market opportunities and gaps

If information is not available, omit that field. Respond ONLY with the JSON object, no explanations.`;

  const response = await queryPerplexity(prompt, systemPrompt, apiKey);
  if (!response) return null;

  const result = parseJsonFromResponse<MarketResearchResult>(response, {});

  log('market_research_complete', {
    companyName,
    hasData: Object.keys(result).length > 0,
    trendsCount: result.trends?.length || 0,
    painPointsCount: result.painPoints?.length || 0,
  });

  return result;
}

// ===== MAIN EXECUTE FUNCTION =====

export interface DeepResearchParams {
  type: 'company' | 'contacts' | 'market' | 'full';
  prospect: {
    id: string;
    companyName: string;
    website?: string;
    industry?: string;
    contacts?: Array<{ name: string; title: string }>;
  };
}

export interface DeepResearchOutput {
  success: boolean;
  prospectId: string;
  result?: DeepResearchResult;
  error?: string;
}

export async function executeDeepResearcher(params: DeepResearchParams): Promise<DeepResearchOutput> {
  const { type, prospect } = params;
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      prospectId: prospect.id,
      error: 'PERPLEXITY_API_KEY not configured',
    };
  }

  log('deep_research_start', {
    type,
    prospectId: prospect.id,
    companyName: prospect.companyName,
  });

  const startTime = Date.now();

  try {
    const result: DeepResearchResult = {
      researchedAt: new Date().toISOString(),
    };

    if (type === 'company' || type === 'full') {
      const companyData = await researchCompany(
        prospect.companyName,
        prospect.website,
        prospect.industry,
        apiKey
      );
      if (companyData) {
        result.company = companyData;
      }
    }

    if (type === 'contacts' || type === 'full') {
      if (prospect.contacts && prospect.contacts.length > 0) {
        const contactData = await researchContacts(
          prospect.companyName,
          prospect.contacts,
          apiKey
        );
        if (contactData) {
          result.contacts = contactData;
        }
      }
    }

    if (type === 'market' || type === 'full') {
      const marketData = await researchMarket(
        prospect.companyName,
        prospect.industry,
        apiKey
      );
      if (marketData) {
        result.market = marketData;
      }
    }

    log('deep_research_complete', {
      prospectId: prospect.id,
      type,
      durationMs: Date.now() - startTime,
      hasCompanyData: !!result.company,
      hasContactsData: !!result.contacts,
      hasMarketData: !!result.market,
    });

    return {
      success: true,
      prospectId: prospect.id,
      result,
    };
  } catch (error) {
    log('deep_research_error', {
      prospectId: prospect.id,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    return {
      success: false,
      prospectId: prospect.id,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ===== AI SDK TOOL DEFINITION =====

export const deepResearcherTool = tool({
  description: 'Perform deep research on a prospect to gather comprehensive intelligence about the company, contacts, and market context',
  inputSchema: z.object({
    type: z.enum(['company', 'contacts', 'market', 'full']).describe(
      'Type of research: company (funding, news, competitors), contacts (career backgrounds), market (trends, pain points), or full (all)'
    ),
    prospect: z.object({
      id: z.string(),
      companyName: z.string(),
      website: z.string().optional(),
      industry: z.string().optional(),
      contacts: z.array(z.object({
        name: z.string(),
        title: z.string(),
      })).optional(),
    }).describe('Prospect data to research'),
  }),
  execute: async ({ type, prospect }) => {
    return executeDeepResearcher({ type, prospect });
  },
});
