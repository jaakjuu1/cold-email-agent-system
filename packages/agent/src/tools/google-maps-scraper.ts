/**
 * Google Maps Scraper Tool - Search for businesses using Google Maps Places API
 */

import { tool } from 'ai';
import { z } from 'zod';
import { sanitizeUrl } from '../utils/url.js';

const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place';

// Structured logging helper
function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'GoogleMapsScraper',
    event,
    ...data,
  }));
}

/**
 * Generate query variations to increase hit rate
 * Tries multiple formats since Google Maps can be picky about query structure
 */
function generateQueryVariations(industry: string, location: string): string[] {
  // Remove common suffixes to get base term
  const baseTerm = industry.replace(/\s+(company|companies|services?|business(es)?|firms?)$/i, '').trim();

  return [
    // Most specific first
    `${baseTerm} companies in ${location}`,
    `${baseTerm} company in ${location}`,
    `${industry} in ${location}`,
    `${baseTerm} services in ${location}`,
    `${baseTerm} ${location}`,
    `${baseTerm} near ${location}`,
    // Try with "contractor" for construction-like industries
    ...(baseTerm.toLowerCase().includes('construct') ? [
      `${baseTerm} contractor in ${location}`,
      `building contractor in ${location}`,
      `general contractor in ${location}`,
    ] : []),
  ];
}

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  business_status?: string;
  website?: string;
  phone?: string;
  full_address?: string;
  detailed_rating?: number;
  detailed_review_count?: number;
}

interface SearchResponse {
  status: string;
  results: PlaceResult[];
  next_page_token?: string;
}

interface DetailsResponse {
  status: string;
  result?: {
    name: string;
    formatted_address: string;
    formatted_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
    business_status?: string;
  };
}

/**
 * Search for places with a specific query string
 * Returns results from Google Maps Text Search API
 */
async function searchPlacesWithQuery(
  fullQuery: string,
  apiKey: string,
  limit = 50
): Promise<PlaceResult[]> {
  const results: PlaceResult[] = [];
  let nextPageToken: string | undefined;
  let pageNum = 1;

  while (results.length < limit) {
    const params = new URLSearchParams({
      query: fullQuery,
      key: apiKey,
      // Note: Removed 'type: establishment' as it can filter out valid results
    });

    if (nextPageToken) {
      params.set('pagetoken', nextPageToken);
      // Google requires a short delay before using pagetoken
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    log('search_request', {
      query: fullQuery,
      page: pageNum,
      hasPageToken: !!nextPageToken,
    });

    const response = await fetch(`${PLACES_API_URL}/textsearch/json?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      log('search_error', {
        query: fullQuery,
        httpStatus: response.status,
        error: errorText,
      });
      throw new Error(`Google Maps API error: ${errorText}`);
    }

    const data = await response.json() as SearchResponse & { error_message?: string };

    log('search_response', {
      query: fullQuery,
      page: pageNum,
      status: data.status,
      resultsCount: data.results?.length || 0,
      hasNextPage: !!data.next_page_token,
      errorMessage: data.error_message,
    });

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      if (data.status === 'OVER_QUERY_LIMIT') {
        log('quota_exceeded', { query: fullQuery });
        break;
      }
      throw new Error(`API error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    }

    results.push(...data.results);
    nextPageToken = data.next_page_token;
    pageNum++;

    if (!nextPageToken || data.results.length === 0) {
      break;
    }
  }

  return results.slice(0, limit);
}

/**
 * Search for places trying multiple query variations until results are found
 * This increases hit rate for various location/industry combinations
 */
async function searchPlaces(
  industry: string,
  location: string,
  apiKey: string,
  limit = 50
): Promise<PlaceResult[]> {
  const queryVariations = generateQueryVariations(industry, location);

  log('search_start', {
    industry,
    location,
    limit,
    queryVariationsCount: queryVariations.length,
    queryVariations,
  });

  for (const query of queryVariations) {
    try {
      const results = await searchPlacesWithQuery(query, apiKey, limit);

      if (results.length > 0) {
        log('search_success', {
          successfulQuery: query,
          resultsCount: results.length,
        });
        return results;
      }

      // Small delay between query variations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      log('query_variation_error', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue to next variation unless it's a critical error
      if (error instanceof Error && error.message.includes('OVER_QUERY_LIMIT')) {
        throw error;
      }
    }
  }

  log('search_no_results', {
    industry,
    location,
    triedQueries: queryVariations,
  });

  return [];
}

async function getPlaceDetails(placeId: string, apiKey: string): Promise<PlaceResult | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields: 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,types,business_status',
  });

  const response = await fetch(`${PLACES_API_URL}/details/json?${params}`);

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as DetailsResponse;

  if (data.status !== 'OK' || !data.result) {
    return null;
  }

  return {
    place_id: placeId,
    name: data.result.name,
    full_address: data.result.formatted_address,
    phone: data.result.formatted_phone_number,
    website: data.result.website ? sanitizeUrl(data.result.website) : undefined,
    detailed_rating: data.result.rating,
    detailed_review_count: data.result.user_ratings_total,
    business_status: data.result.business_status,
  };
}

