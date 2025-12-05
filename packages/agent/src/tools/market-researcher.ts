/**
 * Market Researcher Tool - Gathers competitive intelligence using Perplexity API
 */

import { tool } from 'ai';
import { z } from 'zod';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

interface PerplexityResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function queryPerplexity(
  query: string,
  apiKey: string,
  systemPrompt: string,
  maxTokens = 500
): Promise<string> {
  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: query,
        },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${await response.text()}`);
  }

  const data = await response.json() as PerplexityResponse;
  return data.choices[0]?.message?.content || '';
}

async function researchCompany(companyName: string, industry: string, apiKey: string) {
  const queries = [
    {
      key: 'overview',
      query: `What does ${companyName} do? What products or services do they offer?`,
    },
    {
      key: 'competitors',
      query: `Who are the main competitors of ${companyName} in the ${industry} industry?`,
    },
    {
      key: 'target_market',
      query: `What is the target market for ${companyName}? What types of customers do they serve?`,
    },
    {
      key: 'differentiators',
      query: `What are the key differentiators and unique selling points of ${companyName}?`,
    },
    {
      key: 'company_info',
      query: `What is the company size, funding, and growth stage of ${companyName}?`,
    },
  ];

  const results: Record<string, string> = {};
  const systemPrompt = 'You are a business analyst researching companies. Provide concise, factual information.';

  for (const { key, query } of queries) {
    try {
      results[key] = await queryPerplexity(query, apiKey, systemPrompt);
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn(`Warning: Query ${key} failed:`, error);
    }
  }

  return results;
}

async function researchIndustry(industry: string, apiKey: string) {
  const query = `Analyze the ${industry} industry:
1. What are the current market trends?
2. What are the common pain points for companies in this industry?
3. What technologies or solutions are in demand?
4. What is the typical buying process and who are the decision makers?`;

  const systemPrompt = 'You are an industry analyst. Provide insights about industry trends and dynamics.';

  try {
    const analysis = await queryPerplexity(query, apiKey, systemPrompt, 1000);
    return { industry_analysis: analysis };
  } catch {
    return { industry_analysis: 'Unable to analyze industry' };
  }
}

export const marketResearcherTool = tool({
  description: 'Research a company and its market using Perplexity API to gather competitive intelligence',
  inputSchema: z.object({
    companyName: z.string().describe('The name of the company to research'),
    industry: z.string().describe('The industry vertical of the company'),
  }),
  execute: async ({ companyName, industry }) => {
    const apiKey = process.env.PERPLEXITY_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: 'PERPLEXITY_API_KEY not configured',
      };
    }

    try {
      // Research company
      const companyResearch = await researchCompany(companyName, industry, apiKey);

      // Research industry
      const industryResearch = await researchIndustry(industry, apiKey);

      return {
        success: true,
        research: {
          company_name: companyName,
          industry,
          ...companyResearch,
          ...industryResearch,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
