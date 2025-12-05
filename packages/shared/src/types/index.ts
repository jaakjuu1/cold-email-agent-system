import { z } from 'zod';

// ===========================================
// Client Types
// ===========================================

export const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().url(),
  industry: z.string().optional(),
  solution: z.string().optional(),
  summary: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Client = z.infer<typeof ClientSchema>;

export const CreateClientSchema = ClientSchema.pick({
  name: true,
  website: true,
}).extend({
  industry: z.string().optional(),
  solution: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

// ===========================================
// ICP (Ideal Customer Profile) Types
// ===========================================

export const FirmographicCriteriaSchema = z.object({
  companySize: z.object({
    employeeRanges: z.array(z.string()),
    revenueRanges: z.array(z.string()),
  }),
  companyStage: z.array(z.string()),
  fundingStatus: z.array(z.string()).optional(),
});

export const GeographicTargetingSchema = z.object({
  primaryMarkets: z.array(z.object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  expansionMarkets: z.array(z.object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
  })).optional(),
});

export const IndustryTargetingSchema = z.object({
  primaryIndustries: z.array(z.object({
    name: z.string(),
    subSegments: z.array(z.string()),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  secondaryIndustries: z.array(z.object({
    name: z.string(),
    subSegments: z.array(z.string()),
  })).optional(),
});

export const DecisionMakerTargetingSchema = z.object({
  primaryTitles: z.array(z.string()),
  secondaryTitles: z.array(z.string()),
  departments: z.array(z.string()),
});

export const MessagingFrameworkSchema = z.object({
  primaryPainPointsToAddress: z.array(z.string()),
  valuePropositions: z.array(z.string()),
  proofPoints: z.array(z.string()),
  objectionHandlers: z.record(z.string()).optional(),
});

export const ICPSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  icpSummary: z.string(),
  firmographicCriteria: FirmographicCriteriaSchema,
  geographicTargeting: GeographicTargetingSchema,
  industryTargeting: IndustryTargetingSchema,
  decisionMakerTargeting: DecisionMakerTargetingSchema,
  messagingFramework: MessagingFrameworkSchema,
  status: z.enum(['draft', 'approved', 'refined']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ICP = z.infer<typeof ICPSchema>;
export type FirmographicCriteria = z.infer<typeof FirmographicCriteriaSchema>;
export type GeographicTargeting = z.infer<typeof GeographicTargetingSchema>;
export type IndustryTargeting = z.infer<typeof IndustryTargetingSchema>;
export type DecisionMakerTargeting = z.infer<typeof DecisionMakerTargetingSchema>;
export type MessagingFramework = z.infer<typeof MessagingFrameworkSchema>;

// ===========================================
// Prospect Types
// ===========================================

export const ContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  isPrimary: z.boolean(),
});

export type Contact = z.infer<typeof ContactSchema>;

export const ProspectSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  website: z.string().url().optional(),
  industry: z.string(),
  subIndustry: z.string().optional(),
  employeeCount: z.string().optional(),
  revenue: z.string().optional(),
  location: z.object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
    address: z.string().optional(),
  }),
  googleMapsUrl: z.string().url().optional(),
  googlePlaceId: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  description: z.string().optional(),
  painPoints: z.array(z.string()).optional(),
  recentNews: z.string().optional(),
  technologies: z.array(z.string()).optional(),
  contacts: z.array(ContactSchema),
  icpMatchScore: z.number().min(0).max(1),
  status: z.enum(['new', 'researched', 'contacted', 'responded', 'converted', 'rejected']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Prospect = z.infer<typeof ProspectSchema>;

// ===========================================
// Campaign Types
// ===========================================

export const EmailTemplateSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  subject: z.string(),
  body: z.string(),
  bodyHtml: z.string(),
  bodyText: z.string().optional(),
  delayDays: z.number(),
  customInstructions: z.string().optional(), // Per-template AI generation instructions
});

