/**
 * Smart Contact Extractor Tool
 *
 * Intelligent contact extraction using:
 * 1. Firecrawl /map endpoint to discover site structure
 * 2. Targeted crawling of team/about/leadership pages
 * 3. DeepSeek AI for structured extraction and validation
 */

import { tool } from 'ai';
import { z } from 'zod';
import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1';

// Configuration
const MAX_PAGES_TO_SCRAPE = 8; // Increased from 5
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

// Structured logging helper
function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'SmartContactExtractor',
    event,
    ...data,
  }));
}

/**
 * Retry wrapper for AI calls with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries = MAX_RETRIES,
  baseDelayMs = BASE_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isRetryable =
        lastError.message.includes('terminated') ||
        lastError.message.includes('socket') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('other side closed') ||
        lastError.message.includes('Failed to process');

      if (!isRetryable || attempt === maxRetries) {
        log('retry_failed', {
          context,
          attempt,
          maxRetries,
          error: lastError.message,
          retryable: isRetryable,
        });
        throw lastError;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      log('retry_attempt', {
        context,
        attempt,
        maxRetries,
        delayMs: delay,
        error: lastError.message,
      });
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

// Contact-relevant page patterns (English + Finnish + German + Swedish)
const CONTACT_PAGE_PATTERNS = [
  // English
  /\/team/i,
  /\/about/i,
  /\/leadership/i,
  /\/management/i,
  /\/our-team/i,
  /\/meet-the-team/i,
  /\/people/i,
  /\/staff/i,
  /\/executives/i,
  /\/founders/i,
  /\/contact/i,
  /\/company/i,
  /\/who-we-are/i,
  /\/corporate/i,
  /\/info/i,
  // Finnish
  /\/tiimi/i,
  /\/meista/i,
  /\/meistä/i,
  /\/yhteystiedot/i,
  /\/henkilosto/i,
  /\/henkilöstö/i,
  /\/johto/i,
  /\/johtoryhma/i,
  /\/johtoryhmä/i,
  /\/yritys/i,
  // German
  /\/ueber-uns/i,
  /\/uber-uns/i,
  /\/kontakt/i,
  /\/unternehmen/i,
  /\/mitarbeiter/i,
  // Swedish
  /\/om-oss/i,
  /\/vara-medarbetare/i,
  /\/kontakta/i,
];

// Decision maker title patterns for scoring
const DECISION_MAKER_TITLES = [
  'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'CRO',
  'Chief Executive', 'Chief Technology', 'Chief Financial', 'Chief Operating', 'Chief Marketing', 'Chief Revenue',
  'Founder', 'Co-Founder', 'Owner',
  'President', 'Vice President', 'VP',
  'Director', 'Head of', 'Manager',
  'Partner', 'Principal',
];

interface ExtractedContact {
  name: string;
  title: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  confidence: number;
  source_page: string;
  is_decision_maker: boolean;
}

interface MapResult {
  success: boolean;
  links?: string[];
  error?: string;
}

interface ScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      sourceURL?: string;
    };
  };
  error?: string;
}

// Get DeepSeek model
function getDeepSeekModel() {
  const deepseek = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
  return deepseek('deepseek-chat');
}

/**
 * Common sitemap locations to try
 */
const SITEMAP_LOCATIONS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap/sitemap.xml',
  '/sitemaps/sitemap.xml',
  '/wp-sitemap.xml', // WordPress
  '/sitemap-index.xml',
  '/page-sitemap.xml',
];

/**
 * Fetch and parse sitemap.xml
 * Returns array of actual page URLs (not sitemap XML files)
 * Handles sitemap indexes by recursively fetching child sitemaps
 */
