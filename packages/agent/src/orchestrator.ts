import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentFSManager } from './storage/agentfs-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface OrchestratorConfig {
  projectRoot?: string;
  tursoUrl?: string;
  tursoToken?: string;
}

/**
 * Message type from the SDK's async iterator
 * The SDK yields various message types during execution
 */
interface SDKMessage {
  type: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
    }>;
  };
}

/**
 * Extract text content from SDK messages
 */
function extractTextFromMessages(messages: SDKMessage[]): string {
  const textParts: string[] = [];

  for (const message of messages) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text);
        }
      }
    }
  }

  return textParts.join('\n');
}

/**
 * Parse JSON from text, handling markdown code blocks
 */
function parseJSON(text: string): unknown {
  // Try to extract JSON from markdown code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue to try other methods
    }
  }

  // Try to extract raw JSON object
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    try {
      return JSON.parse(jsonObjectMatch[0]);
    } catch {
      // Continue
    }
  }

  // Try to extract raw JSON array
  const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    try {
      return JSON.parse(jsonArrayMatch[0]);
    } catch {
      // Return null if all parsing fails
    }
  }

  return null;
}

/**
 * Main orchestrator that coordinates all agent activities using Claude Agent SDK.
 * Skills are loaded from .claude/skills/ and Claude autonomously invokes them.
 */
