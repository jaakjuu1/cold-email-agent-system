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
});

export type EmailTemplate = z.infer<typeof EmailTemplateSchema>;

export const CampaignSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']),
  prospectIds: z.array(z.string()),
  emailTemplates: z.array(EmailTemplateSchema),
  settings: z.object({
    dailySendLimit: z.number(),
    sendWindowStart: z.string(),
    sendWindowEnd: z.string(),
    timezone: z.string(),
    skipWeekends: z.boolean(),
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
  settings: z.object({
    dailySendLimit: z.number().default(50),
    sendWindowStart: z.string().default('09:00'),
    sendWindowEnd: z.string().default('17:00'),
    timezone: z.string().default('America/New_York'),
    skipWeekends: z.boolean().default(true),
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
  contactId: z.string().optional(),
  sequenceNumber: z.number(),
  messageId: z.string(),
  subject: z.string(),
  body: z.string().optional(),
  status: EmailStatusSchema,
  sentAt: z.string().datetime(),
  deliveredAt: z.string().datetime().optional(),
  openedAt: z.string().datetime().optional(),
  clickedAt: z.string().datetime().optional(),
  repliedAt: z.string().datetime().optional(),
  bouncedAt: z.string().datetime().optional(),
  bounceReason: z.string().optional(),
  error: z.string().optional(),
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
// WebSocket Event Types
// ===========================================

export type WebSocketEvent =
  | { type: 'campaign_update'; campaignId: string; stats: Campaign['stats'] }
  | { type: 'new_response'; response: Response }
  | { type: 'email_sent'; email: SentEmail }
  | { type: 'email_bounced'; email: SentEmail }
  | { type: 'prospect_status_change'; prospectId: string; status: Prospect['status'] }
  | { type: 'listener_notification'; listenerId: string; priority: 'low' | 'normal' | 'high'; message: string };

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