async function fetchSitemap(baseUrl: string): Promise<string[]> {
  // Always search for sitemap at domain root, not at the page path
  const urlObj = new URL(baseUrl);
  const domainRoot = `${urlObj.protocol}//${urlObj.hostname}`;
  const baseDomain = urlObj.hostname;

  for (const location of SITEMAP_LOCATIONS) {
    const sitemapUrl = `${domainRoot}${location}`;

    try {
      log('sitemap_fetch_attempt', { url: sitemapUrl });

      const response = await fetch(sitemapUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BusinessBot/1.0)',
          'Accept': 'application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const text = await response.text();

      // Check if it's actually XML
      if (!text.includes('<?xml') && !text.includes('<urlset') && !text.includes('<sitemapindex')) {
        continue;
      }

      log('sitemap_found', { url: sitemapUrl, size: text.length });

      // Check if this is a sitemap index
      if (isSitemapIndex(text)) {
        // It's a sitemap index - fetch child sitemaps recursively
        const childSitemapUrls = extractUrlsFromSitemap(text);

        // Prioritize page sitemaps over post/taxonomy sitemaps
        const prioritizedChildren = prioritizeChildSitemaps(childSitemapUrls);

        log('sitemap_index_detected', {
          url: sitemapUrl,
          childSitemaps: childSitemapUrls.length,
          prioritizedOrder: prioritizedChildren.slice(0, 5),
        });

        const allPageUrls: string[] = [];

        // Fetch up to 5 child sitemaps (prioritized)
        for (const childUrl of prioritizedChildren.slice(0, 5)) {
          if (!childUrl.endsWith('.xml')) continue;

          log('child_sitemap_fetch', {
            parentUrl: sitemapUrl,
            childUrl,
            currentPageCount: allPageUrls.length,
          });

          const childPages = await fetchSitemapRecursive(childUrl, baseDomain, 1, 2);

          log('child_sitemap_result', {
            childUrl,
            pagesFound: childPages.length,
            sample: childPages.slice(0, 3),
          });

          allPageUrls.push(...childPages);

          // Limit total pages
          if (allPageUrls.length >= 100) break;

          await new Promise(r => setTimeout(r, 200));
        }

        if (allPageUrls.length > 0) {
          log('sitemap_pages_collected', {
            url: sitemapUrl,
            totalPages: allPageUrls.length,
            sample: allPageUrls.slice(0, 5),
          });
          return allPageUrls;
        } else {
          log('sitemap_index_no_pages', {
            url: sitemapUrl,
            childrenTried: Math.min(prioritizedChildren.length, 5),
          });
        }
      } else {
        // Regular sitemap - extract page URLs directly
        const urls = extractUrlsFromSitemap(text);

        // Filter out XML files and ensure same domain
        const pageUrls = urls.filter(url => {
          try {
            const urlObj = new URL(url);
            return urlObj.hostname === baseDomain && !url.endsWith('.xml');
          } catch {
            return false;
          }
        });

        if (pageUrls.length > 0) {
          log('sitemap_parsed', { url: sitemapUrl, urlCount: pageUrls.length });
          return pageUrls;
        }
      }
    } catch (error) {
      // Silent fail, try next location
      continue;
    }
  }

  log('sitemap_not_found', { baseUrl, triedLocations: SITEMAP_LOCATIONS.length });
  return [];
}

/**
 * Check if sitemap content is a sitemap index (contains links to other sitemaps)
 */
function isSitemapIndex(xmlContent: string): boolean {
  return xmlContent.includes('<sitemapindex') || xmlContent.includes('</sitemapindex>');
}

/**
 * Prioritize child sitemaps - page sitemaps first, then others, posts/taxonomies last
 * WordPress sites often have multiple child sitemaps, we want the ones with actual pages
 */
function prioritizeChildSitemaps(sitemapUrls: string[]): string[] {
  return [...sitemapUrls].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    // Highest priority: page sitemaps
    const aIsPage = aLower.includes('page') || aLower.includes('sitemap-0') || aLower.includes('sitemap.xml');
    const bIsPage = bLower.includes('page') || bLower.includes('sitemap-0') || bLower.includes('sitemap.xml');
    if (aIsPage && !bIsPage) return -1;
    if (!aIsPage && bIsPage) return 1;

    // Lowest priority: posts, taxonomies, categories, tags
    const aIsLowPriority = aLower.includes('post') || aLower.includes('taxonom') ||
                           aLower.includes('categor') || aLower.includes('tag') ||
                           aLower.includes('author');
    const bIsLowPriority = bLower.includes('post') || bLower.includes('taxonom') ||
                           bLower.includes('categor') || bLower.includes('tag') ||
                           bLower.includes('author');
    if (aIsLowPriority && !bIsLowPriority) return 1;
    if (!aIsLowPriority && bIsLowPriority) return -1;

    return 0;
  });
}

/**
 * Extract URLs from sitemap XML content
 */
