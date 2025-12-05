/**
 * Engagement Scorer Tool - Calculates engagement scores for prospects
 */

import { tool } from 'ai';
import { z } from 'zod';

interface EngagementMetrics {
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  uniqueOpens: number;
  uniqueClicks: number;
  lastOpenAt?: string;
  lastClickAt?: string;
  lastReplyAt?: string;
}

export interface EngagementScore {
  score: number;
  level: 'hot' | 'warm' | 'cold' | 'unengaged';
  signals: string[];
  lastActivity: string;
  recommendedAction: string;
}

// Engagement weights
const WEIGHTS = {
  open: 10,
  uniqueOpen: 15,
  click: 25,
  uniqueClick: 30,
  reply: 50,
  recentActivity: 10,
  multipleOpens: 5,
};

/**
 * Calculate engagement score from metrics
 */
export function calculateEngagementScore(metrics: EngagementMetrics): EngagementScore {
  let score = 0;
  const signals: string[] = [];

  // Base engagement points
  if (metrics.emailsOpened > 0) {
    score += WEIGHTS.open;
    signals.push(`Opened ${metrics.emailsOpened} email(s)`);

    // Bonus for multiple opens (shows interest)
    if (metrics.emailsOpened > metrics.uniqueOpens) {
      const reopens = metrics.emailsOpened - metrics.uniqueOpens;
      score += reopens * WEIGHTS.multipleOpens;
      signals.push(`Re-opened ${reopens} time(s)`);
    }
  }

  if (metrics.emailsClicked > 0) {
    score += WEIGHTS.click;
    signals.push(`Clicked ${metrics.emailsClicked} link(s)`);
  }

  if (metrics.emailsReplied > 0) {
    score += WEIGHTS.reply;
    signals.push('Replied to email');
  }

  // Recency bonus
  const lastActivity = metrics.lastReplyAt || metrics.lastClickAt || metrics.lastOpenAt;
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

  if (score >= 50 || metrics.emailsReplied > 0) {
    level = 'hot';
    recommendedAction = 'Prioritize follow-up - high interest';
  } else if (score >= 30 || metrics.emailsClicked > 0) {
    level = 'warm';
    recommendedAction = 'Send personalized follow-up';
  } else if (score >= 10 || metrics.emailsOpened > 0) {
    level = 'cold';
    recommendedAction = 'Continue sequence - showing some interest';
  } else {
    level = 'unengaged';
    recommendedAction = 'Review targeting - no engagement detected';
  }

  return {
    score: Math.min(score, 100),
    level,
    signals,
    lastActivity: lastActivity || 'never',
    recommendedAction,
  };
}

/**
 * Process an engagement event and update score
 */
export async function processEngagement(
  currentMetrics: EngagementMetrics,
  event: {
    type: 'email_sent' | 'email_delivered' | 'email_opened' | 'email_clicked' | 'email_replied';
    timestamp: string;
  }
): Promise<{
  metrics: EngagementMetrics;
  score: EngagementScore;
  scoreChange: number;
}> {
  const currentScore = calculateEngagementScore(currentMetrics);
  const updatedMetrics = { ...currentMetrics };

  switch (event.type) {
    case 'email_sent':
      updatedMetrics.emailsSent += 1;
      break;
    case 'email_delivered':
      updatedMetrics.emailsDelivered += 1;
      break;
    case 'email_opened':
      updatedMetrics.emailsOpened += 1;
      if (!updatedMetrics.lastOpenAt) {
        updatedMetrics.uniqueOpens += 1;
      }
      updatedMetrics.lastOpenAt = event.timestamp;
      break;
    case 'email_clicked':
      updatedMetrics.emailsClicked += 1;
      if (!updatedMetrics.lastClickAt) {
        updatedMetrics.uniqueClicks += 1;
      }
      updatedMetrics.lastClickAt = event.timestamp;
      break;
    case 'email_replied':
      updatedMetrics.emailsReplied += 1;
      updatedMetrics.lastReplyAt = event.timestamp;
      break;
  }

  const newScore = calculateEngagementScore(updatedMetrics);

  return {
    metrics: updatedMetrics,
    score: newScore,
    scoreChange: newScore.score - currentScore.score,
  };
}

export const engagementScorerTool = tool({
  description: 'Calculate engagement scores for prospects based on email interaction metrics',
  inputSchema: z.object({
    metrics: z.object({
      emailsSent: z.number().default(0),
      emailsDelivered: z.number().default(0),
      emailsOpened: z.number().default(0),
      emailsClicked: z.number().default(0),
      emailsReplied: z.number().default(0),
      uniqueOpens: z.number().default(0),
      uniqueClicks: z.number().default(0),
      lastOpenAt: z.string().optional(),
      lastClickAt: z.string().optional(),
      lastReplyAt: z.string().optional(),
    }).describe('Current engagement metrics for the prospect'),
    event: z.object({
      type: z.enum(['email_sent', 'email_delivered', 'email_opened', 'email_clicked', 'email_replied']),
      timestamp: z.string(),
    }).optional().describe('New engagement event to process'),
  }),
  execute: async ({ metrics, event }) => {
    if (event) {
      // Process new event
      const result = await processEngagement(metrics, event);
      return {
        success: true,
        metrics: result.metrics,
        score: result.score,
        scoreChange: result.scoreChange,
        isHotLead: result.score.level === 'hot',
        summary: `${result.score.level.toUpperCase()} - Score: ${result.score.score} (${result.scoreChange >= 0 ? '+' : ''}${result.scoreChange})`,
      };
    }

    // Just calculate score
    const score = calculateEngagementScore(metrics);
    return {
      success: true,
      metrics,
      score,
      scoreChange: 0,
      isHotLead: score.level === 'hot',
      summary: `${score.level.toUpperCase()} - Score: ${score.score}`,
    };
  },
});
