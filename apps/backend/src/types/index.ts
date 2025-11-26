// Re-export shared types
export * from '@cold-outreach/shared';

// Backend-specific types
export interface JobResult {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: unknown;
  error?: string;
}

export interface QueuedEmail {
  id: string;
  campaignId: string;
  prospectId: string;
  contactId: string;
  sequence: number;
  subject: string;
  body: string;
  scheduledAt: string;
  priority: number;
}

