/**
 * Enhanced Deep Researcher - Recursive research with follow-up questions
 *
 * This module implements a sophisticated research paradigm inspired by
 * tree-search through information space. Key features:
 *
 * 1. Recursive depth-first research with configurable depth/breadth
 * 2. AI-generated search queries that adapt to findings
 * 3. Relevance evaluation to filter noise
 * 4. Learning extraction with follow-up questions
 * 5. Progressive knowledge accumulation
 * 6. Sales-focused synthesis with actionable angles
 *
 * The core insight: research is exploratory. Initial findings should
 * drive deeper investigation through follow-up questions.
 */

import { generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { z, ZodSchema } from 'zod';
import { nanoid } from 'nanoid';
import type {
  Learning,
  EvaluatedSearchResult,
  ResearchSession,
  EnhancedResearchProgressEvent,
  ConfigurableResearchPhase,
} from '@cold-outreach/shared';

// =============================================================================
// Configuration
// =============================================================================

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Lazy-initialized DeepSeek client (created on first use to ensure env vars are loaded)
let _deepseekClient: ReturnType<typeof createDeepSeek> | null = null;

function getDeepSeekClient() {
  if (!_deepseekClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is not set');
    }
    log('deepseek_init', { hasApiKey: true, keyPrefix: apiKey.substring(0, 8) + '...' });
    _deepseekClient = createDeepSeek({ apiKey });
  }
  return _deepseekClient;
}

// Model selection:
// - deepseek-chat: For all tasks (DeepSeek R1/reasoner doesn't support structured output)
const MODELS = {
  structured: 'deepseek-chat' as const,
};

// =============================================================================
// Structured Output Helper
// =============================================================================

/**
 * Generate structured output using generateText with manual JSON parsing.
 * This is the recommended approach for DeepSeek since it doesn't support
 * native JSON schema mode in generateObject.
 */
