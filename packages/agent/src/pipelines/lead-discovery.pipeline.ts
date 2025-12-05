/**
 * Lead Discovery Pipeline
 * Orchestrates the full lead discovery workflow with parallel enrichment
 *
 * Pipeline Flow:
 * 1. Google Maps Search (sequential per location/industry)
 * 2. Parse to Prospects
 * 3. Parallel Enrichment (Firecrawl + Perplexity) - batches of 5
 * 4. Smart Contact Extraction (AI-powered page discovery and extraction)
 * 5. Validate Against ICP
 * 6. Return enriched, validated prospects
 */

import { nanoid } from 'nanoid';
import type { LeadDiscoveryPhase, LeadDiscoveryProgressEvent, ICP } from '@cold-outreach/shared';

// Import standalone execute functions for pipeline use
import { executeGoogleMapsScraper } from '../tools/google-maps-scraper.js';
import { executeProspectParser } from '../tools/prospect-parser.js';
import { executeCompanyEnricher } from '../tools/company-enricher.js';
import { executeSmartContactExtractor } from '../tools/smart-contact-extractor.js';
import { executeDataValidator } from '../tools/data-validator.js';

export interface LeadDiscoveryConfig {
  clientId: string;
  jobId: string;
  icp: ICP;
  locations: Array<{ city: string; state: string; country: string }>;
  industries: string[];
  limit: number;
  parallelism?: number;
  onProgress: (event: LeadDiscoveryProgressEvent) => void;
}

export interface DiscoveredProspect {
  id: string;
  companyName: string;
  website?: string;
  industry: string;
  subIndustry?: string;
  employeeCount?: string;
  location: {
    city: string;
    state: string;
    country: string;
    address?: string;
  };
  googleMapsUrl?: string;
  googlePlaceId?: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  painPoints?: string[];
  contacts: Array<{
    id: string;
    name: string;
    title: string;
    email?: string;
    phone?: string;
    isPrimary: boolean;
  }>;
  icpMatchScore: number;
  status: 'new';
}

export interface PipelineDiscoveryResult {
  jobId: string;
  prospects: DiscoveredProspect[];
  totalFound: number;
  enrichedCount: number;
  contactsFoundCount: number;
  validatedCount: number;
  duration: number;
}

export class LeadDiscoveryPipeline {
  private config: LeadDiscoveryConfig;
  private parallelism: number;

  constructor(config: LeadDiscoveryConfig) {
    this.config = config;
    this.parallelism = config.parallelism || 5;
  }

