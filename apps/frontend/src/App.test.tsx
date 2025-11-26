import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('should have working test environment', () => {
    expect(1 + 1).toBe(2);
  });

  it('should be able to import React', async () => {
    const React = await import('react');
    expect(React.version).toBeDefined();
  });
});