async function generateStructuredOutput<T>(params: {
  schema: ZodSchema<T>;
  prompt: string;
}): Promise<T> {
  const { schema, prompt } = params;

  const enhancedPrompt = `${prompt}

IMPORTANT: You MUST respond with ONLY a valid JSON object. No explanation, no markdown, no code blocks.
The JSON must match this structure exactly.
Start your response with { and end with }`;

  const { text } = await generateText({
    model: getDeepSeekClient()(MODELS.structured),
    prompt: enhancedPrompt,
  });

  // Extract JSON from response (handle potential markdown code blocks)
  let jsonStr = text.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  // Find JSON object boundaries
  const startIndex = jsonStr.indexOf('{');
  const endIndex = jsonStr.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`No valid JSON object found in response: ${text.substring(0, 200)}`);
  }

  jsonStr = jsonStr.slice(startIndex, endIndex + 1);

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (parseError) {
    throw new Error(`Failed to parse JSON: ${parseError}. Response: ${jsonStr.substring(0, 200)}`);
  }

  // Validate against schema
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.message}. Parsed: ${JSON.stringify(parsed).substring(0, 200)}`);
  }

  return result.data;
}

// =============================================================================
// Logging
// =============================================================================

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    component: 'EnhancedDeepResearcher',
    event,
    ...data,
  }));
}

// =============================================================================
// Types
// =============================================================================

export interface ResearchConfig {
  depth: number;      // How many levels of follow-up (1-3)
  breadth: number;    // Queries per level (1-5)
  focus: 'sales' | 'competitive' | 'comprehensive';
  phases: ConfigurableResearchPhase[];  // Which phases to run
}

// Hard limits to prevent runaway research
const LIMITS = {
  MAX_DEPTH: 3,
  MAX_BREADTH: 5,
  MAX_TOTAL_QUERIES: 20,
  MAX_FOLLOW_UP_QUESTIONS: 2,      // Max follow-ups per learning
  MAX_LEARNINGS_IN_CONTEXT: 10,    // How many learnings to show for duplicate detection
};

export interface ProspectContext {
  id: string;
  companyName: string;
  website?: string;
  industry?: string;
  location?: string;
  country?: string;   // Country code or name for language detection
  contacts?: Array<{ name: string; title: string }>;
  // Optional: ICP context for better relevance
  icpContext?: {
    painPoints?: string[];
    valuePropositions?: string[];
  };
}

// =============================================================================
// Language Detection
// =============================================================================

const COUNTRY_LANGUAGE_MAP: Record<string, { language: string; languageCode: string }> = {
  // Nordic countries
  'finland': { language: 'Finnish', languageCode: 'fi' },
  'fi': { language: 'Finnish', languageCode: 'fi' },
  'suomi': { language: 'Finnish', languageCode: 'fi' },
  'sweden': { language: 'Swedish', languageCode: 'sv' },
  'se': { language: 'Swedish', languageCode: 'sv' },
  'sverige': { language: 'Swedish', languageCode: 'sv' },
  'norway': { language: 'Norwegian', languageCode: 'no' },
  'no': { language: 'Norwegian', languageCode: 'no' },
  'norge': { language: 'Norwegian', languageCode: 'no' },
  'denmark': { language: 'Danish', languageCode: 'da' },
  'dk': { language: 'Danish', languageCode: 'da' },
  'danmark': { language: 'Danish', languageCode: 'da' },
  'iceland': { language: 'Icelandic', languageCode: 'is' },
  'is': { language: 'Icelandic', languageCode: 'is' },
  // Western Europe
  'germany': { language: 'German', languageCode: 'de' },
  'de': { language: 'German', languageCode: 'de' },
  'deutschland': { language: 'German', languageCode: 'de' },
  'austria': { language: 'German', languageCode: 'de' },
  'at': { language: 'German', languageCode: 'de' },
  'switzerland': { language: 'German', languageCode: 'de' },
  'ch': { language: 'German', languageCode: 'de' },
  'france': { language: 'French', languageCode: 'fr' },
  'fr': { language: 'French', languageCode: 'fr' },
  'belgium': { language: 'French', languageCode: 'fr' },
  'be': { language: 'French', languageCode: 'fr' },
  'netherlands': { language: 'Dutch', languageCode: 'nl' },
  'nl': { language: 'Dutch', languageCode: 'nl' },
  'holland': { language: 'Dutch', languageCode: 'nl' },
  // Southern Europe
  'spain': { language: 'Spanish', languageCode: 'es' },
  'es': { language: 'Spanish', languageCode: 'es' },
  'españa': { language: 'Spanish', languageCode: 'es' },
  'mexico': { language: 'Spanish', languageCode: 'es' },
  'mx': { language: 'Spanish', languageCode: 'es' },
  'italy': { language: 'Italian', languageCode: 'it' },
  'it': { language: 'Italian', languageCode: 'it' },
  'italia': { language: 'Italian', languageCode: 'it' },
  'portugal': { language: 'Portuguese', languageCode: 'pt' },
  'pt': { language: 'Portuguese', languageCode: 'pt' },
  'brazil': { language: 'Portuguese', languageCode: 'pt' },
  'br': { language: 'Portuguese', languageCode: 'pt' },
  'brasil': { language: 'Portuguese', languageCode: 'pt' },
  'greece': { language: 'Greek', languageCode: 'el' },
  'gr': { language: 'Greek', languageCode: 'el' },
  // Eastern Europe
  'poland': { language: 'Polish', languageCode: 'pl' },
  'pl': { language: 'Polish', languageCode: 'pl' },
  'polska': { language: 'Polish', languageCode: 'pl' },
  'czech republic': { language: 'Czech', languageCode: 'cs' },
  'czechia': { language: 'Czech', languageCode: 'cs' },
  'cz': { language: 'Czech', languageCode: 'cs' },
  'hungary': { language: 'Hungarian', languageCode: 'hu' },
  'hu': { language: 'Hungarian', languageCode: 'hu' },
  'romania': { language: 'Romanian', languageCode: 'ro' },
  'ro': { language: 'Romanian', languageCode: 'ro' },
  'russia': { language: 'Russian', languageCode: 'ru' },
  'ru': { language: 'Russian', languageCode: 'ru' },
  'ukraine': { language: 'Ukrainian', languageCode: 'uk' },
  'ua': { language: 'Ukrainian', languageCode: 'uk' },
  // Asia
  'japan': { language: 'Japanese', languageCode: 'ja' },
  'jp': { language: 'Japanese', languageCode: 'ja' },
  'china': { language: 'Chinese', languageCode: 'zh' },
  'cn': { language: 'Chinese', languageCode: 'zh' },
  'korea': { language: 'Korean', languageCode: 'ko' },
  'south korea': { language: 'Korean', languageCode: 'ko' },
  'kr': { language: 'Korean', languageCode: 'ko' },
  'india': { language: 'Hindi', languageCode: 'hi' },
  'in': { language: 'Hindi', languageCode: 'hi' },
  // Middle East
  'israel': { language: 'Hebrew', languageCode: 'he' },
  'il': { language: 'Hebrew', languageCode: 'he' },
  'saudi arabia': { language: 'Arabic', languageCode: 'ar' },
  'uae': { language: 'Arabic', languageCode: 'ar' },
  'dubai': { language: 'Arabic', languageCode: 'ar' },
  'turkey': { language: 'Turkish', languageCode: 'tr' },
  'tr': { language: 'Turkish', languageCode: 'tr' },
  // English-speaking (default)
  'usa': { language: 'English', languageCode: 'en' },
  'us': { language: 'English', languageCode: 'en' },
  'united states': { language: 'English', languageCode: 'en' },
  'uk': { language: 'English', languageCode: 'en' },
  'united kingdom': { language: 'English', languageCode: 'en' },
  'gb': { language: 'English', languageCode: 'en' },
  'england': { language: 'English', languageCode: 'en' },
  'canada': { language: 'English', languageCode: 'en' },
  'ca': { language: 'English', languageCode: 'en' },
  'australia': { language: 'English', languageCode: 'en' },
  'au': { language: 'English', languageCode: 'en' },
  'ireland': { language: 'English', languageCode: 'en' },
  'ie': { language: 'English', languageCode: 'en' },
  'new zealand': { language: 'English', languageCode: 'en' },
  'nz': { language: 'English', languageCode: 'en' },
};

/**
 * Detect language from country or location string
 */
function detectLanguage(country?: string, location?: string): { language: string; languageCode: string } {
  const defaultLang = { language: 'English', languageCode: 'en' };

  // Try country first
  if (country) {
    const normalized = country.toLowerCase().trim();
    if (COUNTRY_LANGUAGE_MAP[normalized]) {
      return COUNTRY_LANGUAGE_MAP[normalized];
    }
  }

  // Try to extract country from location string (e.g., "Helsinki, Finland")
  if (location) {
    const parts = location.toLowerCase().split(/[,\s]+/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (COUNTRY_LANGUAGE_MAP[trimmed]) {
        return COUNTRY_LANGUAGE_MAP[trimmed];
      }
    }
  }

  return defaultLang;
}

export type ProgressCallback = (event: EnhancedResearchProgressEvent) => void;

interface PerplexityResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

// =============================================================================
// Research Engine
// =============================================================================

/**
 * The EnhancedResearchEngine manages the recursive research process.
 * It accumulates knowledge across iterations and generates sales-focused outputs.
 */
export class EnhancedResearchEngine {
  private session: ResearchSession;
  private config: ResearchConfig;
  private prospect: ProspectContext;
  private onProgress?: ProgressCallback;
  private perplexityApiKey: string;
  private startTime: number;
  private language: { language: string; languageCode: string };

  constructor(
    prospect: ProspectContext,
    config: Partial<ResearchConfig> = {},
    onProgress?: ProgressCallback
  ) {
    this.prospect = prospect;
    // Apply config with hard limits
    const defaultPhases: ConfigurableResearchPhase[] = ['company', 'contacts', 'contact_discovery', 'market'];
    this.config = {
      depth: Math.min(config.depth ?? 2, LIMITS.MAX_DEPTH),
      breadth: Math.min(config.breadth ?? 3, LIMITS.MAX_BREADTH),
      focus: config.focus ?? 'sales',
      phases: config.phases ?? defaultPhases,
    };
    this.onProgress = onProgress;
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY ?? '';
    this.startTime = Date.now();

    log('config_applied', {
      requested: config,
      applied: this.config,
      limits: LIMITS,
    });

    // Detect language from prospect location/country
    this.language = detectLanguage(prospect.country, prospect.location);
    log('language_detected', {
      prospectId: prospect.id,
      country: prospect.country,
      location: prospect.location,
      language: this.language.language,
      languageCode: this.language.languageCode,
    });

    // Initialize session
    this.session = {
      id: `research-${nanoid(10)}`,
      prospectId: prospect.id,
      prospectName: prospect.companyName,
      config: this.config,
      queries: [],
      completedQueries: [],
      searchResults: [],
      learnings: [],
      phases: {
        company: { completed: false, learningsCount: 0 },
        contacts: { completed: false, learningsCount: 0 },
        contact_discovery: { completed: false, learningsCount: 0, contactsFound: 0 },
        market: { completed: false, learningsCount: 0 },
        synthesis: { completed: false },
      },
      salesAngles: [],
      personalizationHooks: [],
      stats: {
        totalQueries: 0,
        totalSearchResults: 0,
        relevantResults: 0,
        totalLearnings: 0,
        researchDepthReached: 0,
        durationMs: 0,
      },
      startedAt: new Date().toISOString(),
    };
  }

  /**
   * Execute the full research process
   */
  async execute(): Promise<ResearchSession> {
    log('research_start', {
      sessionId: this.session.id,
      prospect: this.prospect.companyName,
      config: this.config,
    });

    this.emitProgress('initializing', 'Starting enhanced deep research...');

    const shouldRun = (phase: ConfigurableResearchPhase) => this.config.phases.includes(phase);

    try {
      // Phase 1: Company Research (recursive)
      if (shouldRun('company')) {
        await this.researchPhase(
          'company',
          this.buildCompanyResearchPrompt(),
          this.config.depth,
          this.config.breadth
        );
      } else {
        this.session.phases.company.completed = true;
        log('phase_skipped', { phase: 'company' });
      }

      // Phase 2: Contact Research (existing contacts' backgrounds)
      if (shouldRun('contacts')) {
        if (this.prospect.contacts && this.prospect.contacts.length > 0) {
          await this.researchPhase(
            'contacts',
            this.buildContactResearchPrompt(),
            Math.max(1, this.config.depth - 1), // Slightly less depth for contacts
            Math.ceil(this.config.breadth / 2)
          );
        } else {
          this.session.phases.contacts.completed = true;
          log('phase_skipped', { phase: 'contacts', reason: 'no_existing_contacts' });
        }
      } else {
        this.session.phases.contacts.completed = true;
        log('phase_skipped', { phase: 'contacts' });
      }

      // Phase 3: Contact Discovery (find NEW contacts)
      if (shouldRun('contact_discovery')) {
        await this.discoverContacts();
      } else {
        this.session.phases.contact_discovery.completed = true;
        log('phase_skipped', { phase: 'contact_discovery' });
      }

      // Phase 4: Market Research (recursive)
      if (shouldRun('market')) {
        await this.researchPhase(
          'market',
          this.buildMarketResearchPrompt(),
          Math.max(1, this.config.depth - 1),
          this.config.breadth
        );
      } else {
        this.session.phases.market.completed = true;
        log('phase_skipped', { phase: 'market' });
      }

      // Phase 5: Sales Synthesis (always run if we have learnings)
      if (this.session.learnings.length > 0) {
        await this.synthesizeForSales();
      } else {
        this.session.phases.synthesis.completed = true;
        log('phase_skipped', { phase: 'synthesis', reason: 'no_learnings' });
      }

      // Finalize session
      this.session.completedAt = new Date().toISOString();
      this.session.stats.durationMs = Date.now() - this.startTime;

      this.emitProgress('complete', 'Research complete!');

      log('research_complete', {
        sessionId: this.session.id,
        stats: this.session.stats,
        salesAnglesCount: this.session.salesAngles.length,
        personalizationHooksCount: this.session.personalizationHooks.length,
      });

      return this.session;

    } catch (error) {
      log('research_error', {
        sessionId: this.session.id,
        error: error instanceof Error ? error.message : String(error),
      });

      this.emitProgress('failed', `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      throw error;
    }
  }

  // ===========================================================================
  // Core Research Loop
  // ===========================================================================

  /**
   * Execute a research phase with recursive follow-up
   */
  private async researchPhase(
    phase: 'company' | 'contacts' | 'market',
    initialPrompt: string,
    depth: number,
    breadth: number
  ): Promise<void> {
    log('phase_start', { phase, depth, breadth });

    const phaseLearnings = await this.recursiveResearch(
      initialPrompt,
      depth,
      breadth,
      phase
    );

    this.session.phases[phase].completed = true;
    this.session.phases[phase].learningsCount = phaseLearnings;

    log('phase_complete', {
      phase,
      learningsCount: phaseLearnings,
    });
  }

  /**
   * Get a summary of existing learnings for duplicate detection context
   */
  private getLearningsContext(): string {
    if (this.session.learnings.length === 0) {
      return 'No learnings gathered yet.';
    }

    const recentLearnings = this.session.learnings.slice(-LIMITS.MAX_LEARNINGS_IN_CONTEXT);
    return recentLearnings
      .map((l, i) => `${i + 1}. [${l.category}] ${l.insight}`)
      .join('\n');
  }

  /**
   * The recursive research function - heart of the system
   */
  private async recursiveResearch(
    prompt: string,
    depth: number,
    breadth: number,
    context: string,
    accumulatedLearnings: number = 0
  ): Promise<number> {
    // Base case: depth exhausted
    if (depth <= 0) {
      return accumulatedLearnings;
    }

    // Safety: check total queries limit
    if (this.session.completedQueries.length >= LIMITS.MAX_TOTAL_QUERIES) {
      log('queries_limit_reached', {
        completed: this.session.completedQueries.length,
        limit: LIMITS.MAX_TOTAL_QUERIES,
      });
      return accumulatedLearnings;
    }

    this.session.stats.researchDepthReached = Math.max(
      this.session.stats.researchDepthReached,
      this.config.depth - depth + 1
    );

    // Step 1: Generate search queries
    this.emitProgress('generating_queries', `Generating ${breadth} search queries for ${context}...`);

    const queries = await this.generateSearchQueries(prompt, breadth, context);
    this.session.queries.push(...queries);
    this.session.stats.totalQueries += queries.length;

    log('queries_generated', { context, queries, depth });

    // Step 2: For each query, search and process
    for (const query of queries) {
      // Skip if we've already done this exact query
      if (this.session.completedQueries.includes(query)) {
        continue;
      }

      // Safety: check total queries limit mid-loop
      if (this.session.completedQueries.length >= LIMITS.MAX_TOTAL_QUERIES) {
        log('queries_limit_reached_midloop', { limit: LIMITS.MAX_TOTAL_QUERIES });
        break;
      }

      this.emitProgress('searching', `Searching: "${query.substring(0, 50)}..."`, query);

      // Search
      const searchResults = await this.searchPerplexity(query);
      this.session.stats.totalSearchResults += searchResults.length;

      // Evaluate relevance
      this.emitProgress('evaluating', `Evaluating ${searchResults.length} results...`);

      const evaluatedResults = await this.evaluateResults(query, searchResults);
      const relevantResults = evaluatedResults.filter(r => r.isRelevant);
      this.session.searchResults.push(...evaluatedResults);
      this.session.stats.relevantResults += relevantResults.length;

      log('results_evaluated', {
        query,
        total: searchResults.length,
        relevant: relevantResults.length,
      });

      // Extract learnings from relevant results
      for (const result of relevantResults) {
        this.emitProgress('extracting_learnings', `Extracting insights from ${result.title}...`);

        const learning = await this.extractLearning(query, result, context);

        if (learning) {
          this.session.learnings.push(learning);
          this.session.stats.totalLearnings++;
          accumulatedLearnings++;

          this.emitProgress(
            'extracting_learnings',
            `Found: ${learning.insight.substring(0, 80)}...`,
            undefined,
            learning.insight
          );

          log('learning_extracted', {
            insight: learning.insight.substring(0, 100),
            followUpCount: learning.followUpQuestions.length,
            category: learning.category,
          });

          // Recursive follow-up if we have questions and depth remaining
          if (learning.followUpQuestions.length > 0 && depth > 1) {
            const followUpPrompt = this.buildFollowUpPrompt(prompt, learning);

            this.emitProgress('following_up', `Following up on: ${learning.followUpQuestions[0]?.substring(0, 50)}...`);

            // Recurse with reduced depth and breadth
            const additionalLearnings = await this.recursiveResearch(
              followUpPrompt,
              depth - 1,
              Math.ceil(breadth / 2),
              context,
              accumulatedLearnings
            );

            accumulatedLearnings = additionalLearnings;
          }
        }
      }

      this.session.completedQueries.push(query);
    }

    return accumulatedLearnings;
  }

  // ===========================================================================
  // Query Generation
  // ===========================================================================

  /**
   * Generate search queries using AI
   */
  private async generateSearchQueries(
    prompt: string,
    count: number,
    context: string
  ): Promise<string[]> {
    const isNonEnglish = this.language.languageCode !== 'en';
    const languageInstruction = isNonEnglish
      ? `\n\nIMPORTANT: This company is located in a ${this.language.language}-speaking region. Generate search queries primarily in ${this.language.language} to find local news and information. Include 1-2 English queries for international coverage, but prioritize ${this.language.language} queries.`
      : '';

    try {
      const querySchema = z.object({
        queries: z.array(z.string()).min(1).max(10),
      });

      const result = await generateStructuredOutput({
        schema: querySchema,
        prompt: `You are a business researcher preparing to investigate a company for B2B sales purposes.

Research context: ${context}
Company: ${this.prospect.companyName}
${this.prospect.industry ? `Industry: ${this.prospect.industry}` : ''}
${this.prospect.website ? `Website: ${this.prospect.website}` : ''}
${this.prospect.location ? `Location: ${this.prospect.location}` : ''}
${this.prospect.country ? `Country: ${this.prospect.country}` : ''}
Target language: ${this.language.language} (${this.language.languageCode})

Current research goal: ${prompt}

Already searched: ${this.session.completedQueries.slice(-5).join(', ') || 'Nothing yet'}

Generate ${count} specific, targeted search queries that will help uncover:
- Recent news and announcements
- Business challenges and opportunities
- Leadership and organizational changes
- Competitive positioning
- Technology and tools they use
- Growth signals and initiatives

Make queries specific to "${this.prospect.companyName}" when possible.
Avoid generic queries - be specific and actionable.${languageInstruction}

Respond with JSON in this format: {"queries": ["query1", "query2", ...]}`,
      });

      return result.queries;
    } catch (error) {
      const errorStr = String(error);
      log('query_generation_error', { error: errorStr });

      // If unauthorized, throw to fail the whole research
      if (errorStr.includes('Unauthorized') || errorStr.includes('401')) {
        throw new Error('DeepSeek API key is invalid or expired. Please check your DEEPSEEK_API_KEY.');
      }

      // Fallback to basic query for other errors (use local language keywords)
      const localizedContext = this.getLocalizedContextKeyword(context);
      return [`${this.prospect.companyName} ${localizedContext}`];
    }
  }

  /**
   * Get localized context keyword for fallback queries
   */
  private getLocalizedContextKeyword(context: string): string {
    const contextTranslations: Record<string, Record<string, string>> = {
      company: {
        fi: 'yritys uutiset', sv: 'företag nyheter', de: 'unternehmen nachrichten',
        fr: 'entreprise actualités', es: 'empresa noticias', it: 'azienda notizie',
        nl: 'bedrijf nieuws', pl: 'firma wiadomości', pt: 'empresa notícias',
        en: 'company news',
      },
      contacts: {
        fi: 'johto henkilöstö', sv: 'ledning personal', de: 'führung mitarbeiter',
        fr: 'direction personnel', es: 'dirección personal', it: 'direzione personale',
        nl: 'leiding personeel', pl: 'kierownictwo personel', pt: 'direção pessoal',
        en: 'leadership team',
      },
      market: {
        fi: 'markkinat toimiala', sv: 'marknad bransch', de: 'markt branche',
        fr: 'marché secteur', es: 'mercado sector', it: 'mercato settore',
        nl: 'markt sector', pl: 'rynek sektor', pt: 'mercado setor',
        en: 'market industry',
      },
    };

    const translations = contextTranslations[context];
    const localTranslation = translations?.[this.language.languageCode];
    if (localTranslation) {
      return localTranslation;
    }
    return translations?.en || `${context} news`;
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  /**
   * Search using Perplexity API
   */
  private async searchPerplexity(query: string): Promise<Array<{ title: string; url: string; content: string }>> {
    if (!this.perplexityApiKey) {
      log('search_skip', { reason: 'no_api_key' });
      return [];
    }

    try {
      // Build language-aware system prompt
      const isNonEnglish = this.language.languageCode !== 'en';
      const languageContext = isNonEnglish
        ? ` Prioritize ${this.language.language} sources and local business information. You may respond in ${this.language.language} if the query is in that language.`
        : '';

      const response = await fetch(PERPLEXITY_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: `You are a research assistant. Provide factual information with sources. Include URLs when available.${languageContext}`,
            },
            {
              role: 'user',
              content: query,
            },
          ],
          max_tokens: 1500,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        log('search_error', { status: response.status });
        return [];
      }

      const data = await response.json() as PerplexityResponse;
      const content = data.choices?.[0]?.message?.content || '';

      // Parse the response into structured results
      // Perplexity returns prose, so we treat it as one result
      if (content) {
        return [{
          title: query,
          url: 'perplexity-search',
          content: content.substring(0, 3000),
        }];
      }

      return [];
    } catch (error) {
      log('search_error', { error: String(error) });
      return [];
    }
  }

  // ===========================================================================
  // Relevance Evaluation
  // ===========================================================================

  /**
   * Evaluate search results for relevance
   */
  private async evaluateResults(
    query: string,
    results: Array<{ title: string; url: string; content: string }>
  ): Promise<EvaluatedSearchResult[]> {
    const evaluated: EvaluatedSearchResult[] = [];

    const relevanceSchema = z.object({
      isRelevant: z.boolean(),
      relevanceScore: z.number().min(0).max(1),
      reason: z.string(),
    });

    for (const result of results) {
      try {
        const learningsContext = this.getLearningsContext();
        const evalResult = await generateStructuredOutput({
          schema: relevanceSchema,
          prompt: `Evaluate if this search result is relevant and useful for B2B sales research.

Company we're researching: ${this.prospect.companyName}
Original query: ${query}
Research focus: ${this.config.focus}

Search result:
Title: ${result.title}
Content: ${result.content.substring(0, 1500)}

INFORMATION WE ALREADY HAVE (check for duplicates):
${learningsContext}

Evaluate:
1. Is this about the right company (${this.prospect.companyName})?
2. Does it contain actionable business intelligence?
3. Is the information recent and relevant?
4. Would this help craft a personalized sales approach?
5. Is this NEW information not already in our learnings above?

A result is IRRELEVANT if:
- It's about a different company with similar name
- It's generic industry information without specific company details
- It's outdated (more than 2 years old) unless historically significant
- It duplicates or overlaps significantly with information we already have

Respond with JSON: {"isRelevant": true/false, "relevanceScore": 0.0-1.0, "reason": "explanation"}`,
        });

        evaluated.push({
          query,
          title: result.title,
          url: result.url,
          content: result.content,
          relevanceScore: evalResult.relevanceScore,
          isRelevant: evalResult.isRelevant,
          evaluationReason: evalResult.reason,
        });

      } catch (error) {
        // On error, include with medium confidence
        evaluated.push({
          query,
          title: result.title,
          url: result.url,
          content: result.content,
          relevanceScore: 0.5,
          isRelevant: true,
          evaluationReason: 'Evaluation failed, included by default',
        });
      }
    }

    return evaluated;
  }

  // ===========================================================================
  // Learning Extraction
  // ===========================================================================

  /**
   * Extract a learning with follow-up questions from a search result
   */
  private async extractLearning(
    query: string,
    result: EvaluatedSearchResult,
    context: string
  ): Promise<Learning | null> {
    const learningSchema = z.object({
      insight: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
      category: z.enum([
        'funding', 'news', 'product', 'competitor', 'leadership',
        'culture', 'technology', 'market', 'pain_point', 'opportunity', 'general'
      ]),
      followUpQuestions: z.array(z.string()).max(LIMITS.MAX_FOLLOW_UP_QUESTIONS),
    });

    const learningsContext = this.getLearningsContext();

    try {
      const learningResult = await generateStructuredOutput({
        schema: learningSchema,
        prompt: `Extract a key learning from this research result for B2B sales purposes.

Company: ${this.prospect.companyName}
Research context: ${context}
Query: ${query}

Search result:
${result.content.substring(0, 2000)}

INFORMATION WE ALREADY HAVE (avoid duplicating):
${learningsContext}

Extract:
1. The single most important NEW insight for sales (be specific, include numbers/dates if available)
2. How confident we can be in this information
3. What category this falls into
4. 0-${LIMITS.MAX_FOLLOW_UP_QUESTIONS} follow-up questions ONLY if this finding is significant and warrants deeper investigation

Follow-up questions should:
- Dig deeper into implications ("How is this affecting their operations?")
- Seek related information ("Who else was involved in this?")
- NOT duplicate queries we've already done
- Be generated SPARINGLY - only for truly important findings

The insight should be SPECIFIC, NEW (not duplicating above), and ACTIONABLE for sales outreach.

Respond with JSON: {"insight": "...", "confidence": "high|medium|low", "category": "one of: funding, news, product, competitor, leadership, culture, technology, market, pain_point, opportunity, general", "followUpQuestions": []}`,
      });

      // Enforce follow-up question limit
      const limitedFollowUps = learningResult.followUpQuestions.slice(0, LIMITS.MAX_FOLLOW_UP_QUESTIONS);

      return {
        insight: learningResult.insight,
        confidence: learningResult.confidence,
        source: result.title,
        sourceUrl: result.url !== 'perplexity-search' ? result.url : undefined,
        category: learningResult.category,
        followUpQuestions: limitedFollowUps,
        discoveredAt: new Date().toISOString(),
      };

    } catch (error) {
      log('learning_extraction_error', { error: String(error) });
      return null;
    }
  }

  // ===========================================================================
  // Sales Synthesis
  // ===========================================================================

  /**
   * Synthesize learnings into sales angles and personalization hooks
   */
  private async synthesizeForSales(): Promise<void> {
    if (this.session.learnings.length === 0) {
      log('synthesis_skip', { reason: 'no_learnings' });
      return;
    }

    this.emitProgress('synthesizing', 'Synthesizing research into sales angles...');

    log('synthesis_start', { learningsCount: this.session.learnings.length });

    // Prepare learnings summary
    const learningsSummary = this.session.learnings
      .map((l, i) => `${i + 1}. [${l.category}] ${l.insight} (confidence: ${l.confidence})`)
      .join('\n');

    const synthesisSchema = z.object({
      salesAngles: z.array(z.object({
        angle: z.string(),
        reasoning: z.string(),
        talkingPoints: z.array(z.string()),
        supportingEvidence: z.array(z.string()),
        strength: z.enum(['strong', 'moderate', 'weak']),
        bestContactTitle: z.string().optional(),
      })).max(5),
      personalizationHooks: z.array(z.object({
        hook: z.string(),
        type: z.enum([
          'recent_news', 'funding_event', 'leadership_change',
          'company_milestone', 'shared_connection', 'industry_trend',
          'pain_point', 'competitor_mention', 'technology_stack'
        ]),
        basedOn: z.string(),
        freshness: z.enum(['very_recent', 'recent', 'older']),
      })).max(5),
      recommendedApproach: z.object({
        primaryAngle: z.string(),
        openingLine: z.string(),
        keyPoints: z.array(z.string()),
        callToAction: z.string(),
        warnings: z.array(z.string()),
      }),
    });

    try {
      const anglesResult = await generateStructuredOutput({
        schema: synthesisSchema,
        prompt: `You are a B2B sales strategist. Based on the research findings below, create actionable sales intelligence.

COMPANY: ${this.prospect.companyName}
${this.prospect.industry ? `INDUSTRY: ${this.prospect.industry}` : ''}
${this.prospect.contacts?.length ? `KEY CONTACTS: ${this.prospect.contacts.map(c => `${c.name} (${c.title})`).join(', ')}` : ''}

${this.prospect.icpContext ? `
OUR VALUE PROPOSITION:
${this.prospect.icpContext.valuePropositions?.join(', ') || 'General business solutions'}

PAIN POINTS WE SOLVE:
${this.prospect.icpContext.painPoints?.join(', ') || 'Various business challenges'}
` : ''}

RESEARCH FINDINGS:
${learningsSummary}

Generate:

1. SALES ANGLES (2-4): Different approaches to open a conversation
   - Each angle should be a distinct "way in" based on different findings
   - Include specific talking points with evidence
   - Rate strength based on how compelling and timely the angle is
   - Suggest which contact title this angle would resonate with most

2. PERSONALIZATION HOOKS (3-5): Specific openings for cold outreach
   - These should be 1-2 sentence openers that show we've done our homework
   - Reference specific findings (not generic flattery)
   - Rate freshness (very_recent = last 30 days, recent = 1-6 months, older = 6+ months)

3. RECOMMENDED APPROACH: The single best strategy
   - Primary angle to lead with
   - Suggested opening line for email
   - 3-4 key points to make in sequence
   - Clear call to action
   - Warnings: things to NOT mention (sensitive topics, recent layoffs, etc.)

Be specific. Use actual findings. Avoid generic sales speak.

Respond with JSON matching this structure:
{
  "salesAngles": [{"angle": "...", "reasoning": "...", "talkingPoints": ["..."], "supportingEvidence": ["..."], "strength": "strong|moderate|weak", "bestContactTitle": "..."}],
  "personalizationHooks": [{"hook": "...", "type": "recent_news|funding_event|leadership_change|company_milestone|shared_connection|industry_trend|pain_point|competitor_mention|technology_stack", "basedOn": "...", "freshness": "very_recent|recent|older"}],
  "recommendedApproach": {"primaryAngle": "...", "openingLine": "...", "keyPoints": ["..."], "callToAction": "...", "warnings": ["..."]}
}`,
      });

      this.session.salesAngles = anglesResult.salesAngles;
      this.session.personalizationHooks = anglesResult.personalizationHooks;
      this.session.recommendedApproach = anglesResult.recommendedApproach;
      this.session.phases.synthesis.completed = true;

      log('synthesis_complete', {
        anglesCount: this.session.salesAngles.length,
        hooksCount: this.session.personalizationHooks.length,
        hasRecommendedApproach: !!this.session.recommendedApproach,
      });

    } catch (error) {
      log('synthesis_error', { error: String(error) });
      // Mark as complete even if synthesis fails - we still have learnings
      this.session.phases.synthesis.completed = true;
    }
  }

  // ===========================================================================
  // Contact Discovery Phase
  // ===========================================================================

  /**
   * Discover new contacts (decision makers) at the company.
   * This searches for key people, their titles, emails, and LinkedIn profiles.
   */
  private async discoverContacts(): Promise<void> {
    log('contact_discovery_start', { company: this.prospect.companyName });

    this.emitProgress('searching', `Finding decision makers at ${this.prospect.companyName}...`);

    // Build search queries for finding contacts
    const industryContext = this.prospect.industry ? ` ${this.prospect.industry}` : '';
    const searchQueries = [
      `${this.prospect.companyName} leadership team executives`,
      `${this.prospect.companyName} CEO CTO CMO founders`,
      `${this.prospect.companyName}${industryContext} decision makers management`,
    ];

    const discoveredPeople: Array<{
      name: string;
      title: string;
      email?: string;
      linkedIn?: string;
      source: string;
    }> = [];

    // Search for people
    for (const query of searchQueries) {
      if (discoveredPeople.length >= 5) break; // Limit to 5 contacts

      try {
        const results = await this.searchPerplexity(query);

        // Ask LLM to extract people from results
        const extractionSchema = z.object({
          people: z.array(z.object({
            name: z.string(),
            title: z.string(),
            email: z.string().nullish(), // Allow null or undefined
            linkedIn: z.string().nullish(), // Allow null or undefined
            confidence: z.enum(['high', 'medium', 'low']),
          })).max(5),
        });

        const combinedContent = results.map(r => r.content).join('\n\n');

        if (!combinedContent.trim()) continue;

        this.emitProgress('extracting_learnings', `Extracting contacts from search results...`);

        const extracted = await generateStructuredOutput({
          schema: extractionSchema,
          prompt: `Extract contact information for people at ${this.prospect.companyName} from this research:

${combinedContent.substring(0, 4000)}

Extract ONLY people who work at ${this.prospect.companyName} (or recently worked there).
Focus on decision makers: executives, founders, heads of departments, directors.
For each person, provide:
- Full name (must have first and last name)
- Job title at ${this.prospect.companyName}
- Email address if found (format: name@company.com)
- LinkedIn profile URL if found
- Confidence: high (explicitly stated), medium (implied), low (uncertain)

Only include people with HIGH or MEDIUM confidence.
Do NOT make up email addresses - only include if explicitly mentioned.

Return JSON: {"people": [{"name": "...", "title": "...", "email": "...", "linkedIn": "...", "confidence": "high|medium|low"}]}`,
        });

        for (const person of extracted.people) {
          // Skip duplicates
          if (discoveredPeople.some(p => p.name.toLowerCase() === person.name.toLowerCase())) {
            continue;
          }
          // Skip if we already have this person in existing contacts
          if (this.prospect.contacts?.some(c => c.name.toLowerCase() === person.name.toLowerCase())) {
            continue;
          }

          discoveredPeople.push({
            name: person.name,
            title: person.title,
            email: person.email ?? undefined, // Convert null to undefined
            linkedIn: person.linkedIn ?? undefined, // Convert null to undefined
            source: 'perplexity_search',
          });

          log('contact_discovered', {
            name: person.name,
            title: person.title,
            hasEmail: !!person.email,
            hasLinkedIn: !!person.linkedIn,
          });
        }
      } catch (error) {
        log('contact_discovery_search_error', { query, error: String(error) });
      }
    }

    // If we found people without emails, try to find email patterns
    if (discoveredPeople.some(p => !p.email)) {
      this.emitProgress('searching', `Finding email addresses...`);
      await this.enrichContactEmails(discoveredPeople);
    }

    // Store discovered contacts in session
    if (!this.session.discoveredContacts) {
      this.session.discoveredContacts = [];
    }
    this.session.discoveredContacts.push(...discoveredPeople);

    // Update phase stats
    this.session.phases.contact_discovery.completed = true;
    this.session.phases.contact_discovery.contactsFound = discoveredPeople.length;

    // Add a learning about discovered contacts
    if (discoveredPeople.length > 0) {
      const contactSummary = discoveredPeople
        .map(p => `${p.name} (${p.title})${p.email ? ` - ${p.email}` : ''}`)
        .join(', ');

      this.session.learnings.push({
        insight: `Key decision makers at ${this.prospect.companyName}: ${contactSummary}`,
        source: 'Contact Discovery',
        followUpQuestions: [],
        category: 'leadership',
        confidence: 'high',
        discoveredAt: new Date().toISOString(),
      });
      this.session.stats.totalLearnings++;
    }

    log('contact_discovery_complete', {
      contactsFound: discoveredPeople.length,
      withEmail: discoveredPeople.filter(p => p.email).length,
      withLinkedIn: discoveredPeople.filter(p => p.linkedIn).length,
    });

    this.emitProgress('extracting_learnings', `Found ${discoveredPeople.length} decision makers`);
  }

  /**
   * Try to find email addresses for discovered contacts
   */
  private async enrichContactEmails(contacts: Array<{
    name: string;
    title: string;
    email?: string;
    linkedIn?: string;
    source: string;
  }>): Promise<void> {
    // First, try to find the company email pattern
    const companyDomain = this.prospect.website
      ? new URL(this.prospect.website.startsWith('http') ? this.prospect.website : `https://${this.prospect.website}`).hostname.replace('www.', '')
      : null;

    if (!companyDomain) return;

    // Search for email pattern
    const patternQuery = `${this.prospect.companyName} email format pattern @${companyDomain}`;

    try {
      const results = await this.searchPerplexity(patternQuery);
      const content = results.map(r => r.content).join('\n\n');

      const patternSchema = z.object({
        emailPattern: z.enum([
          'first.last',
          'firstlast',
          'first_last',
          'first',
          'flast',
          'firstl',
          'unknown',
        ]),
        examples: z.array(z.string()).optional(),
      });

      const patternResult = await generateStructuredOutput({
        schema: patternSchema,
        prompt: `Based on this research about ${this.prospect.companyName}, determine their email format:

${content.substring(0, 2000)}

Company domain: ${companyDomain}

Common email patterns:
- first.last@domain.com (e.g., john.smith@company.com)
- firstlast@domain.com (e.g., johnsmith@company.com)
- first_last@domain.com (e.g., john_smith@company.com)
- first@domain.com (e.g., john@company.com)
- flast@domain.com (e.g., jsmith@company.com)
- firstl@domain.com (e.g., johns@company.com)

Return JSON: {"emailPattern": "first.last|firstlast|first_last|first|flast|firstl|unknown", "examples": ["email@found.com"]}`,
      });

      if (patternResult.emailPattern !== 'unknown') {
        // Apply pattern to contacts without emails
        for (const contact of contacts) {
          if (contact.email) continue;

          const nameParts = contact.name.toLowerCase().split(' ').filter(p => p.length > 0);
          if (nameParts.length < 2) continue;

          const firstPart = nameParts[0];
          const lastPart = nameParts[nameParts.length - 1];
          if (!firstPart || !lastPart) continue;

          const firstName = firstPart.replace(/[^a-z]/g, '');
          const lastName = lastPart.replace(/[^a-z]/g, '');

          let generatedEmail: string | undefined;
          switch (patternResult.emailPattern) {
            case 'first.last':
              generatedEmail = `${firstName}.${lastName}@${companyDomain}`;
              break;
            case 'firstlast':
              generatedEmail = `${firstName}${lastName}@${companyDomain}`;
              break;
            case 'first_last':
              generatedEmail = `${firstName}_${lastName}@${companyDomain}`;
              break;
            case 'first':
              generatedEmail = `${firstName}@${companyDomain}`;
              break;
            case 'flast':
              if (firstName.length > 0 && lastName.length > 0) {
                generatedEmail = `${firstName[0]}${lastName}@${companyDomain}`;
              }
              break;
            case 'firstl':
              if (firstName.length > 0 && lastName.length > 0) {
                generatedEmail = `${firstName}${lastName[0]}@${companyDomain}`;
              }
              break;
          }

          if (generatedEmail) {
            contact.email = generatedEmail;
            contact.source = 'pattern_generated';
            log('email_generated', { name: contact.name, email: generatedEmail, pattern: patternResult.emailPattern });
          }
        }
      }
    } catch (error) {
      log('email_pattern_error', { error: String(error) });
    }
  }

  // ===========================================================================
  // Prompt Builders
  // ===========================================================================

  private buildCompanyResearchPrompt(): string {
    return `Research ${this.prospect.companyName} to understand their business, recent news, and potential challenges.
${this.prospect.website ? `Their website is ${this.prospect.website}.` : ''}
${this.prospect.industry ? `They operate in the ${this.prospect.industry} industry.` : ''}

Focus on:
- Recent company news and announcements
- Funding and financial developments
- Product launches or changes
- Leadership changes
- Business challenges they might be facing
- Growth initiatives and expansion plans`;
  }

  private buildContactResearchPrompt(): string {
    const contacts = this.prospect.contacts?.slice(0, 3).map(c => `${c.name} (${c.title})`).join(', ');
    return `Research the professional backgrounds of key people at ${this.prospect.companyName}: ${contacts}

Focus on:
- Career history and previous companies
- Professional expertise and focus areas
- Recent speaking engagements or publications
- Their potential priorities in their current role`;
  }

  private buildMarketResearchPrompt(): string {
    return `Research the market context for ${this.prospect.companyName} ${this.prospect.industry ? `in the ${this.prospect.industry} industry` : ''}.

Focus on:
- Industry trends affecting their business
- Competitive landscape and positioning
- Common challenges companies like them face
- Market opportunities and threats
- Technology trends in their space`;
  }

  private buildFollowUpPrompt(originalPrompt: string, learning: Learning): string {
    return `Original research goal: ${originalPrompt}

We discovered: ${learning.insight}

Follow-up questions to explore:
${learning.followUpQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Previous queries: ${this.session.completedQueries.slice(-5).join(', ')}

Research these follow-up questions to deepen our understanding.`;
  }

  // ===========================================================================
  // Progress Emission
  // ===========================================================================

  private emitProgress(
    phase: EnhancedResearchProgressEvent['phase'],
    message: string,
    currentQuery?: string,
    latestLearning?: string
  ): void {
    if (!this.onProgress) return;

    const event: EnhancedResearchProgressEvent = {
      type: 'enhanced_research_progress',
      sessionId: this.session.id,
      prospectId: this.prospect.id,
      phase,
      currentDepth: this.session.stats.researchDepthReached,
      maxDepth: this.config.depth,
      currentQuery,
      queriesCompleted: this.session.completedQueries.length,
      learningsFound: this.session.stats.totalLearnings,
      relevantResultsFound: this.session.stats.relevantResults,
      latestLearning,
      message,
      timestamp: new Date().toISOString(),
    };

    this.onProgress(event);
  }
}

