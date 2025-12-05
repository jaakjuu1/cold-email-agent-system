/**
 * Rate Limiter Tool - Manages email sending rate limits and warmup
 */

import { tool } from 'ai';
import { z } from 'zod';

interface RateLimitState {
  hourlyCount: number;
  dailyCount: number;
  hourlyLimit: number;
  dailyLimit: number;
  lastReset: string;
  lastHourlyReset: string;
  warmupDay: number;
  minDelayMs: number;
}

interface RateLimitCheck {
  canSend: boolean;
  waitTimeMs: number;
  reason?: string;
  remainingHourly: number;
  remainingDaily: number;
}

// Default warmup schedule (emails per day)
const WARMUP_SCHEDULE = [10, 25, 50, 100, 150, 200];

// In-memory state (would be persisted in production)
const rateLimitStates = new Map<string, RateLimitState>();

function getDefaultState(): RateLimitState {
  const now = new Date().toISOString();
  return {
    hourlyCount: 0,
    dailyCount: 0,
    hourlyLimit: 50,
    dailyLimit: 200,
    lastReset: now,
    lastHourlyReset: now,
    warmupDay: 0,
    minDelayMs: 5000,
  };
}

function getState(accountId: string): RateLimitState {
  if (!rateLimitStates.has(accountId)) {
    rateLimitStates.set(accountId, getDefaultState());
  }
  return rateLimitStates.get(accountId)!;
}

function resetIfNeeded(state: RateLimitState): RateLimitState {
  const now = new Date();
  const lastReset = new Date(state.lastReset);
  const lastHourlyReset = new Date(state.lastHourlyReset);

  // Reset daily count if new day
  if (now.getDate() !== lastReset.getDate()) {
    state.dailyCount = 0;
    state.lastReset = now.toISOString();

    // Advance warmup day
    if (state.warmupDay < WARMUP_SCHEDULE.length - 1) {
      state.warmupDay += 1;
      state.dailyLimit = WARMUP_SCHEDULE[state.warmupDay] ?? state.dailyLimit;
    }
  }

  // Reset hourly count if new hour
  if (now.getHours() !== lastHourlyReset.getHours()) {
    state.hourlyCount = 0;
    state.lastHourlyReset = now.toISOString();
  }

  return state;
}

function checkRateLimit(state: RateLimitState): RateLimitCheck {
  const updated = resetIfNeeded(state);

  const remainingHourly = updated.hourlyLimit - updated.hourlyCount;
  const remainingDaily = updated.dailyLimit - updated.dailyCount;

  if (remainingDaily <= 0) {
    // Calculate time until midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const waitTimeMs = midnight.getTime() - now.getTime();

    return {
      canSend: false,
      waitTimeMs,
      reason: 'Daily limit reached',
      remainingHourly,
      remainingDaily: 0,
    };
  }

  if (remainingHourly <= 0) {
    // Calculate time until next hour
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const waitTimeMs = nextHour.getTime() - now.getTime();

    return {
      canSend: false,
      waitTimeMs,
      reason: 'Hourly limit reached',
      remainingHourly: 0,
      remainingDaily,
    };
  }

  return {
    canSend: true,
    waitTimeMs: updated.minDelayMs,
    remainingHourly,
    remainingDaily,
  };
}

function recordSend(state: RateLimitState): RateLimitState {
  const updated = resetIfNeeded(state);
  updated.hourlyCount += 1;
  updated.dailyCount += 1;
  return updated;
}

function configureRateLimit(
  state: RateLimitState,
  options: {
    hourlyLimit?: number;
    dailyLimit?: number;
    minDelayMs?: number;
    warmupDay?: number;
  }
): RateLimitState {
  return {
    ...state,
    hourlyLimit: options.hourlyLimit ?? state.hourlyLimit,
    dailyLimit: options.dailyLimit ?? state.dailyLimit,
    minDelayMs: options.minDelayMs ?? state.minDelayMs,
    warmupDay: options.warmupDay ?? state.warmupDay,
  };
}

export const rateLimiterTool = tool({
  description: 'Manage email sending rate limits with warmup schedule support',
  inputSchema: z.object({
    action: z.enum(['check', 'record', 'status', 'configure']).describe('Action to perform'),
    accountId: z.string().default('default').describe('Account/domain identifier'),
    config: z.object({
      hourlyLimit: z.number().optional(),
      dailyLimit: z.number().optional(),
      minDelayMs: z.number().optional(),
      warmupDay: z.number().optional(),
    }).optional().describe('Configuration options (for configure action)'),
  }),
  execute: async ({ action, accountId, config }) => {
    let state = getState(accountId);

    switch (action) {
      case 'check': {
        const check = checkRateLimit(state);
        return {
          success: true,
          action: 'check',
          ...check,
          summary: check.canSend
            ? `Can send (${check.remainingHourly}h/${check.remainingDaily}d remaining)`
            : `Cannot send: ${check.reason} (wait ${Math.round(check.waitTimeMs / 60000)}min)`,
        };
      }

      case 'record': {
        state = recordSend(state);
        rateLimitStates.set(accountId, state);
        const check = checkRateLimit(state);
        return {
          success: true,
          action: 'record',
          hourlyCount: state.hourlyCount,
          dailyCount: state.dailyCount,
          remainingHourly: check.remainingHourly,
          remainingDaily: check.remainingDaily,
          summary: `Recorded send (${check.remainingHourly}h/${check.remainingDaily}d remaining)`,
        };
      }

      case 'status': {
        state = resetIfNeeded(state);
        return {
          success: true,
          action: 'status',
          state: {
            hourlyCount: state.hourlyCount,
            dailyCount: state.dailyCount,
            hourlyLimit: state.hourlyLimit,
            dailyLimit: state.dailyLimit,
            warmupDay: state.warmupDay,
            warmupSchedule: WARMUP_SCHEDULE,
            minDelayMs: state.minDelayMs,
          },
          summary: `Day ${state.warmupDay + 1} warmup: ${state.dailyCount}/${state.dailyLimit} daily, ${state.hourlyCount}/${state.hourlyLimit} hourly`,
        };
      }

      case 'configure': {
        if (config) {
          state = configureRateLimit(state, config);
          rateLimitStates.set(accountId, state);
        }
        return {
          success: true,
          action: 'configure',
          state: {
            hourlyLimit: state.hourlyLimit,
            dailyLimit: state.dailyLimit,
            minDelayMs: state.minDelayMs,
            warmupDay: state.warmupDay,
          },
          summary: `Configured: ${state.hourlyLimit}/h, ${state.dailyLimit}/d, ${state.minDelayMs}ms delay`,
        };
      }

      default:
        return {
          success: false,
          error: `Unknown action: ${action}`,
        };
    }
  },
});