function extractUrlsFromSitemap(xmlContent: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(xmlContent)) !== null) {
    const url = match[1]?.trim();
    if (url) {
      // Decode HTML entities
      const decodedUrl = url
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      urls.push(decodedUrl);
    }
  }
  return urls;
}

/**
 * Recursively fetch and parse sitemaps, handling sitemap indexes
 * Returns actual page URLs, not sitemap URLs
 */
async function fetchSitemapRecursive(
  sitemapUrl: string,
  baseDomain: string,
  depth = 0,
  maxDepth = 2
): Promise<string[]> {
  if (depth > maxDepth) return [];

  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BusinessBot/1.0)',
        'Accept': 'application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const text = await response.text();

    // Verify it's XML
    if (!text.includes('<?xml') && !text.includes('<urlset') && !text.includes('<sitemapindex')) {
      return [];
    }

    const urls = extractUrlsFromSitemap(text);

    // If it's a sitemap index, recursively fetch child sitemaps
    if (isSitemapIndex(text)) {
      log('sitemap_index_found', { url: sitemapUrl, childSitemaps: urls.length });

      const childUrls: string[] = [];
      // Fetch up to 5 child sitemaps to avoid too many requests
      const childSitemapsToFetch = urls.slice(0, 5);

      for (const childUrl of childSitemapsToFetch) {
        // Skip non-sitemap URLs that might have slipped through
        if (!childUrl.endsWith('.xml')) continue;

        const childPageUrls = await fetchSitemapRecursive(childUrl, baseDomain, depth + 1, maxDepth);
        childUrls.push(...childPageUrls);

        // Small delay between fetches
        await new Promise(r => setTimeout(r, 200));
      }

      return childUrls;
    }

    // Regular sitemap - filter to same domain and exclude sitemap XML files
    return urls.filter(url => {
      try {
        const urlObj = new URL(url);
        // Must be same domain and NOT a sitemap XML file
        return urlObj.hostname === baseDomain && !url.endsWith('.xml');
      } catch {
        return false;
      }
    });
  } catch (error) {
    log('sitemap_fetch_error', {
      url: sitemapUrl,
      depth,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}


/**
 * Use AI to intelligently select pages most likely to contain contact info
 * This works in any language - no hardcoded patterns needed
 */
async function aiSelectContactPages(
  urls: string[],
  companyName: string,
  maxPages: number = MAX_PAGES_TO_SCRAPE
): Promise<string[]> {
  if (urls.length === 0) return [];
  if (urls.length <= maxPages) return urls;

  const model = getDeepSeekModel();

  // Truncate URL list if too long (keep it under token limits)
  const urlSample = urls.slice(0, 200);

  const prompt = `You are helping find contact information for employees at "${companyName}".

Select the ${maxPages} URLs most likely to contain a DIRECTORY or LIST of employees with their contact details.

BEST pages (prioritize these):
- /team, /tiimi, /our-team, /meet-the-team - Team directory pages
- /about, /meista, /about-us, /uber-uns - About pages with staff
- /contact, /yhteystiedot, /kontakt - Contact pages with emails
- /leadership, /johto, /management - Leadership/management pages
- /people, /henkilosto, /staff - Staff directory pages

AVOID these (even if they mention people):
- News articles, press releases, blog posts (URLs with /news/, /blog/, /ajankohtaista/, /tiedotteet/, /press/)
- URLs containing dates (e.g., /2022/, /2023/, /2024/)
- Job postings, career pages (unless they list current staff)
- Product/service pages, pricing pages
- Legal pages (privacy, terms, GDPR)

URLs:
${urlSample.map((u, i) => `${i + 1}. ${u}`).join('\n')}

Return ONLY a JSON array of the ${maxPages} best URL strings.
Example: ["https://example.com/team", "https://example.com/about"]

CRITICAL: A dedicated /team or /yhteystiedot page is 10x more valuable than a news article about a leadership appointment. News articles have outdated info and no contact details.

Return valid JSON array only, no explanation.`;

  try {
    const { text } = await withRetry(
      () => generateText({
        model,
        prompt,
        maxOutputTokens: 1000,
        temperature: 0.1,
      }),
      'ai_select_pages'
    );

    // Parse JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log('ai_select_pages_no_json', { responseLength: text.length });
      return urls.slice(0, maxPages);
    }

    const selectedUrls = JSON.parse(jsonMatch[0]) as string[];

    log('ai_select_pages_success', {
      inputCount: urlSample.length,
      selectedCount: selectedUrls.length,
      selected: selectedUrls,
    });

    // Validate that selected URLs exist in original list
    const validUrls = selectedUrls.filter(u => urls.includes(u));
    return validUrls.slice(0, maxPages);
  } catch (error) {
    log('ai_select_pages_error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fallback to pattern-based selection
    return filterContactRelevantPagesByPattern(urls, maxPages);
  }
}

/**
 * Fallback: Filter pages using regex patterns (when AI selection fails)
 */
function filterContactRelevantPagesByPattern(urls: string[], maxPages: number): string[] {
  const scored = urls.map(url => {
    const urlLower = url.toLowerCase();
    let score = 0;

    // Score based on patterns
    if (CONTACT_PAGE_PATTERNS.some(p => p.test(urlLower))) {
      score += 10;
    }

    // Bonus for specific high-value patterns
    if (/team|tiimi|leadership|johto|management/i.test(urlLower)) score += 5;
    if (/about|meista|uber-uns|om-oss/i.test(urlLower)) score += 3;
    if (/contact|yhteystiedot|kontakt/i.test(urlLower)) score += 4;

    // Penalty for likely non-contact pages
    if (/blog|news|article|post|press/i.test(urlLower)) score -= 10;
    if (/product|service|pricing|shop|cart/i.test(urlLower)) score -= 5;
    if (/privacy|terms|legal|cookie|gdpr/i.test(urlLower)) score -= 10;
    if (/\d{4}\/\d{2}\//.test(urlLower)) score -= 10; // Date patterns (blog posts)

    return { url, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages)
    .map(s => s.url);
}

/**
 * Use Firecrawl /map to discover all pages on a website
 * This is the fallback when sitemap isn't available
 */
async function discoverSitePages(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    log('firecrawl_map_start', { url: baseUrl });

    const response = await fetch(`${FIRECRAWL_API_URL}/map`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: baseUrl,
        limit: 100,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      log('firecrawl_map_error', { url: baseUrl, status: response.status });
      return [];
    }

    const data = await response.json() as MapResult;
    log('firecrawl_map_success', { url: baseUrl, linkCount: data.links?.length || 0 });
    return data.links || [];
  } catch (error) {
    log('firecrawl_map_error', {
      url: baseUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Main page discovery function - tries sitemap first, then Firecrawl
 */
async function discoverContactPages(
  baseUrl: string,
  companyName: string,
  firecrawlKey: string
): Promise<{ pages: string[]; method: 'sitemap' | 'firecrawl' | 'fallback' }> {
  // Strategy 1: Try sitemap (free, fast, structured)
  log('discovery_start', { url: baseUrl, strategy: 'sitemap' });
  const sitemapUrls = await fetchSitemap(baseUrl);

  if (sitemapUrls.length > 0) {
    const selectedPages = await aiSelectContactPages(sitemapUrls, companyName);
    if (selectedPages.length > 0) {
      return { pages: selectedPages, method: 'sitemap' };
    }
  }

  // Strategy 2: Use Firecrawl /map endpoint
  log('discovery_fallback', { url: baseUrl, strategy: 'firecrawl' });
  const firecrawlUrls = await discoverSitePages(baseUrl, firecrawlKey);

  if (firecrawlUrls.length > 0) {
    const selectedPages = await aiSelectContactPages(firecrawlUrls, companyName);
    if (selectedPages.length > 0) {
      return { pages: selectedPages, method: 'firecrawl' };
    }
  }

  // Strategy 3: Fallback to homepage + common paths
  log('discovery_fallback', { url: baseUrl, strategy: 'common_paths' });
  const commonPaths = [
    baseUrl,
    `${baseUrl}/about`,
    `${baseUrl}/team`,
    `${baseUrl}/contact`,
    `${baseUrl}/about-us`,
    `${baseUrl}/our-team`,
  ];

  return { pages: commonPaths, method: 'fallback' };
}


/**
 * Scrape a single page with Firecrawl
 */
async function scrapePage(url: string, apiKey: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return await response.json() as ScrapeResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Use Perplexity to research company leadership
 */
async function researchCompanyLeadership(
  companyName: string,
  domain: string,
  perplexityKey: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a business researcher. Find and list key leadership/executive contacts for companies. Include names, titles, and any available contact information (email, LinkedIn).',
          },
          {
            role: 'user',
            content: `Find the leadership team and key executives for ${companyName} (${domain}). List their names, titles, and any contact information you can find. Focus on CEO, CTO, founders, and other decision makers.`,
          },
        ],
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

/**
 * Use DeepSeek to extract structured contacts from page content
 */
async function extractContactsWithAI(
  pageContent: string,
  pageUrl: string,
  companyName: string,
  additionalResearch?: string
): Promise<ExtractedContact[]> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!deepseekKey) {
    console.error('[SmartContactExtractor] DEEPSEEK_API_KEY not configured');
    return [];
  }

  const model = getDeepSeekModel();

  const prompt = `Extract contact information for company employees from this webpage content.

Company: ${companyName}
Page URL: ${pageUrl}

PAGE CONTENT:
${pageContent.substring(0, 8000)}

${additionalResearch ? `
ADDITIONAL RESEARCH:
${additionalResearch}
` : ''}

Extract all people mentioned with their:
- Full name
- Job title/position
- Email (if available)
- Phone (if available)
- LinkedIn URL (if available)

Focus especially on decision makers: CEO, CTO, CFO, Founders, Directors, VPs, Managers.

Respond with a JSON array of contacts. Example format:
[
  {
    "name": "John Smith",
    "title": "CEO & Co-Founder",
    "email": "john@company.com",
    "phone": null,
    "linkedin_url": "https://linkedin.com/in/johnsmith"
  }
]

If no contacts are found, respond with an empty array: []

IMPORTANT: Only include real contacts mentioned in the content. Do not invent or guess.
Respond ONLY with the JSON array, no other text.`;

  try {
    log('ai_extraction_start', { company: companyName, pageUrl });
    const startTime = Date.now();

    const { text } = await withRetry(
      () => generateText({
        model,
        prompt,
        maxOutputTokens: 2000,
        temperature: 0.1, // Low temperature for accurate extraction
      }),
      `extract_contacts_${companyName}`
    );

    log('ai_extraction_complete', {
      company: companyName,
      pageUrl,
      durationMs: Date.now() - startTime,
      responseLength: text.length,
    });

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log('ai_extraction_no_json', { company: companyName, pageUrl });
      return [];
    }

    const contacts = JSON.parse(jsonMatch[0]) as Array<{
      name?: string;
      title?: string;
      email?: string;
      phone?: string;
      linkedin_url?: string;
    }>;

    // Transform and score contacts
    return contacts
      .filter(c => c.name && c.name.trim())
      .map(c => {
        const title = c.title || '';
        const isDecisionMaker = DECISION_MAKER_TITLES.some(
          t => title.toLowerCase().includes(t.toLowerCase())
        );

        // Calculate confidence score
        let confidence = 50;
        if (c.email) confidence += 25;
        if (c.linkedin_url) confidence += 15;
        if (isDecisionMaker) confidence += 10;

        return {
          name: c.name!.trim(),
          title: title.trim(),
          email: c.email || undefined,
          phone: c.phone || undefined,
          linkedin_url: c.linkedin_url || undefined,
          confidence,
          source_page: pageUrl,
          is_decision_maker: isDecisionMaker,
        };
      });
  } catch (error) {
    log('ai_extraction_error', {
      company: companyName,
      pageUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Validate and deduplicate contacts using AI
 * Skips AI validation for very small (<3) or large (>15) lists to avoid timeouts
 */
async function validateAndDedupeContacts(
  contacts: ExtractedContact[],
  companyName: string
): Promise<ExtractedContact[]> {
  if (contacts.length === 0) return [];

  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  // Skip AI validation for small lists (not worth it)
  if (!deepseekKey || contacts.length < 3) {
    return deduplicateByName(contacts);
  }

  // Skip AI validation for large lists (causes timeouts, too slow)
  // Simple deduplication is faster and more reliable for large lists
  if (contacts.length > 15) {
    log('validation_skipped', {
      company: companyName,
      contactCount: contacts.length,
      reason: 'list_too_large',
    });
    return deduplicateByName(contacts);
  }

  const model = getDeepSeekModel();

  const prompt = `Review and validate these extracted contacts for ${companyName}.

CONTACTS:
${JSON.stringify(contacts, null, 2)}

Tasks:
1. Remove any obviously fake or placeholder contacts
2. Identify duplicates (same person, different sources) and merge them
3. Flag any contacts that seem suspicious or unlikely
4. Keep only valid-looking business contacts

Return a JSON array with the validated contacts in the same format.
Respond ONLY with the JSON array.`;

  try {
    log('validation_start', { company: companyName, contactCount: contacts.length });
    const startTime = Date.now();

    const { text } = await withRetry(
      () => generateText({
        model,
        prompt,
        maxOutputTokens: 2000,
        temperature: 0.1,
      }),
      `validate_contacts_${companyName}`
    );

    log('validation_complete', {
      company: companyName,
      durationMs: Date.now() - startTime,
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return deduplicateByName(contacts);
    }

    return JSON.parse(jsonMatch[0]) as ExtractedContact[];
  } catch (error) {
    log('validation_error', {
      company: companyName,
      error: error instanceof Error ? error.message : String(error),
    });
    return deduplicateByName(contacts);
  }
}

/**
 * Simple deduplication by name
 */
function deduplicateByName(contacts: ExtractedContact[]): ExtractedContact[] {
  const seen = new Map<string, ExtractedContact>();

  for (const contact of contacts) {
    const nameKey = contact.name.toLowerCase().trim();
    const existing = seen.get(nameKey);

    if (!existing || contact.confidence > existing.confidence) {
      // Merge data if we have an existing contact
      if (existing) {
        seen.set(nameKey, {
          ...contact,
          email: contact.email || existing.email,
          phone: contact.phone || existing.phone,
          linkedin_url: contact.linkedin_url || existing.linkedin_url,
          confidence: Math.max(contact.confidence, existing.confidence),
        });
      } else {
        seen.set(nameKey, contact);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Fallback: Generate common email patterns for a contact
 */
function generateEmailPatterns(
  name: string,
  domain: string
): string[] {
  const parts = name.toLowerCase().split(/\s+/);
  if (parts.length < 2) return [];

  const firstName = parts[0] || '';
  const lastName = parts[parts.length - 1] || '';
  const firstInitial = firstName[0] || '';

  return [
    `${firstName}.${lastName}@${domain}`,
    `${firstName}${lastName}@${domain}`,
    `${firstInitial}${lastName}@${domain}`,
    `${firstName}@${domain}`,
    `${lastName}@${domain}`,
  ];
}

// Standalone execute function for direct use in pipelines
export async function executeSmartContactExtractor({
  website,
  company_name,
  domain,
  target_titles: _targetTitles,
  use_perplexity = true,
  generate_email_patterns = true,
}: {
  website: string;
  company_name: string;
  domain?: string;
  target_titles?: string[];
  use_perplexity?: boolean;
  generate_email_patterns?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  company_name?: string;
  domain?: string;
  discovery_method?: 'sitemap' | 'firecrawl' | 'fallback';
  pages_discovered?: number;
  pages_scraped?: number;
  pages_scraped_urls?: string[];
  total_contacts?: number;
  decision_makers?: number;
  contacts: ExtractedContact[];
}> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  if (!firecrawlKey) {
    return {
      success: false,
      error: 'FIRECRAWL_API_KEY not configured',
      contacts: [],
    };
  }

  const allContacts: ExtractedContact[] = [];
  const pagesScraped: string[] = [];

  // Extract domain from website if not provided
  const effectiveDomain = domain || new URL(website).hostname.replace('www.', '');

  log('extraction_start', { company: company_name, website });

  try {
    // Phase 1: Smart page discovery (sitemap → Firecrawl → fallback)
    log('phase1_discovery', { company: company_name });
    const discovery = await discoverContactPages(website, company_name, firecrawlKey);

    log('discovery_complete', {
      company: company_name,
      method: discovery.method,
      pagesFound: discovery.pages.length,
      pages: discovery.pages,
    });

    // Always include homepage if not already in list
    const pagesToScrape = discovery.pages.includes(website)
      ? discovery.pages
      : [website, ...discovery.pages].slice(0, MAX_PAGES_TO_SCRAPE);

    // Phase 2: Research with Perplexity (runs in parallel conceptually)
    let perplexityResearch: string | null = null;
    if (use_perplexity && perplexityKey) {
      log('phase2_perplexity', { company: company_name });
      perplexityResearch = await researchCompanyLeadership(company_name, effectiveDomain, perplexityKey);
    }

    // Phase 3: Scrape and extract from each page
    log('phase3_scraping', { company: company_name, pageCount: pagesToScrape.length });

    for (const pageUrl of pagesToScrape) {
      const fullUrl = pageUrl.startsWith('http') ? pageUrl : `${website.replace(/\/$/, '')}${pageUrl}`;

      log('scraping_page', { company: company_name, url: fullUrl });
      const scrapeResult = await scrapePage(fullUrl, firecrawlKey);

      if (scrapeResult.success && scrapeResult.data?.markdown) {
        pagesScraped.push(fullUrl);

        // Extract contacts from this page
        const pageContacts = await extractContactsWithAI(
          scrapeResult.data.markdown,
          fullUrl,
          company_name,
          perplexityResearch || undefined
        );

        log('page_contacts_extracted', {
          company: company_name,
          url: fullUrl,
          contactCount: pageContacts.length,
        });
        allContacts.push(...pageContacts);
      }

      // Small delay between scrapes
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // If Perplexity found contacts not on website, extract those too
    if (perplexityResearch && allContacts.length < 3) {
      log('perplexity_extraction', { company: company_name, reason: 'few_contacts_found' });
      const researchContacts = await extractContactsWithAI(
        perplexityResearch,
        'perplexity_research',
        company_name
      );
      allContacts.push(...researchContacts);
    }

    // Phase 4: Validate and deduplicate
    log('phase4_validation', { company: company_name, rawContactCount: allContacts.length });
    let validatedContacts = await validateAndDedupeContacts(allContacts, company_name);

    // Phase 6: Generate email patterns for contacts without emails
    if (generate_email_patterns) {
      validatedContacts = validatedContacts.map(contact => {
        if (!contact.email && contact.name) {
          const patterns = generateEmailPatterns(contact.name, effectiveDomain);
          return {
            ...contact,
            email_patterns: patterns,
          };
        }
        return contact;
      }) as ExtractedContact[];
    }

    // Sort by decision maker status and confidence
    validatedContacts.sort((a, b) => {
      if (a.is_decision_maker && !b.is_decision_maker) return -1;
      if (!a.is_decision_maker && b.is_decision_maker) return 1;
      return b.confidence - a.confidence;
    });

    // Mark primary contact
    if (validatedContacts.length > 0) {
      validatedContacts[0] = { ...validatedContacts[0], is_primary: true } as ExtractedContact & { is_primary: boolean };
    }

    log('extraction_complete', {
      company: company_name,
      discoveryMethod: discovery.method,
      pagesScraped: pagesScraped.length,
      totalContacts: validatedContacts.length,
      decisionMakers: validatedContacts.filter(c => c.is_decision_maker).length,
    });

    return {
      success: true,
      company_name,
      domain: effectiveDomain,
      discovery_method: discovery.method,
      pages_discovered: discovery.pages.length,
      pages_scraped: pagesScraped.length,
      pages_scraped_urls: pagesScraped,
      total_contacts: validatedContacts.length,
      decision_makers: validatedContacts.filter(c => c.is_decision_maker).length,
      contacts: validatedContacts,
    };
  } catch (error) {
    log('extraction_error', {
      company: company_name,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      contacts: [],
    };
  }
}

export const smartContactExtractorTool = tool({
  description: 'Intelligently extract decision maker contacts from company websites using AI-powered page discovery and extraction',
  inputSchema: z.object({
    website: z.string().url().describe('Company website URL'),
    company_name: z.string().describe('Company name for context'),
    domain: z.string().optional().describe('Company domain (e.g., company.com)'),
    target_titles: z.array(z.string()).default([
      'CEO', 'CTO', 'CFO', 'Founder', 'Owner', 'Director', 'VP', 'Head of',
    ]).describe('Target job titles to prioritize'),
    use_perplexity: z.boolean().default(true).describe('Whether to use Perplexity for additional research'),
    generate_email_patterns: z.boolean().default(true).describe('Generate likely email patterns for contacts without emails'),
  }),
  execute: async ({
    website,
    company_name,
    domain,
    target_titles,
    use_perplexity,
    generate_email_patterns,
  }) => {
    // Delegate to the standalone execute function to avoid code duplication
    return executeSmartContactExtractor({
      website,
      company_name,
      domain,
      target_titles,
      use_perplexity,
      generate_email_patterns,
    });
  },
});

// Export for use in pipeline
export type { ExtractedContact };
