import { describe, it, expect } from 'vitest';
import { safeGetHostname, isValidUrl } from './url';

describe('safeGetHostname', () => {
  it('extracts hostname from valid URL', () => {
    expect(safeGetHostname('https://example.com')).toBe('example.com');
    expect(safeGetHostname('https://www.example.com/path')).toBe('www.example.com');
    expect(safeGetHostname('http://subdomain.example.com:8080')).toBe('subdomain.example.com');
  });

  it('returns null for invalid URLs', () => {
    expect(safeGetHostname('not-a-url')).toBeNull();
    expect(safeGetHostname('')).toBeNull();
    expect(safeGetHostname('example.com')).toBeNull(); // No protocol
    expect(safeGetHostname('://invalid')).toBeNull();
  });

  it('handles edge cases', () => {
    expect(safeGetHostname('https://localhost')).toBe('localhost');
    expect(safeGetHostname('https://127.0.0.1')).toBe('127.0.0.1');
  });
});

describe('isValidUrl', () => {
  it('returns true for valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path?query=1')).toBe(true);
    expect(isValidUrl('https://sub.domain.example.com')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
    expect(isValidUrl('ftp://')).toBe(false);
  });
});
