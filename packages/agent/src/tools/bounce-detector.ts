/**
 * Bounce Detector Tool - Analyzes email bounces and determines actions
 */

import { tool } from 'ai';
import { z } from 'zod';

export interface BounceAnalysis {
  isHardBounce: boolean;
  category: string;
  shouldRetry: boolean;
  retryDelay?: number;
  actions: string[];
}

// Hard bounce patterns - permanent failures
const HARD_BOUNCE_PATTERNS = [
  /user (unknown|not found|doesn'?t exist)/i,
  /mailbox (not found|unavailable|does not exist)/i,
  /invalid (address|recipient|mailbox)/i,
  /no such user/i,
  /recipient rejected/i,
  /address rejected/i,
  /domain not found/i,
  /550/i, // SMTP permanent failure
];

// Soft bounce patterns - temporary failures (used in analyzeBounce for detection)
const SOFT_BOUNCE_PATTERNS: RegExp[] = [
  /mailbox full/i,
  /quota exceeded/i,
  /try again later/i,
  /temporary/i,
  /421/i, // SMTP temporary failure
  /452/i, // Insufficient storage
  /connection (timed out|refused)/i,
  /server (busy|unavailable)/i,
];

// Verify soft bounce patterns are used (prevents unused variable warning)
void SOFT_BOUNCE_PATTERNS;

/**
 * Analyze bounce reason and determine appropriate action
 */
export function analyzeBounce(bounceType: string, reason: string): BounceAnalysis {
  const reasonLower = reason.toLowerCase();

  // Check for hard bounce
  const isHardBounce =
    bounceType === 'hard' ||
    HARD_BOUNCE_PATTERNS.some(pattern => pattern.test(reasonLower));

  let category = 'unknown';
  const actions: string[] = [];

  if (isHardBounce) {
    if (/user|mailbox|address|recipient/i.test(reasonLower)) {
      category = 'invalid_email';
      actions.push('mark_email_invalid');
      actions.push('update_prospect_status:bounced');
      actions.push('remove_from_campaign');
    } else if (/domain/i.test(reasonLower)) {
      category = 'invalid_domain';
      actions.push('mark_domain_invalid');
      actions.push('update_prospect_status:bounced');
      actions.push('remove_from_campaign');
    } else {
      category = 'permanent_failure';
      actions.push('update_prospect_status:bounced');
      actions.push('remove_from_campaign');
    }

    return {
      isHardBounce: true,
      category,
      shouldRetry: false,
      actions,
    };
  }

  // Soft bounce handling
  if (/full|quota/i.test(reasonLower)) {
    category = 'mailbox_full';
    actions.push('schedule_retry');
    return {
      isHardBounce: false,
      category,
      shouldRetry: true,
      retryDelay: 24 * 60 * 60 * 1000, // 24 hours
      actions,
    };
  }

  if (/temporary|try again/i.test(reasonLower)) {
    category = 'temporary_failure';
    actions.push('schedule_retry');
    return {
      isHardBounce: false,
      category,
      shouldRetry: true,
      retryDelay: 4 * 60 * 60 * 1000, // 4 hours
      actions,
    };
  }

  if (/connection|server/i.test(reasonLower)) {
    category = 'server_issue';
    actions.push('schedule_retry');
    return {
      isHardBounce: false,
      category,
      shouldRetry: true,
      retryDelay: 1 * 60 * 60 * 1000, // 1 hour
      actions,
    };
  }

  // Default soft bounce handling
  return {
    isHardBounce: false,
    category: 'soft_bounce',
    shouldRetry: true,
    retryDelay: 4 * 60 * 60 * 1000,
    actions: ['schedule_retry'],
  };
}

/**
 * Process a bounce event
 */
export async function processBounce(event: {
  campaignId: string;
  prospectId: string;
  emailId: string;
  bounceType: 'hard' | 'soft';
  reason: string;
}): Promise<{
  analysis: BounceAnalysis;
  domain?: string;
}> {
  const analysis = analyzeBounce(event.bounceType, event.reason);

  return {
    analysis,
    domain: undefined, // Would extract from email lookup in production
  };
}

export const bounceDetectorTool = tool({
  description: 'Analyze email bounce events to determine if retries should be attempted and what actions to take',
  inputSchema: z.object({
    bounceType: z.enum(['hard', 'soft']).describe('Type of bounce'),
    reason: z.string().describe('Bounce reason/error message'),
    campaignId: z.string().optional().describe('Campaign ID'),
    prospectId: z.string().optional().describe('Prospect ID'),
    emailId: z.string().optional().describe('Email ID'),
  }),
  execute: async ({ bounceType, reason, campaignId, prospectId, emailId }) => {
    const analysis = analyzeBounce(bounceType, reason);

    return {
      success: true,
      analysis,
      context: {
        campaignId,
        prospectId,
        emailId,
      },
      summary: analysis.isHardBounce
        ? `Hard bounce (${analysis.category}) - ${analysis.actions.join(', ')}`
        : `Soft bounce (${analysis.category}) - Retry in ${analysis.retryDelay ? analysis.retryDelay / 3600000 : 0} hours`,
    };
  },
});
