/**
 * Prospect Parser Tool - Transforms Google Maps results into prospect format
 */

import { tool } from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  website?: string;
  phone?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
  detailed_rating?: number;
  detailed_review_count?: number;
  full_address?: string;
}

interface ParsedProspect {
  id: string;
  company_name: string;
  domain?: string;
  website?: string;
  phone?: string;
  address: {
    full: string;
    city?: string;
    state?: string;
    country?: string;
  };
  industry?: string;
  rating?: number;
  review_count?: number;
  business_status?: string;
  source: string;
  source_id: string;
}

function extractDomain(website?: string): string | undefined {
  if (!website) return undefined;

  try {
    const url = new URL(website);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function parseAddress(fullAddress?: string): {
  full: string;
  city?: string;
  state?: string;
  country?: string;
} {
  if (!fullAddress) {
    return { full: '' };
  }

  const parts = fullAddress.split(',').map(p => p.trim());

  // Simple parsing for US addresses: "Street, City, State ZIP, Country"
  if (parts.length >= 3) {
    const stateZipPart = parts[parts.length - 2] || '';
    const stateMatch = stateZipPart.match(/^([A-Z]{2})\s+\d{5}/);

    return {
      full: fullAddress,
      city: parts[parts.length - 3],
      state: stateMatch ? stateMatch[1] : undefined,
      country: parts[parts.length - 1] || 'USA',
    };
  }

  return { full: fullAddress };
}

function inferIndustry(types?: string[]): string | undefined {
  if (!types || types.length === 0) return undefined;

  // Map Google place types to industries
  const typeMap: Record<string, string> = {
    'restaurant': 'Food & Beverage',
    'cafe': 'Food & Beverage',
    'bar': 'Food & Beverage',
    'store': 'Retail',
    'clothing_store': 'Retail',
    'electronics_store': 'Retail',
    'health': 'Healthcare',
    'doctor': 'Healthcare',
    'dentist': 'Healthcare',
    'gym': 'Fitness',
    'spa': 'Wellness',
    'beauty_salon': 'Beauty',
    'hair_care': 'Beauty',
    'real_estate_agency': 'Real Estate',
    'lawyer': 'Legal Services',
    'accounting': 'Financial Services',
    'bank': 'Financial Services',
    'car_dealer': 'Automotive',
    'car_repair': 'Automotive',
    'lodging': 'Hospitality',
    'travel_agency': 'Travel',
    'school': 'Education',
    'university': 'Education',
  };

  for (const type of types) {
    if (typeMap[type]) {
      return typeMap[type];
    }
  }

  return undefined;
}

function parseProspect(place: PlaceResult): ParsedProspect {
  const website = place.website;
  const domain = extractDomain(website);
  const address = parseAddress(place.full_address || place.formatted_address);

  return {
    id: `prospect-${nanoid(10)}`,
    company_name: place.name,
    domain,
    website,
    phone: place.phone,
    address,
    industry: inferIndustry(place.types),
    rating: place.detailed_rating || place.rating,
    review_count: place.detailed_review_count || place.user_ratings_total,
    business_status: place.business_status,
    source: 'google_maps',
    source_id: place.place_id,
  };
}

function deduplicateProspects(prospects: ParsedProspect[]): ParsedProspect[] {
  const seen = new Set<string>();
  const unique: ParsedProspect[] = [];

  for (const prospect of prospects) {
    // Use domain or company name as dedup key
    const key = prospect.domain || prospect.company_name.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(prospect);
    }
  }

  return unique;
}

// Place type for execute function
interface PlaceInput {
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
}

// Standalone execute function for direct use in pipelines
export async function executeProspectParser({
  places,
  deduplicate = true,
}: {
  places: PlaceInput[];
  deduplicate?: boolean;
}) {
  // Parse all places
  let prospects = places.map(parseProspect);

  // Deduplicate if requested
  if (deduplicate) {
    const originalCount = prospects.length;
    prospects = deduplicateProspects(prospects);
    const duplicatesRemoved = originalCount - prospects.length;

    return {
      success: true as const,
      total_prospects: prospects.length,
      duplicates_removed: duplicatesRemoved,
      prospects,
    };
  }

  return {
    success: true as const,
    total_prospects: prospects.length,
    duplicates_removed: 0,
    prospects,
  };
}

export const prospectParserTool = tool({
  description: 'Parse Google Maps search results into structured prospect format with deduplication',
  inputSchema: z.object({
    places: z.array(z.object({
      place_id: z.string(),
      name: z.string(),
      formatted_address: z.string().optional(),
      website: z.string().optional(),
      phone: z.string().optional(),
      rating: z.number().optional(),
      user_ratings_total: z.number().optional(),
      types: z.array(z.string()).optional(),
      business_status: z.string().optional(),
      full_address: z.string().optional(),
      detailed_rating: z.number().optional(),
      detailed_review_count: z.number().optional(),
    })).describe('Array of Google Maps place results'),
    deduplicate: z.boolean().default(true).describe('Whether to remove duplicate prospects'),
  }),
  execute: async ({ places, deduplicate }) => {
    // Parse all places
    let prospects = places.map(parseProspect);

    // Deduplicate if requested
    if (deduplicate) {
      const originalCount = prospects.length;
      prospects = deduplicateProspects(prospects);
      const duplicatesRemoved = originalCount - prospects.length;

      return {
        success: true,
        total_prospects: prospects.length,
        duplicates_removed: duplicatesRemoved,
        prospects,
      };
    }

    return {
      success: true,
      total_prospects: prospects.length,
      duplicates_removed: 0,
      prospects,
    };
  },
});
