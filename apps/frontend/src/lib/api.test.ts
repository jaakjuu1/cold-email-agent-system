import { describe, it, expect, vi } from 'vitest';

// Mock axios before importing
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

describe('API Module', () => {
  it('should export API client', async () => {
    const apiModule = await import('./api');
    expect(apiModule.api).toBeDefined();
  });

  it('should export clientsApi methods', async () => {
    const apiModule = await import('./api');
    expect(apiModule.clientsApi).toBeDefined();
    expect(typeof apiModule.clientsApi.create).toBe('function');
    expect(typeof apiModule.clientsApi.get).toBe('function');
    expect(typeof apiModule.clientsApi.list).toBe('function');
  });

  it('should export campaignsApi methods', async () => {
    const apiModule = await import('./api');
    expect(apiModule.campaignsApi).toBeDefined();
    expect(typeof apiModule.campaignsApi.create).toBe('function');
    expect(typeof apiModule.campaignsApi.get).toBe('function');
    expect(typeof apiModule.campaignsApi.list).toBe('function');
  });

  it('should export prospectsApi methods', async () => {
    const apiModule = await import('./api');
    expect(apiModule.prospectsApi).toBeDefined();
    expect(typeof apiModule.prospectsApi.get).toBe('function');
    expect(typeof apiModule.prospectsApi.list).toBe('function');
    expect(typeof apiModule.prospectsApi.updateStatus).toBe('function');
  });

  it('should export analyticsApi methods', async () => {
    const apiModule = await import('./api');
    expect(apiModule.analyticsApi).toBeDefined();
    expect(typeof apiModule.analyticsApi.getDashboard).toBe('function');
    expect(typeof apiModule.analyticsApi.getCampaign).toBe('function');
  });
});

