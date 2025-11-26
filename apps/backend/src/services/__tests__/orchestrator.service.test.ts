import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorService } from '../orchestrator.service';

describe('OrchestratorService', () => {
  let service: OrchestratorService;

  beforeEach(() => {
    service = new OrchestratorService();
  });

  describe('Client Operations', () => {
    it('should create a client', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      expect(client).toBeDefined();
      expect(client.id).toBeDefined();
      expect(client.id.startsWith('client-')).toBe(true);
      expect(client.name).toBe('Test Company');
      expect(client.website).toBe('https://test.com');
    });

    it('should get a client by id', async () => {
      const created = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      const client = await service.getClient(created.id);

      expect(client).toBeDefined();
      expect(client?.id).toBe(created.id);
    });

    it('should update a client', async () => {
      const created = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      const updated = await service.updateClient(created.id, {
        name: 'Updated Company',
      });

      expect(updated.name).toBe('Updated Company');
      expect(updated.website).toBe('https://test.com');
    });

    it('should delete a client', async () => {
      const created = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      await service.deleteClient(created.id);
      const client = await service.getClient(created.id);

      expect(client).toBeUndefined();
    });

    it('should list all clients', async () => {
      await service.createClient({ name: 'Client 1', website: 'https://c1.com' });
      await service.createClient({ name: 'Client 2', website: 'https://c2.com' });

      const clients = await service.listClients();

      expect(clients.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ICP Operations', () => {
    it('should discover client and generate ICP', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      const icp = await service.discoverClient(client.id, 'https://test.com');

      expect(icp).toBeDefined();
      expect(icp.clientId).toBe(client.id);
      expect(icp.icpSummary).toBeDefined();
      expect(icp.firmographicCriteria).toBeDefined();
      expect(icp.geographicTargeting).toBeDefined();
    });

    it('should get client ICP', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      await service.discoverClient(client.id, 'https://test.com');
      const icp = await service.getClientICP(client.id);

      expect(icp).toBeDefined();
      expect(icp?.status).toBe('draft');
    });

    it('should approve ICP', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      await service.discoverClient(client.id, 'https://test.com');
      const approved = await service.approveClientICP(client.id);

      expect(approved.status).toBe('approved');
    });
  });

  describe('Campaign Operations', () => {
    it('should create a campaign', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      const campaign = await service.createCampaign({
        clientId: client.id,
        name: 'Test Campaign',
        prospectIds: ['prospect-1', 'prospect-2'],
      });

      expect(campaign).toBeDefined();
      expect(campaign.id.startsWith('campaign-')).toBe(true);
      expect(campaign.status).toBe('draft');
      expect(campaign.prospectIds).toHaveLength(2);
    });

    it('should start a campaign', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      const campaign = await service.createCampaign({
        clientId: client.id,
        name: 'Test Campaign',
        prospectIds: [],
      });

      const started = await service.startCampaign(campaign.id);

      expect(started.status).toBe('active');
    });

    it('should pause a campaign', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      const campaign = await service.createCampaign({
        clientId: client.id,
        name: 'Test Campaign',
        prospectIds: [],
      });

      await service.startCampaign(campaign.id);
      const paused = await service.pauseCampaign(campaign.id);

      expect(paused.status).toBe('paused');
    });

    it('should list campaigns with filters', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      await service.createCampaign({
        clientId: client.id,
        name: 'Draft Campaign',
        prospectIds: [],
      });

      const campaign2 = await service.createCampaign({
        clientId: client.id,
        name: 'Active Campaign',
        prospectIds: [],
      });
      await service.startCampaign(campaign2.id);

      const drafts = await service.listCampaigns({ status: 'draft' });
      const active = await service.listCampaigns({ status: 'active' });

      expect(drafts.some((c) => c.name === 'Draft Campaign')).toBe(true);
      expect(active.some((c) => c.name === 'Active Campaign')).toBe(true);
    });
  });

  describe('Prospect Operations', () => {
    it('should list prospects with pagination', async () => {
      const result = await service.listProspects({ page: 1, pageSize: 10 });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should start lead discovery', async () => {
      const client = await service.createClient({
        name: 'Test Company',
        website: 'https://test.com',
      });

      const result = await service.discoverLeads({
        clientId: client.id,
        locations: [{ city: 'San Francisco', state: 'CA', country: 'USA' }],
        industries: ['SaaS'],
      });

      expect(result.jobId).toBeDefined();
      expect(result.message).toBe('Lead discovery started');
    });
  });

  describe('Email Tracking Operations', () => {
    it('should mark email as delivered', async () => {
      // This test would need a pre-seeded email to test properly
      // In a real scenario, we'd create an email first
      const result = await service.markEmailDelivered(
        'test-message-id',
        new Date().toISOString()
      );

      // Since no email exists, this should return undefined
      expect(result).toBeUndefined();
    });
  });
});