export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;

// Contact selection mapping: { prospectId: contactId }
export const ContactSelectionsSchema = z.record(z.string(), z.string());
export type ContactSelections = z.infer<typeof ContactSelectionsSchema>;

export const CampaignSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']),
  prospectIds: z.array(z.string()),
  contactSelections: ContactSelectionsSchema.optional(), // Which contact to email per prospect
  emailTemplates: z.array(EmailTemplateSchema),
  settings: z.object({
    dailySendLimit: z.number(),
    sendWindowStart: z.string(),
    sendWindowEnd: z.string(),
    timezone: z.string(),
    skipWeekends: z.boolean(),
    generalInstructions: z.string().optional(), // Global AI generation instructions for all emails
  }),
  stats: z.object({
    totalProspects: z.number(),
    emailsSent: z.number(),
    emailsDelivered: z.number(),
    emailsBounced: z.number(),
    emailsOpened: z.number(),
    emailsClicked: z.number(),
    responses: z.number(),
    positiveResponses: z.number(),
    meetings: z.number(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Campaign = z.infer<typeof CampaignSchema>;

export const CreateCampaignSchema = z.object({
  clientId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  prospectIds: z.array(z.string()),
  contactSelections: ContactSelectionsSchema.optional(), // Which contact to email per prospect
  emailTemplates: z.array(EmailTemplateSchema).optional(),
  settings: z.object({
    dailySendLimit: z.number().default(50),
    sendWindowStart: z.string().default('09:00'),
    sendWindowEnd: z.string().default('17:00'),
    timezone: z.string().default('America/New_York'),
    skipWeekends: z.boolean().default(true),
    generalInstructions: z.string().optional(),
  }).optional(),
});

export type CreateCampaignInput = z.infer<typeof CreateCampaignSchema>;

// ===========================================
// Email Tracking Types
// ===========================================

export const EmailStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'bounced',
  'opened',
  'clicked',
  'replied',
  'unsubscribed',
  'failed',
]);

export type EmailStatus = z.infer<typeof EmailStatusSchema>;

export const SentEmailSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  prospectId: z.string(),
  templateId: z.string(),
  contactId: z.string().optional(),
  sequenceNumber: z.number(),
  toEmail: z.string(),
  messageId: z.string().optional(),
  subject: z.string(),
  body: z.string(),
  bodyHtml: z.string().optional(),
  status: EmailStatusSchema,
  sentAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
  openedAt: z.string().datetime().optional(),
  clickedAt: z.string().datetime().optional(),
  repliedAt: z.string().datetime().optional(),
  bouncedAt: z.string().datetime().optional(),
  bounceReason: z.string().optional(),
  openCount: z.number().default(0),
  clickCount: z.number().default(0),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type SentEmail = z.infer<typeof SentEmailSchema>;

// ===========================================
// Response Types
// ===========================================

export const ResponseSentimentSchema = z.enum([
  'positive',
  'neutral',
  'negative',
  'out_of_office',
  'unsubscribe',
]);

export type ResponseSentiment = z.infer<typeof ResponseSentimentSchema>;

export const ResponseSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  prospectId: z.string(),
  emailId: z.string(),
  messageId: z.string(),
  inReplyTo: z.string(),
  from: z.string(),
  subject: z.string(),
  body: z.string(),
  sentiment: ResponseSentimentSchema,
  requiresAction: z.boolean(),
  actionTaken: z.string().optional(),
  receivedAt: z.string().datetime(),
  processedAt: z.string().datetime().optional(),
});

export type Response = z.infer<typeof ResponseSchema>;

// ===========================================
// Discovery Progress Types
// ===========================================

export const DiscoveryPhaseSchema = z.enum([
  'analyzing_website',
  'researching_market',
  'generating_icp',
  'validating',
]);

export type DiscoveryPhase = z.infer<typeof DiscoveryPhaseSchema>;

