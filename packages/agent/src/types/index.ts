// Re-export shared types
export type {
  Client,
  CreateClientInput,
  ICP,
  Prospect,
  Campaign,
  CreateCampaignInput,
  SentEmail,
  Response,
  ResponseSentiment,
} from '@cold-outreach/shared';

// Agent-specific types

export interface AgentContext {
  clientId: string;
  sessionId: string;
  startTime: number;
}

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  toolCalls: ToolCallRecord[];
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  input: unknown;
  output: unknown;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface DiscoveryResult {
  businessProfile: BusinessProfile;
  icp: ICPResult;
}

export interface BusinessProfile {
  companyName: string;
  website: string;
  industry: string;
  subIndustry?: string;
  valueProposition: string;
  productsServices: string[];
  targetMarket: string;
  keyDifferentiators: string[];
  estimatedSize: string;
  companyStage: string;
  headquarters?: string;
  summary: string;
}

export interface ICPResult {
  icpSummary: string;
  firmographicCriteria: {
    companySize: {
      employeeRanges: string[];
      revenueRanges: string[];
    };
    companyStage: string[];
    fundingStatus?: string[];
  };
  geographicTargeting: {
    primaryMarkets: Array<{
      city: string;
      state: string;
      country: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    expansionMarkets?: Array<{
      city: string;
      state: string;
      country: string;
    }>;
  };
  industryTargeting: {
    primaryIndustries: Array<{
      name: string;
      subSegments: string[];
      priority: 'high' | 'medium' | 'low';
    }>;
    secondaryIndustries?: Array<{
      name: string;
      subSegments: string[];
    }>;
  };
  decisionMakerTargeting: {
    primaryTitles: string[];
    secondaryTitles: string[];
    departments: string[];
  };
  messagingFramework: {
    primaryPainPointsToAddress: string[];
    valuePropositions: string[];
    proofPoints: string[];
    objectionHandlers?: Record<string, string>;
  };
}

export interface LeadDiscoveryParams {
  clientId: string;
  icp: ICPResult;
  locations: Array<{
    city: string;
    state: string;
    country: string;
  }>;
  industries: string[];
  limit?: number;
}

export interface LeadDiscoveryResult {
  prospects: ProspectData[];
  totalFound: number;
  locationBreakdown: Record<string, number>;
  industryBreakdown: Record<string, number>;
}

export interface ProspectData {
  id: string;
  companyName: string;
  website?: string;
  industry: string;
  subIndustry?: string;
  employeeCount?: string;
  revenue?: string;
  location: {
    city: string;
    state: string;
    country: string;
    address?: string;
  };
  googleMapsUrl?: string;
  googlePlaceId?: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  painPoints?: string[];
  recentNews?: string;
  technologies?: string[];
  contacts: ContactData[];
  icpMatchScore: number;
}

export interface ContactData {
  id: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  isPrimary: boolean;
}

export interface EmailSequence {
  prospectId: string;
  emails: EmailData[];
}

export interface EmailData {
  sequence: number;
  subject: string;
  body: string;
  delayDays: number;
}

export interface ResponseClassification {
  sentiment: 'positive' | 'neutral' | 'negative' | 'out_of_office' | 'unsubscribe';
  requiresAction: boolean;
  summary: string;
  suggestedReply?: string;
}