async function enrichResults(
  results: PlaceResult[],
  apiKey: string,
  maxDetails = 50  // Increased from 20 to match typical limit
): Promise<PlaceResult[]> {
  const enriched: PlaceResult[] = [];
  let websitesFound = 0;

  console.log(`[GoogleMaps] Enriching ${Math.min(results.length, maxDetails)} of ${results.length} results with Place Details`);

  for (let i = 0; i < Math.min(results.length, maxDetails); i++) {
    const place = results[i];
    if (!place) continue;

    const placeId = place.place_id;

    if (!placeId) {
      enriched.push(place);
      continue;
    }

    const details = await getPlaceDetails(placeId, apiKey);

    if (details) {
      if (details.website) {
        websitesFound++;
      }
      enriched.push({
        ...place,
        website: details.website,
        phone: details.phone,
        full_address: details.full_address,
        business_status: details.business_status,
        detailed_rating: details.detailed_rating,
        detailed_review_count: details.detailed_review_count,
      });
    } else {
      enriched.push(place);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Add remaining results without enrichment
  if (results.length > maxDetails) {
    console.log(`[GoogleMaps] Warning: ${results.length - maxDetails} results not enriched (no website data)`);
  }
  enriched.push(...results.slice(maxDetails));

  console.log(`[GoogleMaps] Enrichment complete: ${websitesFound} websites found out of ${enriched.length} total results`);

  return enriched;
}

// Standalone execute function for direct use in pipelines
export async function executeGoogleMapsScraper({
  location,
  industry,
  limit = 50,
  enrich = true,
}: {
  location: string;
  industry: string;
  limit?: number;
  enrich?: boolean;
}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return {
      success: false as const,
      error: 'GOOGLE_MAPS_API_KEY not configured',
    };
  }

  try {
    // Search for places
    let results = await searchPlaces(industry, location, apiKey, limit);

    // Optionally enrich with details (pass limit to ensure all results get enriched)
    if (enrich) {
      results = await enrichResults(results, apiKey, limit);
    }

    return {
      success: true as const,
      query: { location, industry, limit },
      total_results: results.length,
      results,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const googleMapsScraperTool = tool({
  description: 'Search Google Maps for businesses matching specific criteria in a location',
  inputSchema: z.object({
    location: z.string().describe('Location to search (e.g., "San Francisco, CA")'),
    industry: z.string().describe('Industry/business type to search for'),
    limit: z.number().default(50).describe('Maximum number of results'),
    enrich: z.boolean().default(true).describe('Whether to fetch detailed info for each result'),
  }),
  execute: async ({ location, industry, limit, enrich }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: 'GOOGLE_MAPS_API_KEY not configured',
      };
    }

    try {
      // Search for places
      let results = await searchPlaces(industry, location, apiKey, limit);

      // Optionally enrich with details
      if (enrich) {
        results = await enrichResults(results, apiKey);
      }

      return {
        success: true,
        query: {
          location,
          industry,
          limit,
        },
        total_results: results.length,
        results,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