export const DiscoveryStatusSchema = z.enum([
  'started',
  'in_progress',
  'completed',
  'failed',
]);

export type DiscoveryStatus = z.infer<typeof DiscoveryStatusSchema>;

export const DiscoveryProgressEventSchema = z.object({
  type: z.literal('discovery_progress'),
  clientId: z.string(),
  phase: DiscoveryPhaseSchema,
  status: DiscoveryStatusSchema,
  message: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.object({
    durationMs: z.number().optional(),
    error: z.string().optional(),
  }).optional(),
});

export type DiscoveryProgressEvent = z.infer<typeof DiscoveryProgressEventSchema>;

// ===========================================
// Lead Discovery Progress Types
// ===========================================

export const LeadDiscoveryPhaseSchema = z.enum([
  'searching_maps',
  'parsing_prospects',
  'enriching_company',
  'finding_contacts',
  'validating_icp',
  'saving_results',
]);

export type LeadDiscoveryPhase = z.infer<typeof LeadDiscoveryPhaseSchema>;

export const LeadDiscoveryProgressEventSchema = z.object({
  type: z.literal('lead_discovery_progress'),
  clientId: z.string(),
  jobId: z.string(),
  phase: LeadDiscoveryPhaseSchema,
  status: z.enum(['started', 'in_progress', 'completed', 'failed']),
  message: z.string().optional(),
  timestamp: z.string().datetime(),
  metadata: z.object({
    prospectId: z.string().optional(),
    companyName: z.string().optional(),
    current: z.number().optional(),
    total: z.number().optional(),
    placesFound: z.number().optional(),
    enrichedCount: z.number().optional(),
    contactsFound: z.number().optional(),
    icpScore: z.number().optional(),
    error: z.string().optional(),
  }).optional(),
});

export type LeadDiscoveryProgressEvent = z.infer<typeof LeadDiscoveryProgressEventSchema>;

// ===========================================
// Deep Research Types
// ===========================================

export const DeepResearchPhaseSchema = z.enum([
  'company_research',
  'contact_research',
  'market_research',
  'complete',
]);

export type DeepResearchPhase = z.infer<typeof DeepResearchPhaseSchema>;

export const DeepResearchProgressEventSchema = z.object({
  type: z.literal('deep_research_progress'),
  prospectId: z.string(),
  jobId: z.string(),
  phase: DeepResearchPhaseSchema,
  status: z.enum(['started', 'in_progress', 'completed', 'failed']),
  message: z.string().optional(),
  data: z.unknown().optional(),
  timestamp: z.string().datetime(),
});

export type DeepResearchProgressEvent = z.infer<typeof DeepResearchProgressEventSchema>;

export const FundingRoundSchema = z.object({
  round: z.string(),
  amount: z.string(),
  date: z.string(),
  investors: z.array(z.string()),
});

export const NewsItemSchema = z.object({
  title: z.string(),
  date: z.string(),
  summary: z.string(),
  url: z.string().optional(),
});

export const CareerHistoryItemSchema = z.object({
  company: z.string(),
  title: z.string(),
  duration: z.string(),
});

export const ContactResearchSchema = z.object({
  name: z.string(),
  careerHistory: z.array(CareerHistoryItemSchema).optional(),
  education: z.string().optional(),
  insights: z.string().optional(),
});

export const DeepResearchResultSchema = z.object({
  company: z.object({
    funding: z.array(FundingRoundSchema).optional(),
    recentNews: z.array(NewsItemSchema).optional(),
    products: z.array(z.string()).optional(),
    competitors: z.array(z.string()).optional(),
    positioning: z.string().optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
  }).optional(),
  contacts: z.array(ContactResearchSchema).optional(),
  market: z.object({
    trends: z.array(z.string()).optional(),
    marketSize: z.string().optional(),
    growthRate: z.string().optional(),
    painPoints: z.array(z.string()).optional(),
    buyingSignals: z.array(z.string()).optional(),
    opportunities: z.array(z.string()).optional(),
  }).optional(),
  researchedAt: z.string().datetime(),
});