// =============================================================================
// Main Export Function
// =============================================================================

export interface EnhancedDeepResearchParams {
  prospect: ProspectContext;
  config?: Partial<ResearchConfig>;
  onProgress?: ProgressCallback;
}

export interface EnhancedDeepResearchOutput {
  success: boolean;
  session?: ResearchSession;
  error?: string;
}

/**
 * Execute enhanced deep research on a prospect
 */
export async function executeEnhancedDeepResearch(
  params: EnhancedDeepResearchParams
): Promise<EnhancedDeepResearchOutput> {
  const { prospect, config, onProgress } = params;

  // Validate required API keys
  if (!process.env.DEEPSEEK_API_KEY) {
    const error = 'DEEPSEEK_API_KEY is not configured. Enhanced research requires DeepSeek for query generation and learning extraction.';
    log('execute_error', { prospectId: prospect.id, error });
    return { success: false, error };
  }

  if (!process.env.PERPLEXITY_API_KEY) {
    const error = 'PERPLEXITY_API_KEY is not configured. Enhanced research requires Perplexity for web search.';
    log('execute_error', { prospectId: prospect.id, error });
    return { success: false, error };
  }

  log('execute_start', {
    prospectId: prospect.id,
    prospectName: prospect.companyName,
    config,
  });

  try {
    const engine = new EnhancedResearchEngine(prospect, config, onProgress);
    const session = await engine.execute();

    return {
      success: true,
      session,
    };

  } catch (error) {
    log('execute_error', {
      prospectId: prospect.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Convert enhanced research session to legacy DeepResearchResult format
 * for backward compatibility
 */
export function sessionToLegacyFormat(session: ResearchSession): {
  company?: {
    funding?: Array<{ round: string; amount: string; date: string; investors: string[] }>;
    recentNews?: Array<{ title: string; date: string; summary: string; url?: string }>;
    products?: string[];
    competitors?: string[];
    positioning?: string;
    strengths?: string[];
    weaknesses?: string[];
  };
  contacts?: Array<{
    name: string;
    careerHistory?: Array<{ company: string; title: string; duration: string }>;
    education?: string;
    insights?: string;
  }>;
  market?: {
    trends?: string[];
    marketSize?: string;
    growthRate?: string;
    painPoints?: string[];
    buyingSignals?: string[];
    opportunities?: string[];
  };
  researchedAt: string;
} {
  // Group learnings by category
  const learningsByCategory: Record<string, Learning[]> = {};
  for (const learning of session.learnings) {
    const category = learning.category;
    const existing = learningsByCategory[category] ?? [];
    existing.push(learning);
    learningsByCategory[category] = existing;
  }

  return {
    company: {
      recentNews: learningsByCategory['news']?.map(l => ({
        title: l.source,
        date: l.discoveredAt.split('T')[0] || '',
        summary: l.insight,
        url: l.sourceUrl,
      })),
      products: learningsByCategory['product']?.map(l => l.insight),
      competitors: learningsByCategory['competitor']?.map(l => l.insight),
      positioning: learningsByCategory['general']?.[0]?.insight,
      strengths: learningsByCategory['opportunity']?.map(l => l.insight),
      weaknesses: learningsByCategory['pain_point']?.map(l => l.insight),
    },
    contacts: learningsByCategory['leadership']?.map(l => ({
      name: l.source,
      insights: l.insight,
    })),
    market: {
      trends: learningsByCategory['market']?.map(l => l.insight),
      painPoints: learningsByCategory['pain_point']?.map(l => l.insight),
      opportunities: learningsByCategory['opportunity']?.map(l => l.insight),
    },
    researchedAt: session.completedAt || session.startedAt,
  };
}
