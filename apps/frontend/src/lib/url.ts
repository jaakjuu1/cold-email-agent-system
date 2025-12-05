/**
 * Safely extracts hostname from a URL string.
 * Returns null if URL is invalid.
 */
export function safeGetHostname(urlString: string): string | null {
  try {
    return new URL(urlString).hostname;
  } catch {
    return null;
  }
}

/**
 * Checks if a string is a valid URL.
 */
export function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}