export type DeepResearchResult = z.infer<typeof DeepResearchResultSchema>;
export type FundingRound = z.infer<typeof FundingRoundSchema>;
export type NewsItem = z.infer<typeof NewsItemSchema>;
export type CareerHistoryItem = z.infer<typeof CareerHistoryItemSchema>;
export type ContactResearch = z.infer<typeof ContactResearchSchema>;

// ===========================================
// Enhanced Deep Research Types (v2)
// ===========================================

/**
 * A Learning represents a single insight extracted from research,
 * along with follow-up questions that could deepen our understanding.
 */
export const LearningSchema = z.object({
  // The insight we learned
  insight: z.string(),
  // How confident we are in this learning
  confidence: z.enum(['high', 'medium', 'low']),
  // Where this learning came from
  source: z.string(),
  // URL if available
  sourceUrl: z.string().optional(),
  // Category of learning
  category: z.enum([
    'funding',
    'news',
    'product',
    'competitor',
    'leadership',
    'culture',
    'technology',
    'market',
    'pain_point',
    'opportunity',
    'general',
  ]),
  // Follow-up questions this learning raises
  followUpQuestions: z.array(z.string()),
  // When this was discovered
  discoveredAt: z.string().datetime(),
});

export type Learning = z.infer<typeof LearningSchema>;

/**
 * A search result with its evaluation
 */
export const EvaluatedSearchResultSchema = z.object({
  query: z.string(),
  title: z.string(),
  url: z.string(),
  content: z.string(),
  relevanceScore: z.number().min(0).max(1),
  isRelevant: z.boolean(),
  evaluationReason: z.string().optional(),
});

export type EvaluatedSearchResult = z.infer<typeof EvaluatedSearchResultSchema>;

/**
 * Sales angle - actionable insight for outreach
 */
export const SalesAngleSchema = z.object({
  // The hook or angle
  angle: z.string(),
  // Why this angle would resonate
  reasoning: z.string(),
  // Specific talking points
  talkingPoints: z.array(z.string()),
  // Which learning(s) support this angle
  supportingEvidence: z.array(z.string()),
  // Strength of this angle
  strength: z.enum(['strong', 'moderate', 'weak']),
  // Best contact to use this angle with
  bestContactTitle: z.string().optional(),
});

export type SalesAngle = z.infer<typeof SalesAngleSchema>;

/**
 * Personalization hook for email outreach
 */
export const PersonalizationHookSchema = z.object({
  // The hook text
  hook: z.string(),
  // Type of personalization
  type: z.enum([
    'recent_news',
    'funding_event',
    'leadership_change',
    'company_milestone',
    'shared_connection',
    'industry_trend',
    'pain_point',
    'competitor_mention',
    'technology_stack',
  ]),
  // The source learning
  basedOn: z.string(),
  // Freshness (how recent is this info)
  freshness: z.enum(['very_recent', 'recent', 'older']),
});

export type PersonalizationHook = z.infer<typeof PersonalizationHookSchema>;

/**
 * The complete research session - accumulated knowledge
 */
