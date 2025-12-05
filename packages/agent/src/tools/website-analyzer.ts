/**
 * Website Analyzer Tool - Crawls and analyzes company websites using Firecrawl
 */

import { tool } from 'ai';
import { z } from 'zod';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

interface ScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      sourceURL?: string;
      title?: string;
      description?: string;
    };
  };
}

interface SubpageContent {
  path: string;
  content: string;
}

async function scrapeUrl(url: string, apiKey: string): Promise<ScrapeResult> {
  const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl API error: ${await response.text()}`);
  }

  return response.json() as Promise<ScrapeResult>;
}

async function crawlSubpages(baseUrl: string, apiKey: string): Promise<SubpageContent[]> {
  const importantPaths = ['/about', '/product', '/products', '/pricing', '/features', '/solutions'];
  const subpages: SubpageContent[] = [];

  for (const path of importantPaths) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}${path}`;
      const result = await scrapeUrl(url, apiKey);

      if (result.success && result.data?.markdown) {
        subpages.push({
          path,
          content: result.data.markdown,
        });
      }
    } catch {
      // Silently skip failed subpages
    }
  }

  return subpages;
}

function analyzeContent(scrapedData: ScrapeResult, subpages: SubpageContent[]) {
  const mainContent = scrapedData.data?.markdown || '';
  const metadata = scrapedData.data?.metadata || {};

  // Combine all content for analysis
  let allContent = mainContent;
  for (const subpage of subpages) {
    allContent += `\n\n--- ${subpage.path} ---\n${subpage.content}`;
  }

  return {
    url: metadata.sourceURL || '',
    title: metadata.title || '',
    description: metadata.description || '',
    content_length: allContent.length,
    main_content: mainContent.substring(0, 5000), // First 5000 chars
    subpages_crawled: subpages.length,
    has_pricing: subpages.some(sp => sp.path.includes('/pricing')),
    has_about: subpages.some(sp => sp.path.includes('/about')),
    full_content: allContent,
  };
}

export const websiteAnalyzerTool = tool({
  description: 'Crawl and analyze a company website to extract business information using Firecrawl API',
  inputSchema: z.object({
    url: z.string().url().describe('The website URL to analyze'),
    deepCrawl: z.boolean().default(true).describe('Whether to crawl important subpages like /about, /pricing'),
  }),
  execute: async ({ url, deepCrawl }: { url: string; deepCrawl: boolean }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: 'FIRECRAWL_API_KEY not configured',
      };
    }

    try {
      // Scrape main page
      const mainResult = await scrapeUrl(url, apiKey);

      if (!mainResult.success) {
        return {
          success: false,
          error: 'Failed to scrape website',
        };
      }

      // Optionally crawl subpages
      const subpages = deepCrawl ? await crawlSubpages(url, apiKey) : [];

      // Analyze content
      const analysis = analyzeContent(mainResult, subpages);

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
