import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentFSManager } from './storage/agentfs-manager.js';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===========================================
// Zod Schemas for Structured Outputs
// ===========================================

const BusinessProfileSchema = z.object({
  company_name: z.string(),
  website: z.string(),
  industry: z.string(),
  sub_industry: z.string().optional(),
  value_proposition: z.string(),
  products_services: z.array(z.string()),
  target_market: z.string(),
  key_differentiators: z.array(z.string()),
  estimated_size: z.string(),
  company_stage: z.string(),
  headquarters: z.string().optional(),
  summary: z.string(),
});

const MarketSchema = z.object({
  city: z.string(),
  state: z.string(),
  country: z.string(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

const IndustrySchema = z.object({
  name: z.string(),
  sub_segments: z.array(z.string()),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

const ICPSchema = z.object({
  icp_summary: z.string(),
  firmographic_criteria: z.object({
    company_size: z.object({
      employee_ranges: z.array(z.string()),
      revenue_ranges: z.array(z.string()),
    }),
    company_stage: z.array(z.string()),
    funding_status: z.array(z.string()).optional(),
  }),
  geographic_targeting: z.object({
    primary_markets: z.array(MarketSchema),
    expansion_markets: z.array(MarketSchema).optional(),
  }),
  industry_targeting: z.object({
    primary_industries: z.array(IndustrySchema),
    secondary_industries: z.array(IndustrySchema).optional(),
  }),
  decision_maker_targeting: z.object({
    primary_titles: z.array(z.string()),
    secondary_titles: z.array(z.string()).optional(),
    departments: z.array(z.string()),
  }),
  messaging_framework: z.object({
    primary_pain_points_to_address: z.array(z.string()),
    value_propositions: z.array(z.string()),
    proof_points: z.array(z.string()),
    objection_handlers: z.record(z.string()).optional(),
  }),
});

const ResponseClassificationSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'out_of_office', 'unsubscribe']),
  requires_action: z.boolean(),
  summary: z.string(),
  suggested_reply: z.string().optional(),
});

// Export types
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
export type ICP = z.infer<typeof ICPSchema>;
export type ResponseClassification = z.infer<typeof ResponseClassificationSchema>;

// ===========================================
// Logging Utility
// ===========================================

const LOG_PREFIX = '[Orchestrator]';

function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} ${LOG_PREFIX} [${level.toUpperCase()}]`;

  if (data !== undefined) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `${prefix} ${message}`,
      typeof data === 'object' ? JSON.stringify(data, null, 2) : data
    );
  } else {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`${prefix} ${message}`);
  }
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Convert Zod schema to JSON Schema format for SDK
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // For now, use a simple conversion - in production, use zod-to-json-schema package
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodValue = value as z.ZodType;
      properties[key] = zodTypeToJsonSchema(zodValue);

      // Check if required (not optional)
      if (!(zodValue instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  return { type: 'object' };
}

function zodTypeToJsonSchema(zodType: z.ZodType): Record<string, unknown> {
  if (zodType instanceof z.ZodString) {
    return { type: 'string' };
  }
  if (zodType instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (zodType instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(zodType.element),
    };
  }
  if (zodType instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: zodType.options,
    };
  }
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }
  if (zodType instanceof z.ZodObject) {
    return zodToJsonSchema(zodType);
  }
  if (zodType instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: true,
    };
  }

  return { type: 'string' };
}

/**
 * Message type from the SDK's async iterator
 */
interface SDKMessage {
  type: string;
  subtype?: string;
  structured_output?: unknown;
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
 * Parse JSON from text (fallback when structured output fails)
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

// ===========================================
// Orchestrator Configuration
// ===========================================

export interface OrchestratorConfig {
  projectRoot?: string;
  tursoUrl?: string;
  tursoToken?: string;
}

// ===========================================
// Main Orchestrator Class
// ===========================================

/**
 * Main orchestrator that coordinates all agent activities using Claude Agent SDK.
 * Skills are loaded from .claude/skills/ and Claude autonomously invokes them.
 * Uses structured outputs for guaranteed JSON responses.
 */
export class Orchestrator {
  private projectRoot: string;
  private storageManagers: Map<string, AgentFSManager> = new Map();
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = config;
    // Default to the monorepo root (3 levels up from this file)
    this.projectRoot = config.projectRoot || path.resolve(__dirname, '..', '..', '..', '..');
    log('info', `Initialized with projectRoot: ${this.projectRoot}`);
  }

  /**
   * Get or create storage manager for a client
   */
  async getStorage(clientId: string): Promise<AgentFSManager> {
    if (!this.storageManagers.has(clientId)) {
      log('debug', `Creating storage manager for client: ${clientId}`);
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
   * Run a query using the Claude Agent SDK with structured output
   */
  private async runStructuredQuery<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options: {
      allowBash?: boolean;
    } = {}
  ): Promise<{ data: T | null; raw: string; error?: string }> {
    const messages: SDKMessage[] = [];
    let structuredOutput: unknown = null;

    const allowedTools = ['Skill', 'Read', 'Write', 'Glob', 'Grep'];
    if (options.allowBash) {
      allowedTools.push('Bash');
    }

    const jsonSchema = zodToJsonSchema(schema);
    log('debug', 'Running structured query with schema', jsonSchema);
    log('debug', 'Prompt:', prompt.substring(0, 200) + '...');

    try {
      for await (const message of query({
        prompt,
        options: {
          cwd: this.projectRoot,
          settingSources: ['project'],
          allowedTools,
          outputFormat: {
            type: 'json_schema',
            schema: jsonSchema,
          },
        },
      })) {
        messages.push(message as SDKMessage);

        // Log message types for debugging
        log('debug', `Received message type: ${(message as SDKMessage).type}`,
          (message as SDKMessage).subtype ? { subtype: (message as SDKMessage).subtype } : undefined);

        // Check for structured output in result messages
        if ((message as SDKMessage).type === 'result') {
          structuredOutput = (message as SDKMessage).structured_output;
          if (structuredOutput) {
            log('info', 'Received structured output from SDK');
          }
        }
      }
    } catch (error) {
      log('error', 'SDK query failed', error);
      return { data: null, raw: '', error: String(error) };
    }

    const rawText = extractTextFromMessages(messages);
    log('debug', `Raw text length: ${rawText.length} chars`);

    // Try structured output first
    if (structuredOutput) {
      log('info', 'Validating structured output with Zod schema');
      const parseResult = schema.safeParse(structuredOutput);
      if (parseResult.success) {
        log('info', 'Structured output validation successful');
        return { data: parseResult.data, raw: rawText };
      }
      log('warn', 'Structured output validation failed', parseResult.error.errors);
    }

    // Fallback: try to parse from raw text
    log('info', 'Falling back to text parsing');
    const parsedJson = parseJSON(rawText);
    if (parsedJson) {
      log('debug', 'Parsed JSON from raw text', parsedJson);
      const parseResult = schema.safeParse(parsedJson);
      if (parseResult.success) {
        log('info', 'Text-parsed JSON validation successful');
        return { data: parseResult.data, raw: rawText };
      }
      log('warn', 'Text-parsed JSON validation failed', parseResult.error.errors);
    }

    log('warn', 'Could not extract valid structured data');
    return { data: null, raw: rawText, error: 'Failed to parse structured output' };
  }

  /**
   * Run a simple text query (no structured output)
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

    log('debug', 'Running text query');

    for await (const message of query({
      prompt,
      options: {
        cwd: this.projectRoot,
        settingSources: ['project'],
        allowedTools,
      },
    })) {
      messages.push(message as SDKMessage);
    }

    return extractTextFromMessages(messages);
  }

  /**
   * Run a simple prompt without skills (for backward compatibility with agents)
   */
  async runPrompt(
    prompt: string,
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
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
  async analyzeWebsite(clientId: string, websiteUrl: string): Promise<BusinessProfile | { raw: string }> {
    log('info', `Starting website analysis for client ${clientId}`, { websiteUrl });

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;

    const prompt = `Use the client-discovery skill to analyze this company's website and generate a comprehensive business profile.