export const ResearchSessionSchema = z.object({
  // Session metadata
  id: z.string(),
  prospectId: z.string(),
  prospectName: z.string(),

  // Research configuration
  config: z.object({
    depth: z.number().min(1).max(5),
    breadth: z.number().min(1).max(10),
    focus: z.enum(['sales', 'competitive', 'comprehensive']),
  }),

  // Accumulated research data
  queries: z.array(z.string()),
  completedQueries: z.array(z.string()),
  searchResults: z.array(EvaluatedSearchResultSchema),
  learnings: z.array(LearningSchema),

  // Research phases completed
  phases: z.object({
    company: z.object({
      completed: z.boolean(),
      learningsCount: z.number(),
    }),
    contacts: z.object({
      completed: z.boolean(),
      learningsCount: z.number(),
    }),
    contact_discovery: z.object({
      completed: z.boolean(),
      learningsCount: z.number(),
      contactsFound: z.number().default(0),
    }),
    market: z.object({
      completed: z.boolean(),
      learningsCount: z.number(),
    }),
    synthesis: z.object({
      completed: z.boolean(),
    }),
  }),

  // Discovered contacts (from contact_discovery phase)
  discoveredContacts: z.array(z.object({
    name: z.string(),
    title: z.string(),
    email: z.string().optional(),
    linkedIn: z.string().optional(),
    source: z.string(),
  })).optional(),

  // Sales-focused outputs
  salesAngles: z.array(SalesAngleSchema),
  personalizationHooks: z.array(PersonalizationHookSchema),

  // Recommended approach
  recommendedApproach: z.object({
    primaryAngle: z.string(),
    openingLine: z.string(),
    keyPoints: z.array(z.string()),
    callToAction: z.string(),
    warnings: z.array(z.string()).optional(), // Things to avoid mentioning
  }).optional(),

  // Statistics
  stats: z.object({
    totalQueries: z.number(),
    totalSearchResults: z.number(),
    relevantResults: z.number(),
    totalLearnings: z.number(),
    researchDepthReached: z.number(),
    durationMs: z.number(),
  }),

  // Timestamps
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type ResearchSession = z.infer<typeof ResearchSessionSchema>;

/**
 * Enhanced deep research progress event
 */
export const EnhancedResearchProgressEventSchema = z.object({
  type: z.literal('enhanced_research_progress'),
  sessionId: z.string(),
  prospectId: z.string(),

  // Current state
  phase: z.enum([
    'initializing',
    'generating_queries',
    'searching',
    'evaluating',
    'extracting_learnings',
    'following_up',
    'synthesizing',
    'complete',
    'failed',
  ]),

  // Progress within current phase
  currentDepth: z.number(),
  maxDepth: z.number(),
  currentQuery: z.string().optional(),

  // Accumulated stats
  queriesCompleted: z.number(),
  learningsFound: z.number(),
  relevantResultsFound: z.number(),

  // Latest learning (for real-time display)
  latestLearning: z.string().optional(),

  // Status message
  message: z.string(),

  timestamp: z.string().datetime(),
});

export type EnhancedResearchProgressEvent = z.infer<typeof EnhancedResearchProgressEventSchema>;

/**
 * Configurable Research Phase
 * Allows users to select which phases to include in the deep research
 */
export const ConfigurableResearchPhaseSchema = z.enum([
  'company',           // Company deep dive: funding, news, products, competitors
  'contacts',          // Research existing contacts' backgrounds
  'contact_discovery', // Find NEW contacts (decision makers, emails)
  'market',            // Market trends, pain points, buying signals
]);

export type ConfigurableResearchPhase = z.infer<typeof ConfigurableResearchPhaseSchema>;

export const ResearchConfigSchema = z.object({
  // Which phases to run (default: all)
  phases: z.array(ConfigurableResearchPhaseSchema).min(1).default(['company', 'contacts', 'contact_discovery', 'market']),

  // Research depth (1-3, higher = more follow-up questions)
  depth: z.number().min(1).max(3).default(2),

  // Research breadth (1-5, queries per level)
  breadth: z.number().min(1).max(5).default(3),

  // Focus mode
  focus: z.enum(['sales', 'general', 'technical']).default('sales'),
});

export type ResearchConfig = z.infer<typeof ResearchConfigSchema>;

// Phase metadata for UI display
export const RESEARCH_PHASE_INFO: Record<ConfigurableResearchPhase, {
  label: string;
  description: string;
  estimatedTime: string;
  icon: string;
}> = {
  company: {
    label: 'Company Research',
    description: 'Funding history, recent news, products/services, competitive positioning',
    estimatedTime: '2-4 min',
    icon: 'Building2',
  },
  contacts: {
    label: 'Contact Backgrounds',
    description: 'Career history and professional insights for existing contacts',
    estimatedTime: '1-2 min',
    icon: 'Users',
  },
  contact_discovery: {
    label: 'Find New Contacts',
    description: 'Discover decision makers, find email addresses and LinkedIn profiles',
    estimatedTime: '2-3 min',
    icon: 'UserSearch',
  },
  market: {
    label: 'Market Intelligence',
    description: 'Industry trends, market size, common pain points, buying signals',
    estimatedTime: '2-3 min',
    icon: 'TrendingUp',
  },
};

// ===========================================
// WebSocket Event Types
// ===========================================

// Response notification for WebSocket (subset of Response for real-time updates)
export interface ResponseNotification {
  id: string;
  prospectId: string;
  fromEmail: string;
  subject: string;
  sentiment: ResponseSentiment;
  requiresAction: boolean;
  receivedAt: string;
}

export type WebSocketEvent =
  | { type: 'campaign_update'; campaignId: string; stats: Campaign['stats'] }
  | { type: 'campaign_progress'; campaignId: string; prospectId: string; emailsSent: number; totalProspects: number; timestamp: string }
  | { type: 'new_response'; response: ResponseNotification; timestamp: string }
  | { type: 'email_sent'; email: SentEmail }
  | { type: 'email_bounced'; email: SentEmail }
  | { type: 'prospect_status_change'; prospectId: string; status: Prospect['status'] }
  | { type: 'listener_notification'; listenerId: string; priority: 'low' | 'normal' | 'high'; message: string }
  | DiscoveryProgressEvent
  | LeadDiscoveryProgressEvent
  | DeepResearchProgressEvent
  | EnhancedResearchProgressEvent;

// ===========================================
// Email Settings Types (per-client configuration)
// ===========================================

export const EmailProviderSchema = z.enum([
  'resend',
  'sendgrid',
  'smtp',
  'mailgun',
]);

export type EmailProvider = z.infer<typeof EmailProviderSchema>;

export const SmtpConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  secure: z.boolean(),
  username: z.string(),
  password: z.string(),
});

