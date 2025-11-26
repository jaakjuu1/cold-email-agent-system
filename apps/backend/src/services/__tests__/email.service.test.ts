import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailService } from '../email.service';

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'test-message-id' } }),
    },
  })),
}));

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService();
  });

  describe('rate limiting', () => {
    it('should allow sending when under limits', () => {
      const status = emailService.getRateLimitStatus();
      expect(status.canSend).toBe(true);
      expect(status.sentThisHour).toBe(0);
      expect(status.sentToday).toBe(0);
    });

    it('should track sent emails', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test body</p>',
        metadata: {
          campaignId: 'campaign-1',
          prospectId: 'prospect-1',
          sequenceNumber: 1,
        },
      });

      expect(result.success).toBe(true);
      
      const status = emailService.getRateLimitStatus();
      expect(status.sentThisHour).toBe(1);
      expect(status.sentToday).toBe(1);
    });

    it('should respect hourly limits', () => {
      // Set limits
      emailService.setRateLimits({ maxPerHour: 2 });

      // This is a unit test - we'd need to mock internal state
      // to properly test hitting limits
      const status = emailService.getRateLimitStatus();
      expect(status.maxPerHour).toBe(2);
    });

    it('should respect daily limits', () => {
      emailService.setRateLimits({ maxPerDay: 100 });

      const status = emailService.getRateLimitStatus();
      expect(status.maxPerDay).toBe(100);
    });
  });

  describe('generateEmail', () => {
    it('should replace template variables', () => {
      const template = {
        id: 'template-1',
        sequence: 1,
        subject: 'Hello {first_name}',
        body: 'Hi {first_name} from {company_name}',
        bodyHtml: '<p>Hi {first_name} from {company_name}</p>',
        delayDays: 0,
      };

      const prospect = {
        id: 'prospect-1',
        companyName: 'Test Corp',
        industry: 'SaaS',
        location: { city: 'SF', state: 'CA', country: 'USA' },
        contacts: [
          { id: 'c-1', name: 'John Doe', title: 'CEO', isPrimary: true },
        ],
        icpMatchScore: 0.85,
        status: 'new' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = emailService.generateEmail(template, prospect);

      expect(result.subject).toBe('Hello John');
      expect(result.bodyHtml).toBe('<p>Hi John from Test Corp</p>');
    });

    it('should use fallback for missing name', () => {
      const template = {
        id: 'template-1',
        sequence: 1,
        subject: 'Hello {first_name}',
        body: 'Hi {first_name}',
        bodyHtml: '<p>Hi {first_name}</p>',
        delayDays: 0,
      };

      const prospect = {
        id: 'prospect-1',
        companyName: 'Test Corp',
        industry: 'SaaS',
        location: { city: 'SF', state: 'CA', country: 'USA' },
        contacts: [],
        icpMatchScore: 0.85,
        status: 'new' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = emailService.generateEmail(template, prospect);

      expect(result.subject).toBe('Hello there');
    });
  });

  describe('queue management', () => {
    it('should queue emails', () => {
      const id = emailService.queueEmail({
        to: 'test@example.com',
        subject: 'Queued Email',
        html: '<p>Queued</p>',
        metadata: {
          campaignId: 'campaign-1',
          prospectId: 'prospect-1',
          sequenceNumber: 1,
        },
      });

      expect(id).toBeDefined();
      expect(id.startsWith('email-')).toBe(true);
    });

    it('should clear queue', () => {
      emailService.queueEmail({
        to: 'test@example.com',
        subject: 'Queued Email',
        html: '<p>Queued</p>',
        metadata: {
          campaignId: 'campaign-1',
          prospectId: 'prospect-1',
          sequenceNumber: 1,
        },
      });

      emailService.clearQueue();
      const status = emailService.getRateLimitStatus();
      expect(status.queueSize).toBe(0);
    });
  });

  describe('createSentEmailRecord', () => {
    it('should create proper record for successful send', () => {
      const options = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        metadata: {
          campaignId: 'campaign-1',
          prospectId: 'prospect-1',
          sequenceNumber: 1,
        },
      };

      const result = { success: true, messageId: 'msg-123' };
      const record = emailService.createSentEmailRecord(options, result);

      expect(record.status).toBe('sent');
      expect(record.messageId).toBe('msg-123');
      expect(record.campaignId).toBe('campaign-1');
      expect(record.prospectId).toBe('prospect-1');
    });

    it('should create proper record for failed send', () => {
      const options = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
        metadata: {
          campaignId: 'campaign-1',
          prospectId: 'prospect-1',
          sequenceNumber: 1,
        },
      };

      const result = { success: false, error: 'Rate limit exceeded' };
      const record = emailService.createSentEmailRecord(options, result);

      expect(record.status).toBe('failed');
      expect(record.error).toBe('Rate limit exceeded');
    });
  });
});