Website URL: ${websiteUrl}
Client ID: ${clientId}

IMPORTANT: Execute the Python scripts using uvx. For example:
uvx --with firecrawl-py --with anthropic --with aiohttp --with python-dotenv python .claude/skills/client-discovery/analysis/website_analyzer.py --url "${websiteUrl}"

Follow the skill workflow to:
1. Analyze the website using website_analyzer.py
2. Research the market using market_researcher.py
3. Generate initial insights

Return a comprehensive business profile based on your analysis.`;

    const result = await this.runStructuredQuery(prompt, BusinessProfileSchema, { allowBash: true });
    const endTime = Date.now() / 1000;

    // Record the tool call
    await storage.recordToolCall(
      'analyze_website',
      startTime,
      endTime,
      { websiteUrl },
      result.data || result.raw
    );

    if (result.data) {
      log('info', 'Website analysis completed successfully', { company: result.data.company_name });
      return result.data;
    }

    log('warn', 'Website analysis returned raw text only', { error: result.error });
    return { raw: result.raw };
  }

  /**
   * Generate ICP from business profile using the client-discovery skill
   */
  async generateICP(clientId: string, businessProfile: unknown): Promise<ICP | { raw: string }> {
    log('info', `Generating ICP for client ${clientId}`);

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;

    const prompt = `Use the client-discovery skill to generate a comprehensive Ideal Customer Profile (ICP) based on this business profile.

Client ID: ${clientId}

Business Profile:
${JSON.stringify(businessProfile, null, 2)}