export type SmtpConfig = z.infer<typeof SmtpConfigSchema>;

export const ImapConfigSchema = z.object({
  host: z.string(),
  port: z.number(),
  secure: z.boolean(),
  username: z.string(),
  password: z.string(),
  // Folder to monitor for replies (default: INBOX)
  mailbox: z.string().default('INBOX'),
  // How often to check for new emails (in seconds)
  pollIntervalSeconds: z.number().default(60),
});

export type ImapConfig = z.infer<typeof ImapConfigSchema>;

export const EmailSettingsSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  provider: EmailProviderSchema,
  fromEmail: z.string().email(),
  fromName: z.string(),
  replyToEmail: z.string().email().optional(),
  // Provider-specific API keys (encrypted in production)
  apiKey: z.string().optional(),
  // SMTP configuration (for smtp provider)
  smtpConfig: SmtpConfigSchema.optional(),
  // IMAP configuration (for receiving/tracking replies)
  imapConfig: ImapConfigSchema.optional(),
  // Rate limiting settings
  dailySendLimit: z.number().default(200),
  hourlySendLimit: z.number().default(50),
  minDelaySeconds: z.number().default(5),
  // Email signature
  signature: z.string().optional(),
  // Tracking settings
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(true),
  // Status
  isVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmailSettings = z.infer<typeof EmailSettingsSchema>;

export const CreateEmailSettingsSchema = EmailSettingsSchema.pick({
  clientId: true,
  provider: true,
  fromEmail: true,
  fromName: true,
  replyToEmail: true,
  apiKey: true,
  smtpConfig: true,
  imapConfig: true,
  dailySendLimit: true,
  hourlySendLimit: true,
  minDelaySeconds: true,
  signature: true,
  trackOpens: true,
  trackClicks: true,
});

