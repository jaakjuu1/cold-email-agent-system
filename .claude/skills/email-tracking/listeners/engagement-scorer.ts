/**
 * Engagement Scorer Listener
 * Calculates engagement scores for prospects based on email interactions
 */

interface EngagementEvent {
  type: 'email_sent' | 'email_delivered' | 'email_opened' | 'email_clicked' | 'email_replied';
  campaignId: string;
  prospectId: string;
  emailId: string;
  timestamp: string;
  metadata?: {
    link?: string;
    userAgent?: string;
    ip?: string;
    openCount?: number;
  };
}

interface EngagementScore {
  score: number;
  level: 'hot' | 'warm' | 'cold' | 'unengaged';
  signals: string[];
  lastActivity: string;
  recommendedAction: string;
}

interface ProspectEngagement {
  prospectId: string;
  campaignId: string;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  uniqueOpens: number;
  uniqueClicks: number;
  lastOpenAt?: string;
  lastClickAt?: string;
  lastReplyAt?: string;
}

// Engagement weights
const WEIGHTS = {
  open: 10,
  uniqueOpen: 15,
  click: 25,
  uniqueClick: 30,
  reply: 50,
  recentActivity: 10, // Bonus for recent activity
  multipleOpens: 5, // Bonus per additional open
};

/**
 * Calculate engagement score for a prospect
 */
function calculateScore(engagement: ProspectEngagement): EngagementScore {
  let score = 0;
  const signals: string[] = [];

  // Base engagement points
  if (engagement.emailsOpened > 0) {
    score += WEIGHTS.open;
    signals.push(`Opened ${engagement.emailsOpened} email(s)`);

    // Bonus for multiple opens (shows interest)
    if (engagement.emailsOpened > engagement.uniqueOpens) {
      const reopens = engagement.emailsOpened - engagement.uniqueOpens;
      score += reopens * WEIGHTS.multipleOpens;
      signals.push(`Re-opened ${reopens} time(s)`);
    }
  }

  if (engagement.emailsClicked > 0) {
    score += WEIGHTS.click;
    signals.push(`Clicked ${engagement.emailsClicked} link(s)`);
  }

  if (engagement.emailsReplied > 0) {
    score += WEIGHTS.reply;
    signals.push(`Replied to email`);
  }

  // Recency bonus
  const lastActivity = engagement.lastReplyAt || engagement.lastClickAt || engagement.lastOpenAt;
  if (lastActivity) {
    const hoursSinceActivity =
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivity < 24) {
      score += WEIGHTS.recentActivity;
      signals.push('Active in last 24 hours');
    }
  }

  // Determine engagement level
  let level: 'hot' | 'warm' | 'cold' | 'unengaged';
  let recommendedAction: string;

  if (score >= 50 || engagement.emailsReplied > 0) {
    level = 'hot';
    recommendedAction = 'Prioritize follow-up - high interest';
  } else if (score >= 30 || engagement.emailsClicked > 0) {
    level = 'warm';
    recommendedAction = 'Send personalized follow-up';
  } else if (score >= 10 || engagement.emailsOpened > 0) {
    level = 'cold';
    recommendedAction = 'Continue sequence - showing some interest';
  } else {
    level = 'unengaged';
    recommendedAction = 'Review targeting - no engagement detected';
  }

  return {
    score: Math.min(score, 100), // Cap at 100
    level,
    signals,
    lastActivity: lastActivity || 'never',
    recommendedAction,
  };
}

/**
 * Update engagement metrics based on event
 */
function updateEngagement(
  current: ProspectEngagement,
  event: EngagementEvent
): ProspectEngagement {
  const updated = { ...current };

  switch (event.type) {
    case 'email_sent':
      updated.emailsSent += 1;
      break;

    case 'email_opened':
      updated.emailsOpened += 1;
      // Track unique opens (simplified - in production use tracking IDs)
      if (!updated.lastOpenAt) {
        updated.uniqueOpens += 1;
      }
      updated.lastOpenAt = event.timestamp;
      break;

    case 'email_clicked':
      updated.emailsClicked += 1;
      if (!updated.lastClickAt) {
        updated.uniqueClicks += 1;
      }
      updated.lastClickAt = event.timestamp;
      break;

    case 'email_replied':
      updated.emailsReplied += 1;
      updated.lastReplyAt = event.timestamp;
      break;
  }

  return updated;
}

// In-memory store for demo (would be database in production)
const engagementStore = new Map<string, ProspectEngagement>();

/**
 * Get or create engagement record
 */
function getEngagement(prospectId: string, campaignId: string): ProspectEngagement {
  const key = `${campaignId}:${prospectId}`;
  
  if (!engagementStore.has(key)) {
    engagementStore.set(key, {
      prospectId,
      campaignId,
      emailsSent: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      emailsReplied: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
    });
  }
  
  return engagementStore.get(key)!;
}

/**
 * Process engagement event
 */
export async function processEngagement(event: EngagementEvent): Promise<{
  engagement: ProspectEngagement;
  score: EngagementScore;
  scoreChange: number;
}> {
  // Get current engagement
  const current = getEngagement(event.prospectId, event.campaignId);
  const currentScore = calculateScore(current);

  // Update engagement
  const updated = updateEngagement(current, event);
  engagementStore.set(`${event.campaignId}:${event.prospectId}`, updated);

  // Calculate new score
  const newScore = calculateScore(updated);

  return {
    engagement: updated,
    score: newScore,
    scoreChange: newScore.score - currentScore.score,
  };
}

/**
 * Main listener handler
 */
export async function handleEngagementEvent(event: EngagementEvent): Promise<void> {
  console.log(`Processing ${event.type} for: ${event.prospectId}`);

  const result = await processEngagement(event);

  console.log(`Engagement level: ${result.score.level}`);
  console.log(`Score: ${result.score.score} (${result.scoreChange >= 0 ? '+' : ''}${result.scoreChange})`);
  console.log(`Signals: ${result.score.signals.join(', ')}`);
  console.log(`Recommendation: ${result.score.recommendedAction}`);

  // Alert on score changes
  if (result.score.level === 'hot' && result.scoreChange > 0) {
    console.log('🔥 HOT LEAD - Notify sales team');
  }
}

/**
 * Get engagement summary for a campaign
 */
export function getCampaignEngagementSummary(campaignId: string): {
  hot: number;
  warm: number;
  cold: number;
  unengaged: number;
  averageScore: number;
} {
  const summary = { hot: 0, warm: 0, cold: 0, unengaged: 0, totalScore: 0, count: 0 };

  engagementStore.forEach((engagement, key) => {
    if (key.startsWith(campaignId)) {
      const score = calculateScore(engagement);
      summary[score.level] += 1;
      summary.totalScore += score.score;
      summary.count += 1;
    }
  });

  return {
    ...summary,
    averageScore: summary.count > 0 ? Math.round(summary.totalScore / summary.count) : 0,
  };
}

// Export for use in agent system
export default {
  name: 'engagement-scorer',
  description: 'Calculates prospect engagement scores',
  handler: handleEngagementEvent,
};

