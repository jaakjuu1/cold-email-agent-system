/**
 * Response Classifier Tool - Classifies email responses using AI
 */

import { tool, generateObject } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z } from 'zod';

// Get DeepSeek model
function getDeepSeekModel() {
  const deepseek = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
  return deepseek('deepseek-chat');
}

const ResponseClassificationSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'out_of_office', 'unsubscribe']),
  requiresAction: z.boolean(),
  summary: z.string(),
  suggestedReply: z.string().optional(),
  priority: z.enum(['high', 'normal', 'low']),
  meetingRequested: z.boolean().optional(),
  actions: z.array(z.string()).optional(),
});

export type ResponseClassification = z.infer<typeof ResponseClassificationSchema>;

/**
 * Classify email response using DeepSeek
 */
export async function classifyResponse(
  subject: string,
  body: string,
  originalEmail?: string
): Promise<ResponseClassification> {
  const model = getDeepSeekModel();

  const prompt = `Classify this email response:

Subject: ${subject}
Body: ${body}
${originalEmail ? `\nOriginal email: ${originalEmail}` : ''}

Determine:
1. Sentiment: Is this positive, neutral, negative, out of office, or unsubscribe request?
2. Requires action: Does this need a follow-up?
3. Summary: Brief 1-sentence summary
4. Suggested reply: If action needed, what should the reply address?
5. Priority: high (meeting request, urgent), normal (general interest), low (auto-reply, rejection)
6. Meeting requested: Did they request a meeting/call?
7. Actions: List of recommended actions (e.g., "schedule_meeting", "update_crm", "stop_sequence")`;

  try {
    const { object } = await generateObject({
      model,
      schema: ResponseClassificationSchema,
      prompt,
    });

    return object;
  } catch {
    // Fallback classification using simple keyword matching
    return classifyResponseFallback(subject, body);
  }
}

/**
 * Fallback classification using keyword matching
 */
function classifyResponseFallback(subject: string, body: string): ResponseClassification {
  const text = `${subject} ${body}`.toLowerCase();

  // Check for out of office
  if (
    text.includes('out of office') ||
    text.includes('away from') ||
    text.includes('on vacation') ||
    text.includes('auto-reply')
  ) {
    return {
      sentiment: 'out_of_office',
      requiresAction: false,
      summary: 'Auto-reply or out of office message',
      priority: 'low',
    };
  }

  // Check for unsubscribe
  if (
    text.includes('unsubscribe') ||
    text.includes('remove me') ||
    text.includes('stop emailing') ||
    text.includes('do not contact')
  ) {
    return {
      sentiment: 'unsubscribe',
      requiresAction: true,
      summary: 'Unsubscribe request',
      priority: 'high',
      actions: ['remove_from_campaign', 'update_dnc_list'],
    };
  }

  // Check for positive signals
  if (
    text.includes('interested') ||
    text.includes('schedule') ||
    text.includes('meeting') ||
    text.includes('call') ||
    text.includes('demo') ||
    text.includes('tell me more')
  ) {
    return {
      sentiment: 'positive',
      requiresAction: true,
      summary: 'Positive response indicating interest',
      priority: 'high',
      meetingRequested: text.includes('schedule') || text.includes('meeting') || text.includes('call'),
      actions: ['notify_sales', 'schedule_followup'],
    };
  }

  // Check for negative signals
  if (
    text.includes('not interested') ||
    text.includes("don't need") ||
    text.includes('no thank') ||
    text.includes('not looking') ||
    text.includes('already have')
  ) {
    return {
      sentiment: 'negative',
      requiresAction: false,
      summary: 'Negative response - not interested',
      priority: 'low',
      actions: ['stop_sequence'],
    };
  }

  // Default to neutral
  return {
    sentiment: 'neutral',
    requiresAction: true,
    summary: 'Neutral response - needs review',
    priority: 'normal',
    actions: ['flag_for_review'],
  };
}

export const responseClassifierTool = tool({
  description: 'Classify email responses to determine sentiment, required actions, and priority',
  inputSchema: z.object({
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content'),
    originalEmail: z.string().optional().describe('The original email that was sent'),
  }),
  execute: async ({ subject, body, originalEmail }) => {
    const classification = await classifyResponse(subject, body, originalEmail);

    return {
      success: true,
      classification,
      summary: `${classification.sentiment} response - ${classification.requiresAction ? 'Action required' : 'No action needed'} (${classification.priority} priority)`,
    };
  },
});