export type CreateEmailSettingsInput = z.infer<typeof CreateEmailSettingsSchema>;

export const UpdateEmailSettingsSchema = CreateEmailSettingsSchema.partial().omit({ clientId: true });

export type UpdateEmailSettingsInput = z.infer<typeof UpdateEmailSettingsSchema>;

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ===========================================
// AI Email Generation Types
// ===========================================

export const PersonalizationTypeSchema = z.enum([
  'recent_news',
  'funding_event',
  'role_based',
  'pain_point',
  'company_specific',
  'industry_trend',
  'technology_stack',
  'competitor_mention',
  'location_based',
  'company_size',
]);

export type PersonalizationType = z.infer<typeof PersonalizationTypeSchema>;

export const PersonalizationUsedSchema = z.object({
  type: PersonalizationTypeSchema,
  source: z.string(), // Where the data came from
  text: z.string(), // The actual personalized text used
});

export type PersonalizationUsed = z.infer<typeof PersonalizationUsedSchema>;

export const GeneratedEmailSchema = z.object({
  prospectId: z.string(),
  contactId: z.string(),
  sequenceNumber: z.number().min(1).max(5),
  subject: z.string(),
  body: z.string(),
  bodyHtml: z.string().optional(),
  personalizationUsed: z.array(PersonalizationUsedSchema),
  qualityScore: z.number().min(0).max(100),
  spamRiskScore: z.number().min(0).max(100),
  suggestedImprovements: z.array(z.string()).optional(),
  generatedAt: z.string().datetime(),
});

export type GeneratedEmail = z.infer<typeof GeneratedEmailSchema>;

export const EmailGenerationModeSchema = z.enum([
  'template', // Generate template with placeholders
  'personalized', // Fully personalized per prospect/contact
]);

export type EmailGenerationMode = z.infer<typeof EmailGenerationModeSchema>;

export const GenerateEmailRequestSchema = z.object({
  clientId: z.string(),
  mode: EmailGenerationModeSchema,
  // For template mode
  templateConfig: z.object({
    sequenceCount: z.number().min(1).max(5).default(3),
    customInstructions: z.string().optional(),
  }).optional(),
  // For personalized mode
  prospects: z.array(z.object({
    prospectId: z.string(),
    contactId: z.string(),
  })).optional(),
  sequenceNumber: z.number().min(1).max(5).optional(), // Generate specific email or all
  customInstructions: z.string().optional(),
  regenerateWithAngle: z.string().optional(), // e.g., "focus on funding", "emphasize ROI"
});

export type GenerateEmailRequest = z.infer<typeof GenerateEmailRequestSchema>;

export const GenerateEmailResponseSchema = z.object({
  mode: EmailGenerationModeSchema,
  // For template mode
  templates: z.array(z.object({
    sequenceNumber: z.number(),
    subject: z.string(),
    body: z.string(),
    delayDays: z.number(),
    placeholders: z.array(z.string()), // e.g., ["{first_name}", "{company}"]
  })).optional(),
  // For personalized mode
  emails: z.array(GeneratedEmailSchema).optional(),
  // Generation stats
  stats: z.object({
    totalGenerated: z.number(),
    averageQualityScore: z.number(),
    averageSpamRisk: z.number(),
    generationTimeMs: z.number(),
  }),
});

export type GenerateEmailResponse = z.infer<typeof GenerateEmailResponseSchema>;

