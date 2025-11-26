/**
 * Bounce Detector Listener
 * Handles email bounce notifications and updates prospect status
 */

interface BounceEvent {
  type: 'email_bounce';
  campaignId: string;
  prospectId: string;
  emailId: string;
  bounceType: 'hard' | 'soft';
  reason: string;
  bouncedAt: string;
}

interface BounceAnalysis {
  isHardBounce: boolean;
  category: string;
  shouldRetry: boolean;
  retryDelay?: number;
  actions: string[];
}

/**
 * Analyze bounce reason and determine appropriate action
 */
function analyzeBounce(bounceType: string, reason: string): BounceAnalysis {
  const reasonLower = reason.toLowerCase();

  // Hard bounce indicators - permanent failures
  const hardBouncePatterns = [
    /user (unknown|not found|doesn'?t exist)/i,
    /mailbox (not found|unavailable|does not exist)/i,
    /invalid (address|recipient|mailbox)/i,
    /no such user/i,
    /recipient rejected/i,
    /address rejected/i,
    /domain not found/i,
    /550/i, // SMTP permanent failure
  ];

  // Soft bounce indicators - temporary failures
  const softBouncePatterns = [
    /mailbox full/i,
    /quota exceeded/i,
    /try again later/i,
    /temporary/i,
    /421/i, // SMTP temporary failure
    /452/i, // Insufficient storage
    /connection (timed out|refused)/i,
    /server (busy|unavailable)/i,
  ];

  // Check for hard bounce
  const isHardBounce =
    bounceType === 'hard' ||
    hardBouncePatterns.some((pattern) => pattern.test(reasonLower));

  // Determine category
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
 * Track bounce metrics for domain reputation
 */
function updateBounceMetrics(
  domain: string,
  isHardBounce: boolean
): { shouldAlert: boolean; message?: string } {
  // In production, this would update a metrics store
  // and check for domain-level issues

  // For now, just log
  console.log(`Bounce metric: ${domain} - ${isHardBounce ? 'hard' : 'soft'}`);

  return { shouldAlert: false };
}

/**
 * Process a bounce event
 */
export async function processBounce(event: BounceEvent): Promise<{
  analysis: BounceAnalysis;
  domainStatus: { shouldAlert: boolean; message?: string };
}> {
  // Analyze the bounce
  const analysis = analyzeBounce(event.bounceType, event.reason);

  // Extract domain from prospect ID or email (would need to look up)
  const domain = 'example.com'; // Placeholder
  const domainStatus = updateBounceMetrics(domain, analysis.isHardBounce);

  return { analysis, domainStatus };
}

/**
 * Main listener handler
 */
export async function handleBounceEvent(event: BounceEvent): Promise<void> {
  console.log(`Processing bounce for: ${event.prospectId}`);
  console.log(`Type: ${event.bounceType}`);
  console.log(`Reason: ${event.reason}`);

  const result = await processBounce(event);

  console.log(`Category: ${result.analysis.category}`);
  console.log(`Hard bounce: ${result.analysis.isHardBounce}`);
  console.log(`Should retry: ${result.analysis.shouldRetry}`);
  console.log(`Actions: ${result.analysis.actions.join(', ')}`);

  if (result.domainStatus.shouldAlert) {
    console.log(`⚠️ Domain alert: ${result.domainStatus.message}`);
  }
}

// Export for use in agent system
export default {
  name: 'bounce-detector',
  description: 'Handles email bounce notifications',
  handler: handleBounceEvent,
};

