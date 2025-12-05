/**
 * URL Sanitization Utilities
 * Cleans tracking parameters and normalizes URLs for consistent processing
 */

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'msclkid', 'dclid', 'zanpid', 'ref', 'source',
  'mc_cid', 'mc_eid', 'yclid', 'twclid', 'li_fat_id', 'igshid',
  '_ga', '_gl', '_hsenc', '_hsmi', 'hsa_acc', 'hsa_cam', 'hsa_grp',
  'hsa_ad', 'hsa_src', 'hsa_tgt', 'hsa_kw', 'hsa_mt', 'hsa_net', 'hsa_ver',
];

/**
 * Remove tracking parameters and normalize URL
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove tracking parameters
    TRACKING_PARAMS.forEach(param => parsed.searchParams.delete(param));

    // Remove fragments
    parsed.hash = '';

    // Clean path (remove trailing slash except for root)
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return url; // Return original if invalid
  }
}

/**
 * Normalize website URL - ensure protocol and clean
 */
export function normalizeWebsiteUrl(url: string): string {
  if (!url) return url;

  let clean = url.trim();

  // Ensure protocol
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }

  return sanitizeUrl(clean);
}

/**
 * Extract base domain from URL
 */
export function getBaseDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deduplicate URLs by their sanitized form
 */
export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of urls) {
    const sanitized = sanitizeUrl(url);
    if (!seen.has(sanitized)) {
      seen.add(sanitized);
      result.push(sanitized);
    }
  }

  return result;
}