export class Orchestrator {
  private projectRoot: string;
  private storageManagers: Map<string, AgentFSManager> = new Map();
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = config;
    // Default to the monorepo root (3 levels up from this file)
    this.projectRoot = config.projectRoot || path.resolve(__dirname, '..', '..', '..', '..');
  }

  /**
   * Get or create storage manager for a client
   */
  async getStorage(clientId: string): Promise<AgentFSManager> {
    if (!this.storageManagers.has(clientId)) {
      const manager = new AgentFSManager({
        url: this.config.tursoUrl || process.env.TURSO_DATABASE_URL || 'file:local.db',
        authToken: this.config.tursoToken || process.env.TURSO_AUTH_TOKEN,
      });
      await manager.initialize(clientId);
      this.storageManagers.set(clientId, manager);
    }
    return this.storageManagers.get(clientId)!;
  }

  /**
   * Run a query using the Claude Agent SDK with skills enabled
   */
  private async runQuery(
    prompt: string,
    options: {
      allowBash?: boolean;
    } = {}
  ): Promise<string> {
    const messages: SDKMessage[] = [];

    const allowedTools = ['Skill', 'Read', 'Write', 'Glob', 'Grep'];
    if (options.allowBash) {
      allowedTools.push('Bash');
    }

    for await (const message of query({
      prompt,
      options: {
        cwd: this.projectRoot,
        settingSources: ['project'], // Load skills from .claude/skills/
        allowedTools,
      },
    })) {
      messages.push(message);
    }

    return extractTextFromMessages(messages);
  }

  /**
   * Run a simple prompt without skills (for backward compatibility with agents)
   * This is a convenience method that wraps runQuery for simple AI completions.
   */
  async runPrompt(
    prompt: string,
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
    // Prepend system prompt if provided
    const fullPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n${prompt}`
      : prompt;

    return this.runQuery(fullPrompt);
  }

  /**
   * Run a conversation with Claude (multi-turn) - for backward compatibility
   */
  async runConversation(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
    // Build a single prompt from the conversation history
    let conversationPrompt = options.systemPrompt ? `${options.systemPrompt}\n\n` : '';

    for (const msg of messages) {
      conversationPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    }

    conversationPrompt += 'Assistant:';

    return this.runQuery(conversationPrompt);
  }

  /**
   * Analyze a website and generate business profile using the client-discovery skill
   */
  async analyzeWebsite(clientId: string, websiteUrl: string): Promise<unknown> {
    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;

    const prompt = `Use the client-discovery skill to analyze this company's website and generate a comprehensive business profile.

Website URL: ${websiteUrl}
Client ID: ${clientId}

Follow the skill workflow to:
1. Analyze the website using the website_analyzer.py script
2. Research the market using market_researcher.py
3. Generate initial insights

After analysis, provide the business profile in this JSON format:
{
  "company_name": "",
  "website": "",
  "industry": "",
  "sub_industry": "",
  "value_proposition": "",
  "products_services": [],
  "target_market": "",
  "key_differentiators": [],
  "estimated_size": "",
  "company_stage": "",
  "headquarters": "",
  "summary": ""
}`;

    const result = await this.runQuery(prompt, { allowBash: true });
    const endTime = Date.now() / 1000;

    // Record the tool call
    await storage.recordToolCall(
      'analyze_website',
      startTime,
      endTime,
      { websiteUrl },
      result
    );

    // Parse and return
    const parsed = parseJSON(result);
    if (parsed) {
      return parsed;
    }

    return { raw: result };
  }

  /**
   * Generate ICP from business profile using the client-discovery skill
   */
  async generateICP(clientId: string, businessProfile: unknown): Promise<unknown> {
    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;

    const prompt = `Use the client-discovery skill to generate a comprehensive Ideal Customer Profile (ICP) based on this business profile.

Client ID: ${clientId}

Business Profile:
${JSON.stringify(businessProfile, null, 2)}

Follow the skill workflow to:
1. Use icp_generator.py to create the ICP
2. Use icp_validator.py to validate it

Generate the ICP in this JSON format:
{
  "icp_summary": "One paragraph summary of ideal customers",
  "firmographic_criteria": {
    "company_size": {
      "employee_ranges": ["10-50", "50-100"],
      "revenue_ranges": ["$1M-$5M", "$5M-$20M"]
    },
    "company_stage": ["startup", "growth", "established"],
    "funding_status": ["bootstrapped", "seed", "series_a"]
  },
  "geographic_targeting": {
    "primary_markets": [
      { "city": "", "state": "", "country": "", "priority": "high" }
    ],
    "expansion_markets": []
  },
  "industry_targeting": {
    "primary_industries": [
      { "name": "", "sub_segments": [], "priority": "high" }
    ],
    "secondary_industries": []
  },
  "decision_maker_targeting": {
    "primary_titles": [],
    "secondary_titles": [],
    "departments": []
  },
  "messaging_framework": {
    "primary_pain_points_to_address": [],
    "value_propositions": [],
    "proof_points": [],
    "objection_handlers": {}
  }
}`;

    const result = await this.runQuery(prompt, { allowBash: true });
    const endTime = Date.now() / 1000;

    await storage.recordToolCall(
      'generate_icp',
      startTime,
      endTime,
      { businessProfile },
      result
    );

    const parsed = parseJSON(result);
    if (parsed) {
      await storage.saveICP(parsed);
      return parsed;
    }

    return { raw: result };
  }

  /**
   * Discover leads using the lead-discovery skill
   */
  async discoverLeads(
    clientId: string,
    icp: unknown,
    options: {
      location: string;
      industry: string;
      limit?: number;
    }
  ): Promise<unknown[]> {
    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;

    const prompt = `Use the lead-discovery skill to find prospects matching this ICP.

Client ID: ${clientId}
Location: ${options.location}
Industry: ${options.industry}
Limit: ${options.limit || 50}

ICP:
${JSON.stringify(icp, null, 2)}

Follow the skill workflow to:
1. Search Google Maps using scraper.py
2. Parse results using parser.py
3. Enrich companies using company_enricher.py
4. Find contacts using contact_finder.py
5. Validate data using data_validator.py

Return the validated prospects as a JSON array.`;

    const result = await this.runQuery(prompt, { allowBash: true });
    const endTime = Date.now() / 1000;

    await storage.recordToolCall(
      'discover_leads',
      startTime,
      endTime,
      { icp, options },
      result
    );

    const parsed = parseJSON(result);
    if (Array.isArray(parsed)) {
      await storage.saveProspects(options.location, options.industry, parsed);
      return parsed;
    }

    return [];
  }

  /**
   * Generate personalized email sequence using the email-personalization skill
   */
  async generateEmailSequence(
    clientId: string,
    prospect: unknown,
    icp: unknown
  ): Promise<unknown[]> {
    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;

    const prompt = `Use the email-personalization skill to generate a 3-email cold outreach sequence.

Client ID: ${clientId}

Prospect:
${JSON.stringify(prospect, null, 2)}

ICP & Messaging Framework:
${JSON.stringify(icp, null, 2)}

Follow the skill workflow to:
1. Use personalization_engine.py to generate emails
2. Use quality_checker.py to validate quality

Return the emails as a JSON array:
[
  { "sequence": 1, "subject": "", "body": "", "delay_days": 0, "quality_score": 0 },
  { "sequence": 2, "subject": "", "body": "", "delay_days": 3, "quality_score": 0 },
  { "sequence": 3, "subject": "", "body": "", "delay_days": 7, "quality_score": 0 }
]`;

    const result = await this.runQuery(prompt, { allowBash: true });
    const endTime = Date.now() / 1000;

    await storage.recordToolCall(
      'generate_email_sequence',
      startTime,
      endTime,
      { prospect, icp },
      result
    );

    const parsed = parseJSON(result);
    if (Array.isArray(parsed)) {
      return parsed;
    }

    return [];
  }

  /**
   * Classify email response sentiment using the email-tracking skill
   */
  async classifyResponse(
    responseText: string,
    originalEmail: string
  ): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative' | 'out_of_office' | 'unsubscribe';
    requires_action: boolean;
    summary: string;
    suggested_reply?: string;
  }> {
    const prompt = `Use the email-tracking skill to classify this email response.

Original Email:
${originalEmail}

Response:
${responseText}

Classify the response and return JSON:
{
  "sentiment": "positive|neutral|negative|out_of_office|unsubscribe",
  "requires_action": true|false,
  "summary": "Brief summary of the response",
  "suggested_reply": "Optional suggested reply if positive/neutral"
}`;

    const result = await this.runQuery(prompt);
    const parsed = parseJSON(result);

    if (parsed && typeof parsed === 'object') {
      return parsed as {
        sentiment: 'positive' | 'neutral' | 'negative' | 'out_of_office' | 'unsubscribe';
        requires_action: boolean;
        summary: string;
        suggested_reply?: string;
      };
    }

    return {
      sentiment: 'neutral',
      requires_action: true,
      summary: 'Unable to classify response',
    };
  }

  /**
   * Score a prospect against ICP
   */
  async scoreProspect(prospect: unknown, icp: unknown): Promise<number> {
    const prompt = `Score this prospect against the ICP on a scale of 0 to 1.

Prospect:
${JSON.stringify(prospect, null, 2)}

ICP:
${JSON.stringify(icp, null, 2)}

Consider: company size, industry, location, and decision maker fit.
Return ONLY a number between 0 and 1 (e.g., 0.85).`;

    const result = await this.runQuery(prompt);
    const score = parseFloat(result.trim());
    return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
  }

  /**
   * Get campaign analytics using the campaign-management skill
   */
  async getCampaignAnalytics(campaignId: string): Promise<unknown> {
    const prompt = `Use the campaign-management skill to generate analytics for campaign ${campaignId}.

Run: python analytics.py campaign --campaign-id ${campaignId} --output /tmp/analytics.json

Return the analytics data as JSON.`;

    const result = await this.runQuery(prompt, { allowBash: true });
    const parsed = parseJSON(result);
    return parsed || { raw: result };
  }

  /**
   * Clean up and close connections
   */
  async shutdown(): Promise<void> {
    for (const manager of this.storageManagers.values()) {
      manager.close();
    }
    this.storageManagers.clear();
  }
}