  private emitProgress(
    phase: LeadDiscoveryPhase,
    status: 'started' | 'in_progress' | 'completed' | 'failed',
    message?: string,
    metadata?: LeadDiscoveryProgressEvent['metadata']
  ): void {
    this.config.onProgress({
      type: 'lead_discovery_progress',
      clientId: this.config.clientId,
      jobId: this.config.jobId,
      phase,
      status,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  async execute(): Promise<PipelineDiscoveryResult> {
    const { clientId, jobId, icp, locations, industries, limit } = this.config;
    const startTime = Date.now();

    console.log(`[Pipeline] Starting lead discovery for client ${clientId}, job ${jobId}`);

    // Phase 1: Google Maps Search
    this.emitProgress('searching_maps', 'started', 'Starting Google Maps search');

    const rawPlaces: unknown[] = [];
    for (const location of locations) {
      for (const industry of industries) {
        if (rawPlaces.length >= limit) break;

        const locationStr = `${location.city}, ${location.state}, ${location.country}`;

        this.emitProgress('searching_maps', 'in_progress', `Searching ${industry} in ${locationStr}`);
        console.log(`[Pipeline] Searching: ${industry} in ${locationStr}`);

        try {
          const result = await executeGoogleMapsScraper({
            location: locationStr,
            industry,
            limit: Math.min(50, limit - rawPlaces.length),
            enrich: true,
          });

          if (result.success && result.results) {
            rawPlaces.push(...result.results);
            console.log(`[Pipeline] Found ${result.results.length} places in ${locationStr}`);
          }
        } catch (error) {
          console.error(`[Pipeline] Error searching ${locationStr}:`, error);
        }

        // Small delay between searches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.emitProgress('searching_maps', 'completed', `Found ${rawPlaces.length} businesses`, {
      placesFound: rawPlaces.length,
    });

    if (rawPlaces.length === 0) {
      return {
        jobId,
        prospects: [],
        totalFound: 0,
        enrichedCount: 0,
        contactsFoundCount: 0,
        validatedCount: 0,
        duration: Date.now() - startTime,
      };
    }

    // Phase 2: Parse to Prospects
    this.emitProgress('parsing_prospects', 'started', 'Parsing search results');
    console.log(`[Pipeline] Parsing ${rawPlaces.length} places to prospects`);

    const parseResult = await executeProspectParser({
      places: rawPlaces.slice(0, limit) as Array<{
        place_id: string;
        name: string;
        formatted_address?: string;
        website?: string;
        phone?: string;
        rating?: number;
        user_ratings_total?: number;
        types?: string[];
        business_status?: string;
        full_address?: string;
        detailed_rating?: number;
        detailed_review_count?: number;
      }>,
      deduplicate: true,
    });

    const parsedProspects = parseResult.prospects || [];
    this.emitProgress('parsing_prospects', 'completed', `Parsed ${parsedProspects.length} unique prospects`, {
      total: parsedProspects.length,
    });

    // Phase 3: Enrich Prospects (parallel batches)
    this.emitProgress('enriching_company', 'started', 'Starting company enrichment');
    console.log(`[Pipeline] Enriching ${parsedProspects.length} prospects in batches of ${this.parallelism}`);

    const enrichedProspects: unknown[] = [];
    let enrichedCount = 0;

    for (let i = 0; i < parsedProspects.length; i += this.parallelism) {
      const batch = parsedProspects.slice(i, i + this.parallelism);

      this.emitProgress('enriching_company', 'in_progress', `Enriching batch ${Math.floor(i / this.parallelism) + 1}`, {
        current: i,
        total: parsedProspects.length,
        enrichedCount,
      });

      try {
        const enrichResult = await executeCompanyEnricher({
          prospects: batch.map(p => ({
            id: p.id,
            company_name: p.company_name,
            domain: p.domain,
            website: p.website,
          })),
          maxProcess: this.parallelism,
          delayMs: 500,
        });

        if (enrichResult.success && enrichResult.prospects) {
          // Merge enriched data with parsed prospects
          for (const enrichedP of enrichResult.prospects) {
            const original = batch.find(p => p.id === enrichedP.id);
            if (original) {
              enrichedProspects.push({
                ...original,
                ...enrichedP,
              });
              if (enrichedP.enrichment_status !== 'failed') {
                enrichedCount++;
              }
            }
          }
        } else {
          // Keep original prospects if enrichment fails
          enrichedProspects.push(...batch);
        }
      } catch (error) {
        console.error(`[Pipeline] Error enriching batch:`, error);
        enrichedProspects.push(...batch);
      }
    }

    this.emitProgress('enriching_company', 'completed', `Enriched ${enrichedCount} prospects`, {
      enrichedCount,
    });

    // Phase 4: Smart Contact Extraction (AI-powered page discovery and extraction)
    this.emitProgress('finding_contacts', 'started', 'Starting AI-powered contact extraction');
    console.log(`[Pipeline] Smart contact extraction for ${enrichedProspects.length} prospects`);

    let contactsFoundCount = 0;
    const prospectsWithContacts: Array<Record<string, unknown>> = [];

    // Get target titles from ICP for better extraction
    const targetTitles = icp.decisionMakerTargeting?.primaryTitles || [
      'CEO', 'CTO', 'CFO', 'Founder', 'Owner', 'Director', 'VP', 'Head of',
    ];

    // Process prospects in batches for parallel contact extraction
    for (let i = 0; i < enrichedProspects.length; i += this.parallelism) {
      const batch = enrichedProspects.slice(i, i + this.parallelism);

      this.emitProgress('finding_contacts', 'in_progress', `Extracting contacts batch ${Math.floor(i / this.parallelism) + 1}`, {
        current: i,
        total: enrichedProspects.length,
        contactsFound: contactsFoundCount,
      });

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (p: unknown) => {
          const prospect = p as Record<string, unknown>;
          const website = prospect.website as string | undefined;
          const companyName = prospect.company_name as string;
          const domain = prospect.domain as string | undefined;

          // Only use smart extraction if we have a website
          if (website) {
            try {
              console.log(`[Pipeline] Smart extracting contacts for: ${companyName} (${website})`);

              const extractionResult = await executeSmartContactExtractor({
                website,
                company_name: companyName,
                domain,
                target_titles: targetTitles,
                use_perplexity: true,
                generate_email_patterns: true,
              });

              if (extractionResult.success && extractionResult.contacts.length > 0) {
                contactsFoundCount++;

                // Transform contacts to pipeline format
                const contacts = extractionResult.contacts.map((c: {
                  name: string;
                  title: string;
                  email?: string;
                  phone?: string;
                  linkedin_url?: string;
                  is_decision_maker: boolean;
                  confidence: number;
                  source_page: string;
                  is_primary?: boolean;
                  email_patterns?: string[];
                }) => ({
                  name: c.name,
                  title: c.title,
                  email: c.email,
                  phone: c.phone,
                  linkedin_url: c.linkedin_url,
                  email_patterns: c.email_patterns,
                  isPrimary: c.is_primary || false,
                  isDecisionMaker: c.is_decision_maker,
                  confidence: c.confidence,
                }));

                return {
                  ...prospect,
                  contacts,
                  contact_extraction_pages: extractionResult.pages_scraped_urls,
                };
              }
            } catch (error) {
              console.error(`[Pipeline] Smart extraction failed for ${companyName}:`, error);
            }
          }

          // Fallback to basic extraction if smart extraction fails or no website
          const contacts = this.extractContactsFromEnrichment(prospect);
          if (contacts.length > 0) contactsFoundCount++;

          return {
            ...prospect,
            contacts,
          };
        })
      );

      prospectsWithContacts.push(...batchResults);

      // Report progress for current prospect
      const lastProspect = batch[batch.length - 1] as Record<string, unknown> | undefined;
      if (lastProspect) {
        this.emitProgress('finding_contacts', 'in_progress', `Processed ${lastProspect.company_name}`, {
          current: Math.min(i + this.parallelism, enrichedProspects.length),
          total: enrichedProspects.length,
          contactsFound: contactsFoundCount,
          companyName: lastProspect.company_name as string,
        });
      }
    }

    this.emitProgress('finding_contacts', 'completed', `Found contacts for ${contactsFoundCount} prospects`, {
      contactsFound: contactsFoundCount,
    });

    // Phase 5: Validate Against ICP
    this.emitProgress('validating_icp', 'started', 'Validating prospects against ICP');
    console.log(`[Pipeline] Validating ${prospectsWithContacts.length} prospects against ICP`);

    const icpForValidation = this.formatICPForValidation(icp);

    const validationResult = await executeDataValidator({
      prospects: prospectsWithContacts.map((p: Record<string, unknown>) => {
        const address = p.address as Record<string, unknown> | undefined;
        return {
          id: String(p.id),
          company_name: String(p.company_name),
          domain: p.domain as string | undefined,
          website: p.website as string | undefined,
          industry: p.industry as string | undefined,
          address: address ? {
            city: address.city as string | undefined,
            state: address.state as string | undefined,
            country: address.country as string | undefined,
          } : undefined,
          contacts: (p.contacts as Array<{ email?: string; title?: string }>) || [],
          // Preserve additional fields for final transform
          rating: p.rating as number | undefined,
          review_count: p.review_count as number | undefined,
          phone: p.phone as string | undefined,
          source_id: p.source_id as string | undefined,
          company_summary: p.company_summary as string | undefined,
        };
      }),
      icp: icpForValidation,
      minScore: 0.3, // Lower threshold to include more prospects initially
    });

    const validCount = validationResult.valid_count || 0;
    const totalCount = validationResult.total_prospects || 0;
    const matchRate = totalCount > 0 ? Math.round((validCount / totalCount) * 100) : 0;

    this.emitProgress('validating_icp', 'completed',
      `${validCount} of ${totalCount} prospects passed ICP validation (${matchRate}% match rate)`, {
      total: totalCount,
    });

    // Phase 6: Save Results
    this.emitProgress('saving_results', 'started', 'Preparing final results');

    // Transform to final format
    const finalProspects: DiscoveredProspect[] = (validationResult.all_results || []).map((result: unknown) => {
      const r = result as { prospect: Record<string, unknown>; icp_score: number };
      const prospect = r.prospect;
      const address = prospect.address as Record<string, unknown> | undefined;

      return {
        id: String(prospect.id),
        companyName: String(prospect.company_name),
        website: prospect.website as string | undefined,
        industry: String(prospect.industry || 'Unknown'),
        location: {
          city: String(address?.city || ''),
          state: String(address?.state || ''),
          country: String(address?.country || 'USA'),
          address: address?.full as string | undefined,
        },
        googlePlaceId: prospect.source_id as string | undefined,
        rating: prospect.rating as number | undefined,
        reviewCount: prospect.review_count as number | undefined,
        description: prospect.company_summary as string | undefined,
        contacts: ((prospect.contacts as Array<Record<string, unknown>>) || []).map(c => ({
          id: `contact-${nanoid(8)}`,
          name: String(c.name || 'Unknown'),
          title: String(c.title || 'Unknown'),
          email: c.email as string | undefined,
          phone: c.phone as string | undefined,
          isPrimary: Boolean(c.isPrimary),
        })),
        icpMatchScore: r.icp_score || 0,
        status: 'new' as const,
      };
    });

    // Sort by ICP score
    finalProspects.sort((a, b) => b.icpMatchScore - a.icpMatchScore);

    this.emitProgress('saving_results', 'completed', `Discovery complete: ${finalProspects.length} prospects`, {
      total: finalProspects.length,
    });

    const duration = Date.now() - startTime;
    console.log(`[Pipeline] Discovery complete in ${duration}ms: ${finalProspects.length} prospects`);

    return {
      jobId,
      prospects: finalProspects,
      totalFound: rawPlaces.length,
      enrichedCount,
      contactsFoundCount,
      validatedCount: validationResult.valid_count || 0,
      duration,
    };
  }

  private extractContactsFromEnrichment(prospect: Record<string, unknown>): Array<{
    name: string;
    title: string;
    email?: string;
    phone?: string;
    isPrimary: boolean;
  }> {
    const contacts: Array<{
      name: string;
      title: string;
      email?: string;
      phone?: string;
      isPrimary: boolean;
    }> = [];

    // Extract from website content if available
    const websiteContent = prospect.website_content as string | undefined;
    const companySummary = prospect.company_summary as string | undefined;

    // Simple email extraction from website content
    if (websiteContent) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = websiteContent.match(emailRegex) || [];

      // Filter out generic emails
      const filteredEmails = emails.filter(email => {
        const lower = email.toLowerCase();
        return !lower.includes('example.com') &&
               !lower.includes('noreply') &&
               !lower.includes('support@') &&
               !lower.includes('info@') &&
               !lower.includes('sales@') &&
               !lower.includes('contact@');
      });

      if (filteredEmails.length > 0) {
        contacts.push({
          name: 'Contact',
          title: 'Unknown',
          email: filteredEmails[0],
          isPrimary: true,
        });
      }
    }

    // Add phone if available from Google Maps
    const phone = prospect.phone as string | undefined;
    if (phone && contacts.length === 0) {
      contacts.push({
        name: 'Main Contact',
        title: 'Unknown',
        phone,
        isPrimary: true,
      });
    }

    // If we found decision maker info in research, parse it
    if (companySummary) {
      // Look for CEO, Founder, Owner patterns
      const founderMatch = companySummary.match(/(?:founded by|CEO|founder)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
      if (founderMatch && contacts.length < 3) {
        contacts.push({
          name: founderMatch[1] || 'Unknown',
          title: 'Founder/CEO',
          isPrimary: contacts.length === 0,
        });
      }
    }

    return contacts;
  }

  private formatICPForValidation(icp: ICP): {
    industry_targeting?: { industries?: string[] };
    geographic_targeting?: { markets?: Array<{ city?: string; state?: string; country?: string }> };
    decision_maker_targeting?: { titles?: string[] };
  } {
    return {
      industry_targeting: {
        industries: icp.industryTargeting?.primaryIndustries?.map(i => i.name) || [],
      },
      geographic_targeting: {
        markets: icp.geographicTargeting?.primaryMarkets?.map(m => ({
          city: m.city,
          state: m.state,
          country: m.country,
        })) || [],
      },
      decision_maker_targeting: {
        titles: icp.decisionMakerTargeting?.primaryTitles || [],
      },
    };
  }
}
