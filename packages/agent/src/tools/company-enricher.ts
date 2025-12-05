/**
 * Company Enricher Tool - Enriches company data using Firecrawl and Perplexity
 */

import { tool } from 'ai';
import { z } from 'zod';
import { normalizeWebsiteUrl } from '../utils/url.js';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Configuration
const DEFAULT_CONCURRENCY = 3;

// Structured logging helper
function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'CompanyEnricher',
    event,
    ...data,
  }));
}

/**
 * Simple semaphore for concurrency limiting
 */
function createSemaphore(maxConcurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return {
    async acquire(): Promise<void> {
      if (running < maxConcurrency) {
        running++;
        return;
      }
      return new Promise(resolve => queue.push(resolve));
    },
    release(): void {
      running--;
      const next = queue.shift();
      if (next) {
        running++;
        next();
      }
    },
  };
}

interface Prospect {
  id: string;
  company_name: string;
  domain?: string;
  website?: string;
  [key: string]: unknown;
}

interface EnrichedProspect extends Prospect {
  website_content?: string;
  company_summary?: string;
  enrichment_status: 'success' | 'partial' | 'failed';
}

async function scrapeWebsite(website: string, apiKey: string, companyName: string): Promise<string | null> {
  const cleanUrl = normalizeWebsiteUrl(website);
  const startTime = Date.now();

  log('firecrawl_start', { company: companyName, url: cleanUrl });

  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: cleanUrl,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      log('firecrawl_error', {
        company: companyName,
        url: cleanUrl,
        status: response.status,
        durationMs: Date.now() - startTime,
      });
      return null;
    }

    const data = await response.json() as { data?: { markdown?: string } };
    const content = data.data?.markdown?.substring(0, 2000) || null;

    log('firecrawl_complete', {
      company: companyName,
      url: cleanUrl,
      durationMs: Date.now() - startTime,
      contentLength: content?.length || 0,
      success: !!content,
    });

    return content;
  } catch (error) {
    log('firecrawl_error', {
      company: companyName,
      url: cleanUrl,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    return null;
  }
}

async function researchCompany(companyName: string, apiKey: string): Promise<string | null> {
  const startTime = Date.now();

  log('perplexity_start', { company: companyName });

  try {
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
            content: 'You are a business analyst. Provide a brief 2-3 sentence summary of the company.',
          },
          {
            role: 'user',
            content: `Provide a brief summary of ${companyName}. What do they do and who are their customers?`,
          },
        ],
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      log('perplexity_error', {
        company: companyName,
        status: response.status,
        durationMs: Date.now() - startTime,
      });
      return null;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const summary = data.choices?.[0]?.message?.content || null;

    log('perplexity_complete', {
      company: companyName,
      durationMs: Date.now() - startTime,
      summaryLength: summary?.length || 0,
      success: !!summary,
    });

    return summary;
  } catch (error) {
    log('perplexity_error', {
      company: companyName,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    return null;
  }
}

async function enrichProspect(
  prospect: Prospect,
  firecrawlKey: string | undefined,
  perplexityKey: string | undefined
): Promise<EnrichedProspect> {
  const startTime = Date.now();

  log('enrich_start', {
    company: prospect.company_name,
    website: prospect.website,
    hasFirecrawl: !!firecrawlKey,
    hasPerplexity: !!perplexityKey,
  });

  let websiteContent: string | null = null;
  let companySummary: string | null = null;

  // Run Firecrawl and Perplexity in parallel for better performance
  const [firecrawlResult, perplexityResult] = await Promise.all([
    prospect.website && firecrawlKey
      ? scrapeWebsite(prospect.website, firecrawlKey, prospect.company_name)
      : Promise.resolve(null),
    perplexityKey
      ? researchCompany(prospect.company_name, perplexityKey)
      : Promise.resolve(null),
  ]);

  websiteContent = firecrawlResult;
  companySummary = perplexityResult;

  const hasWebsite = !!websiteContent;
  const hasSummary = !!companySummary;
  const status = hasWebsite && hasSummary ? 'success' : (hasWebsite || hasSummary ? 'partial' : 'failed');

  log('enrich_complete', {
    company: prospect.company_name,
    totalDurationMs: Date.now() - startTime,
    status,
    hasWebsiteContent: hasWebsite,
    hasSummary,
    websiteContentLength: websiteContent?.length || 0,
  });

  return {
    ...prospect,
    website_content: websiteContent || undefined,
    company_summary: companySummary || undefined,
    enrichment_status: status,
  };
}

// Standalone execute function for direct use in pipelines
export async function executeCompanyEnricher({
  prospects,
  maxProcess = 20,
  maxConcurrency = DEFAULT_CONCURRENCY,
  delayMs = 500,
}: {
  prospects: Array<{
    id: string;
    company_name: string;
    domain?: string;
    website?: string;
    [key: string]: unknown;
  }>;
  maxProcess?: number;
  maxConcurrency?: number;
  delayMs?: number;
}) {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!firecrawlKey && !perplexityKey) {
    return {
      success: false as const,
      error: 'Neither FIRECRAWL_API_KEY nor PERPLEXITY_API_KEY configured',
    };
  }

  const toProcess = prospects.slice(0, maxProcess);
  const remaining = prospects.slice(maxProcess);

  log('batch_start', {
    totalProspects: prospects.length,
    toProcess: toProcess.length,
    maxConcurrency,
    delayMs,
  });

  const batchStartTime = Date.now();
  const semaphore = createSemaphore(maxConcurrency);

  // Process prospects in parallel with concurrency limit
  const enrichmentPromises = toProcess.map(async (prospect, index) => {
    await semaphore.acquire();

    try {
      // Stagger start times slightly to avoid API burst
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (index % maxConcurrency)));
      }

      return await enrichProspect(
        prospect as Prospect,
        firecrawlKey,
        perplexityKey
      );
    } finally {
      semaphore.release();
    }
  });

  const enriched = await Promise.all(enrichmentPromises);

  // Add remaining prospects without enrichment
  for (const prospect of remaining) {
    enriched.push({
      ...(prospect as Prospect),
      enrichment_status: 'failed',
    });
  }

  const successCount = enriched.filter(p => p.enrichment_status === 'success').length;
  const partialCount = enriched.filter(p => p.enrichment_status === 'partial').length;
  const failedCount = enriched.filter(p => p.enrichment_status === 'failed').length;

  log('batch_complete', {
    totalDurationMs: Date.now() - batchStartTime,
    total: enriched.length,
    successful: successCount,
    partial: partialCount,
    failed: failedCount,
    avgTimePerProspect: Math.round((Date.now() - batchStartTime) / toProcess.length),
  });

  return {
    success: true as const,
    total_prospects: enriched.length,
    enriched_count: successCount + partialCount,
    full_enrichment: successCount,
    partial_enrichment: partialCount,
    prospects: enriched,
  };
}

