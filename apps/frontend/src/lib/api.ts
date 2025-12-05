import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    return Promise.reject(new Error(message));
  }
);

// API functions
export const clientsApi = {
  list: () => api.get('/clients'),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: { name: string; website: string }) => api.post('/clients', data),
  update: (id: string, data: Partial<{ name: string; website: string }>) =>
    api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  discover: (id: string, websiteUrl: string, additionalPrompt?: string) =>
    api.post(`/clients/${id}/discover`, { websiteUrl, additionalPrompt }),
  getICP: (id: string) => api.get(`/clients/${id}/icp`),
  updateICP: (id: string, data: unknown) => api.put(`/clients/${id}/icp`, data),
  approveICP: (id: string) => api.post(`/clients/${id}/icp/approve`),
  // Email settings
  getEmailSettings: (id: string) => api.get(`/clients/${id}/email-settings`),
  createEmailSettings: (id: string, data: {
    provider: 'resend' | 'sendgrid' | 'smtp' | 'mailgun';
    fromEmail: string;
    fromName: string;
    replyToEmail?: string;
    apiKey?: string;
    smtpConfig?: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
    };
    imapConfig?: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
      mailbox?: string;
      pollIntervalSeconds?: number;
    };
    dailySendLimit?: number;
    hourlySendLimit?: number;
    minDelaySeconds?: number;
    signature?: string;
    trackOpens?: boolean;
    trackClicks?: boolean;
  }) => api.post(`/clients/${id}/email-settings`, data),
  updateEmailSettings: (id: string, data: {
    provider?: 'resend' | 'sendgrid' | 'smtp' | 'mailgun';
    fromEmail?: string;
    fromName?: string;
    replyToEmail?: string;
    apiKey?: string;
    smtpConfig?: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
    };
    imapConfig?: {
      host: string;
      port: number;
      secure: boolean;
      username: string;
      password: string;
      mailbox?: string;
      pollIntervalSeconds?: number;
    };
    dailySendLimit?: number;
    hourlySendLimit?: number;
    minDelaySeconds?: number;
    signature?: string;
    trackOpens?: boolean;
    trackClicks?: boolean;
  }) => api.put(`/clients/${id}/email-settings`, data),
  deleteEmailSettings: (id: string) => api.delete(`/clients/${id}/email-settings`),
};

export const campaignsApi = {
  list: (params?: { clientId?: string; status?: string }) =>
    api.get('/campaigns', { params }),
  get: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: {
    clientId: string;
    name: string;
    description?: string;
    prospectIds: string[];
    contactSelections?: Record<string, string>; // Which contact to email per prospect
    emailTemplates?: Array<{
      id: string;
      sequence: number;
      subject: string;
      body: string;
      bodyHtml: string;
      delayDays: number;
    }>;
    settings?: {
      dailySendLimit?: number;
      sendWindowStart?: string;
      sendWindowEnd?: string;
      timezone?: string;
      skipWeekends?: boolean;
    };
  }) => api.post('/campaigns', data),
  update: (id: string, data: unknown) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  start: (id: string) => api.post(`/campaigns/${id}/start`),
  pause: (id: string) => api.post(`/campaigns/${id}/pause`),
  resume: (id: string) => api.post(`/campaigns/${id}/resume`),
  getStats: (id: string) => api.get(`/campaigns/${id}/stats`),
  getProspects: (id: string) => api.get(`/campaigns/${id}/prospects`),
  getEmails: (id: string) => api.get(`/campaigns/${id}/emails`),
  generateEmails: (id: string) => api.post(`/campaigns/${id}/generate-emails`),
  generateAIEmails: (params: {
    clientId: string;
    mode: 'template' | 'personalized';
    prospects?: Array<{ prospectId: string; contactId: string }>;
    sequenceCount?: number;
    generalInstructions?: string;
    templateInstructions?: Array<{ sequenceNumber: number; instructions: string }>;
    regenerateWithAngle?: string;
  }) => api.post('/campaigns/generate-ai-emails', params),

  // Validate placeholders for templates against prospects
  validatePlaceholders: (params: {
    templates: Array<{ subject: string; body: string }>;
    prospects: Array<{ prospectId: string; contactId?: string }>;
  }) => api.post('/campaigns/validate-placeholders', params),
};

export const prospectsApi = {
  list: (params?: {
    clientId?: string;
    status?: string;
    industry?: string;
    location?: string;
    page?: number;
    pageSize?: number;
  }) => api.get('/prospects', { params }),
  get: (id: string) => api.get(`/prospects/${id}`),
  update: (id: string, data: unknown) => api.put(`/prospects/${id}`, data),
  delete: (id: string) => api.delete(`/prospects/${id}`),
  discover: (data: {
    clientId: string;
    phase?: string;
    locations?: Array<{ city: string; state: string; country: string }>;
    industries?: string[];
    limit?: number;
  }) => api.post('/prospects/discover', data),
  enrich: (id: string) => api.post(`/prospects/${id}/enrich`),
  getTracking: (id: string) => api.get(`/prospects/${id}/tracking`),
  updateStatus: (id: string, status: string) =>
    api.put(`/prospects/${id}/status`, { status }),
  deepResearch: (id: string, config?: {
    phases?: ('company' | 'contacts' | 'contact_discovery' | 'market')[];
    depth?: number;
    breadth?: number;
    focus?: 'sales' | 'general' | 'technical';
  }) => api.post(`/prospects/${id}/deep-research`, config || {}),
  getDeepResearch: (id: string) => api.get(`/prospects/${id}/deep-research`),
};

export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getCampaign: (id: string) => api.get(`/analytics/campaign/${id}`),
  getDailyMetrics: (id: string, startDate?: string, endDate?: string) =>
    api.get(`/analytics/campaign/${id}/daily`, { params: { startDate, endDate } }),
  getResponses: (campaignId?: string) =>
    api.get('/analytics/responses', { params: { campaignId } }),
  getFunnel: (campaignId?: string) =>
    api.get('/analytics/funnel', { params: { campaignId } }),
};