IMPORTANT: Execute Python scripts using uvx. For example:
uvx --with anthropic --with python-dotenv python .claude/skills/client-discovery/analysis/icp_generator.py

Follow the skill workflow to:
1. Use icp_generator.py to create the ICP
2. Use icp_validator.py to validate it

Generate a detailed ICP with firmographic criteria, geographic targeting, industry targeting, decision maker targeting, and messaging framework.`;

    const result = await this.runStructuredQuery(prompt, ICPSchema, { allowBash: true });
    const endTime = Date.now() / 1000;

    await storage.recordToolCall(
      'generate_icp',
      startTime,
      endTime,
      { businessProfile },
      result.data || result.raw
    );

    if (result.data) {
      log('info', 'ICP generation completed successfully');
      await storage.saveICP(result.data);
      return result.data;
    }

    log('warn', 'ICP generation returned raw text only', { error: result.error });
    return { raw: result.raw };
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
    log('info', `Discovering leads for client ${clientId}`, options);

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;

    const prompt = `Use the lead-discovery skill to find prospects matching this ICP.

Client ID: ${clientId}
Location: ${options.location}
Industry: ${options.industry}
Limit: ${options.limit || 50}

ICP:
${JSON.stringify(icp, null, 2)}

IMPORTANT: Execute Python scripts using uvx. For example:
uvx --with googlemaps --with aiohttp --with anthropic --with python-dotenv python .claude/skills/lead-discovery/google-maps/scraper.py --location "${options.location}" --industry "${options.industry}"

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
      log('info', `Found ${parsed.length} leads`);
      await storage.saveProspects(options.location, options.industry, parsed);
      return parsed;
    }

    log('warn', 'Lead discovery did not return an array');
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
    log('info', `Generating email sequence for client ${clientId}`);

    const storage = await this.getStorage(clientId);
    const startTime = Date.now() / 1000;

    const prompt = `Use the email-personalization skill to generate a 3-email cold outreach sequence.

Client ID: ${clientId}

Prospect:
${JSON.stringify(prospect, null, 2)}

ICP & Messaging Framework:
${JSON.stringify(icp, null, 2)}

IMPORTANT: Execute Python scripts using uvx. For example:
uvx --with anthropic --with python-dotenv python .claude/skills/email-personalization/personalization_engine.py

Follow the skill workflow to generate personalized emails.

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
      log('info', `Generated ${parsed.length} emails`);
      return parsed;
    }

    log('warn', 'Email sequence generation did not return an array');
    return [];
  }

  /**
   * Classify email response sentiment using the email-tracking skill
   */
  async classifyResponse(
    responseText: string,
    originalEmail: string
  ): Promise<ResponseClassification> {
    log('info', 'Classifying email response');

    const prompt = `Use the email-tracking skill to classify this email response.

Original Email:
${originalEmail}

Response:
${responseText}

Classify the response sentiment and determine if action is needed.`;

    const result = await this.runStructuredQuery(prompt, ResponseClassificationSchema);

    if (result.data) {
      log('info', 'Response classification successful', { sentiment: result.data.sentiment });
      return result.data;
    }

    log('warn', 'Response classification failed, using default');
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
    log('debug', 'Scoring prospect against ICP');

    const prompt = `Score this prospect against the ICP on a scale of 0 to 1.

Prospect:
${JSON.stringify(prospect, null, 2)}

ICP:
${JSON.stringify(icp, null, 2)}

Consider: company size, industry, location, and decision maker fit.
Return ONLY a number between 0 and 1 (e.g., 0.85).`;

    const result = await this.runQuery(prompt);
    const score = parseFloat(result.trim());
    const finalScore = isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));

    log('debug', `Prospect score: ${finalScore}`);
    return finalScore;
  }

  /**
   * Get campaign analytics using the campaign-management skill
   */
  async getCampaignAnalytics(campaignId: string): Promise<unknown> {
    log('info', `Getting analytics for campaign ${campaignId}`);

    const prompt = `Use the campaign-management skill to generate analytics for campaign ${campaignId}.

IMPORTANT: Execute Python scripts using uvx. For example:
uvx --with python-dotenv python .claude/skills/campaign-management/analytics.py campaign --campaign-id ${campaignId}

Return the analytics data as JSON.`;

    const result = await this.runQuery(prompt, { allowBash: true });
    const parsed = parseJSON(result);

    if (parsed) {
      log('info', 'Campaign analytics retrieved');
      return parsed;
    }

    log('warn', 'Campaign analytics returned raw text');
    return { raw: result };
  }

  /**
   * Clean up and close connections
   */
  async shutdown(): Promise<void> {
    log('info', 'Shutting down orchestrator');
    for (const manager of this.storageManagers.values()) {
      manager.close();
    }
    this.storageManagers.clear();
  }
}