// Email evaluation for review step
export const EmailEvaluationSchema = z.object({
  emailId: z.string(),
  prospectId: z.string(),
  approved: z.boolean(),
  edited: z.boolean(),
  editedSubject: z.string().optional(),
  editedBody: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export type EmailEvaluation = z.infer<typeof EmailEvaluationSchema>;

// ===========================================
// Placeholder Validation Types
// ===========================================

/**
 * Defines the mapping between email placeholders and their data sources
 */
export const PlaceholderDefinitions = {
  '{first_name}': {
    label: 'First Name',
    source: 'contact',
    field: 'name',
    extractor: (prospect: Prospect, contact?: Contact) => {
      const c = contact || prospect.contacts?.[0];
      return c?.name?.split(' ')[0] || null;
    },
    fallback: 'there',
  },
  '{full_name}': {
    label: 'Full Name',
    source: 'contact',
    field: 'name',
    extractor: (prospect: Prospect, contact?: Contact) => {
      const c = contact || prospect.contacts?.[0];
      return c?.name || null;
    },
    fallback: 'there',
  },
  '{company_name}': {
    label: 'Company Name',
    source: 'prospect',
    field: 'companyName',
    extractor: (prospect: Prospect) => prospect.companyName || null,
    fallback: 'your company',
  },
  '{company}': {
    label: 'Company',
    source: 'prospect',
    field: 'companyName',
    extractor: (prospect: Prospect) => prospect.companyName || null,
    fallback: 'your company',
  },
  '{title}': {
    label: 'Job Title',
    source: 'contact',
    field: 'title',
    extractor: (prospect: Prospect, contact?: Contact) => {
      const c = contact || prospect.contacts?.[0];
      return c?.title || null;
    },
    fallback: 'your role',
  },
  '{industry}': {
    label: 'Industry',
    source: 'prospect',
    field: 'industry',
    extractor: (prospect: Prospect) => prospect.industry || null,
    fallback: 'your industry',
  },
  '{city}': {
    label: 'City',
    source: 'prospect',
    field: 'location.city',
    extractor: (prospect: Prospect) => prospect.location?.city || null,
    fallback: 'your area',
  },
  '{state}': {
    label: 'State',
    source: 'prospect',
    field: 'location.state',
    extractor: (prospect: Prospect) => prospect.location?.state || null,
    fallback: '',
  },
} as const;

export type PlaceholderKey = keyof typeof PlaceholderDefinitions;

export const PlaceholderFieldStatusSchema = z.enum(['available', 'fallback', 'missing']);
export type PlaceholderFieldStatus = z.infer<typeof PlaceholderFieldStatusSchema>;

export const PlaceholderValidationResultSchema = z.object({
  placeholder: z.string(),
  label: z.string(),
  status: PlaceholderFieldStatusSchema,
  actualValue: z.string().nullable(),
  fallbackValue: z.string(),
});

export type PlaceholderValidationResult = z.infer<typeof PlaceholderValidationResultSchema>;

export const ProspectPlaceholderValidationSchema = z.object({
  prospectId: z.string(),
  prospectName: z.string(),
  contactId: z.string().optional(),
  contactName: z.string().optional(),
  placeholders: z.array(PlaceholderValidationResultSchema),
  summary: z.object({
    total: z.number(),
    available: z.number(),
    fallback: z.number(),
    missing: z.number(),
  }),
  isFullyPopulated: z.boolean(),
  hasAnyFallbacks: z.boolean(),
});

export type ProspectPlaceholderValidation = z.infer<typeof ProspectPlaceholderValidationSchema>;

export const TemplateValidationRequestSchema = z.object({
  templates: z.array(z.object({
    subject: z.string(),
    body: z.string(),
  })),
  prospects: z.array(z.object({
    prospectId: z.string(),
    contactId: z.string().optional(),
  })),
});

export type TemplateValidationRequest = z.infer<typeof TemplateValidationRequestSchema>;

export const TemplateValidationResponseSchema = z.object({
  placeholdersUsed: z.array(z.string()),
  prospectValidations: z.array(ProspectPlaceholderValidationSchema),
  summary: z.object({
    totalProspects: z.number(),
    fullyPopulated: z.number(),
    withFallbacks: z.number(),
    withMissing: z.number(),
  }),
});

export type TemplateValidationResponse = z.infer<typeof TemplateValidationResponseSchema>;