export const companyEnricherTool = tool({
  description: 'Enrich prospect data with website content and company research from Firecrawl and Perplexity',
  inputSchema: z.object({
    prospects: z.array(z.object({
      id: z.string(),
      company_name: z.string(),
      domain: z.string().optional(),
      website: z.string().optional(),
    }).passthrough()).describe('Array of prospects to enrich'),
    maxProcess: z.number().default(20).describe('Maximum number of prospects to process'),
    delayMs: z.number().default(1000).describe('Delay between API calls in milliseconds'),
  }),
  execute: async ({ prospects, maxProcess, delayMs }) => {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const perplexityKey = process.env.PERPLEXITY_API_KEY;

    if (!firecrawlKey && !perplexityKey) {
      return {
        success: false,
        error: 'Neither FIRECRAWL_API_KEY nor PERPLEXITY_API_KEY configured',
      };
    }

    const enriched: EnrichedProspect[] = [];
    const toProcess = prospects.slice(0, maxProcess);
    const remaining = prospects.slice(maxProcess);

    for (const prospect of toProcess) {
      const result = await enrichProspect(
        prospect as Prospect,
        firecrawlKey,
        perplexityKey
      );
      enriched.push(result);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Add remaining prospects without enrichment
    for (const prospect of remaining) {
      enriched.push({
        ...(prospect as Prospect),
        enrichment_status: 'failed',
      });
    }

    const successCount = enriched.filter(p => p.enrichment_status === 'success').length;
    const partialCount = enriched.filter(p => p.enrichment_status === 'partial').length;

    return {
      success: true,
      total_prospects: enriched.length,
      enriched_count: successCount + partialCount,
      full_enrichment: successCount,
      partial_enrichment: partialCount,
      prospects: enriched,
    };
  },
});
