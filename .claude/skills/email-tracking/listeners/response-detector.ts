/**
 * Response Detector Listener
 * Classifies and routes email responses for campaign tracking
 */

import Anthropic from '@anthropic-ai/sdk';

interface ResponseEvent {
  type: 'email_response';
  campaignId: string;
  prospectId: string;
  emailId: string;
  messageId: string;
  inReplyTo: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
}

interface ClassificationResult {
  sentiment: 'positive' | 'neutral' | 'negative' | 'out_of_office' | 'unsubscribe';
  requiresAction: boolean;
  summary: string;
  suggestedReply?: string;
  priority: 'high' | 'normal' | 'low';
}

const anthropic = new Anthropic();

/**
 * Classify email response sentiment and intent using Claude
 */
async function classifyResponse(
  subject: string,
  body: string,
  originalEmail?: string
): Promise<ClassificationResult> {
  const prompt = `Classify this email response:

Subject: ${subject}

Body:
${body}

${originalEmail ? `Original email was:\n${originalEmail}` : ''}

Classify the response and provide:
1. sentiment: positive, neutral, negative, out_of_office, or unsubscribe
2. requiresAction: whether this needs human follow-up
3. summary: brief summary of the response
4. suggestedReply: if positive/neutral, suggest a reply
5. priority: high (meeting request/interested), normal, or low

Return as JSON:
{
  "sentiment": "...",
  "requiresAction": true/false,
  "summary": "...",
  "suggestedReply": "...",
  "priority": "..."
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Classification error:', error);
  }

  // Default classification
  return {
    sentiment: 'neutral',
    requiresAction: true,
    summary: 'Unable to classify response',
    priority: 'normal',
  };
}

/**
 * Detect meeting requests in response
 */
function detectMeetingRequest(body: string): boolean {
  const meetingIndicators = [
    /let'?s (schedule|set up|book|arrange)/i,
    /meeting/i,
    /call/i,
    /chat/i,
    /demo/i,
    /calendar/i,
    /available/i,
    /free time/i,
    /15 minutes/i,
    /30 minutes/i,
  ];

  return meetingIndicators.some((pattern) => pattern.test(body));
}

/**
 * Detect unsubscribe request
 */
function detectUnsubscribe(body: string, subject: string): boolean {
  const unsubscribeIndicators = [
    /unsubscribe/i,
    /remove (me|my email)/i,
    /stop (emailing|contacting)/i,
    /don'?t (contact|email)/i,
    /opt.?out/i,
    /take me off/i,
  ];

  const text = `${subject} ${body}`;
  return unsubscribeIndicators.some((pattern) => pattern.test(text));
}

/**
 * Process a response event
 */
export async function processResponse(event: ResponseEvent): Promise<{
  classification: ClassificationResult;
  actions: string[];
}> {
  const actions: string[] = [];

  // Quick checks first
  if (detectUnsubscribe(event.body, event.subject)) {
    return {
      classification: {
        sentiment: 'unsubscribe',
        requiresAction: true,
        summary: 'Unsubscribe request - remove from list',
        priority: 'high',
      },
      actions: ['remove_from_campaign', 'add_to_suppression_list'],
    };
  }

  // Full classification
  const classification = await classifyResponse(event.subject, event.body);

  // Determine actions based on classification
  switch (classification.sentiment) {
    case 'positive':
      actions.push('update_prospect_status:responded');
      actions.push('notify_sales');
      if (detectMeetingRequest(event.body)) {
        actions.push('create_meeting_task');
        classification.priority = 'high';
      }
      break;

    case 'negative':
      actions.push('update_prospect_status:rejected');
      actions.push('stop_sequence');
      break;

    case 'out_of_office':
      actions.push('reschedule_followup');
      break;

    case 'unsubscribe':
      actions.push('remove_from_campaign');
      actions.push('add_to_suppression_list');
      break;

    default:
      actions.push('update_prospect_status:responded');
      if (classification.requiresAction) {
        actions.push('flag_for_review');
      }
  }

  return { classification, actions };
}

/**
 * Main listener handler
 */
export async function handleResponseEvent(event: ResponseEvent): Promise<void> {
  console.log(`Processing response from: ${event.from}`);
  console.log(`Subject: ${event.subject}`);

  const result = await processResponse(event);

  console.log(`Classification: ${result.classification.sentiment}`);
  console.log(`Priority: ${result.classification.priority}`);
  console.log(`Summary: ${result.classification.summary}`);
  console.log(`Actions: ${result.actions.join(', ')}`);

  // In production, this would emit events to the backend
  // or directly update the database
}

// Export for use in agent system
export default {
  name: 'response-detector',
  description: 'Classifies and routes email responses',
  handler: handleResponseEvent,
};

