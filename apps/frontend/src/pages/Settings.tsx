import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Bell,
  Globe,
  Zap,
  CreditCard,
  Save,
  Check,
  Loader2,
  AlertCircle,
  Server,
  Target,
  MapPin,
  Building2,
  Users,
  Briefcase,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../store';
import { clientsApi } from '../lib/api';

type SettingsTab = 'profile' | 'icp' | 'email' | 'integrations' | 'notifications' | 'billing';
type EmailProvider = 'resend' | 'sendgrid' | 'smtp' | 'mailgun';

interface EmailSettingsForm {
  provider: EmailProvider;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  apiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapUsername: string;
  imapPassword: string;
  imapMailbox: string;
  imapPollInterval: number;
  dailySendLimit: number;
  hourlySendLimit: number;
  minDelaySeconds: number;
  signature: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

const defaultFormValues: EmailSettingsForm = {
  provider: 'resend',
  fromEmail: '',
  fromName: '',
  replyToEmail: '',
  apiKey: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: true,
  smtpUsername: '',
  smtpPassword: '',
  imapHost: '',
  imapPort: 993,
  imapSecure: true,
  imapUsername: '',
  imapPassword: '',
  imapMailbox: 'INBOX',
  imapPollInterval: 60,
  dailySendLimit: 200,
  hourlySendLimit: 50,
  minDelaySeconds: 5,
  signature: '',
  trackOpens: true,
  trackClicks: true,
};

const providerOptions: { value: EmailProvider; label: string; description: string }[] = [
  { value: 'resend', label: 'Resend', description: 'Modern email API for developers' },
  { value: 'sendgrid', label: 'SendGrid', description: 'Twilio SendGrid email service' },
  { value: 'mailgun', label: 'Mailgun', description: 'Email service for developers' },
  { value: 'smtp', label: 'Custom SMTP', description: 'Connect your own SMTP server' },
];

interface ProfileForm {
  name: string;
  website: string;
  industry: string;
  solution: string;
  summary: string;
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('email');
  const [saved, setSaved] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [formData, setFormData] = useState<EmailSettingsForm>(defaultFormValues);
  const [profileData, setProfileData] = useState<ProfileForm>({ name: '', website: '', industry: '', solution: '', summary: '' });
  const [hasExistingSettings, setHasExistingSettings] = useState(false);
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [showRerunDiscovery, setShowRerunDiscovery] = useState(false);

  const currentClient = useAppStore((state) => state.currentClient);
  const setCurrentClient = useAppStore((state) => state.setCurrentClient);
  const queryClient = useQueryClient();

  // Fetch full client data to get industry and solution
  const { data: clientDataResponse } = useQuery({
    queryKey: ['client', currentClient?.id],
    queryFn: () => clientsApi.get(currentClient!.id),
    enabled: !!currentClient?.id,
  });

  const fullClientData = (clientDataResponse as { data?: {
    id: string;
    name: string;
    website: string;
    industry?: string;
    solution?: string;
    summary?: string;
  } })?.data;

  // Initialize profile form when client data changes
  useEffect(() => {
    if (fullClientData) {
      setProfileData({
        name: fullClientData.name || '',
        website: fullClientData.website || '',
        industry: fullClientData.industry || '',
        solution: fullClientData.solution || '',
        summary: fullClientData.summary || '',
      });
    } else if (currentClient) {
      setProfileData({
        name: currentClient.name || '',
        website: currentClient.website || '',
        industry: '',
        solution: '',
        summary: '',
      });
    }
  }, [fullClientData, currentClient]);

  // Update client profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => {
      if (!currentClient?.id) throw new Error('No client selected');
      return clientsApi.update(currentClient.id, data);
    },
    onSuccess: (_data, variables) => {
      // Update the current client in the store
      if (currentClient) {
        setCurrentClient({
          ...currentClient,
          name: variables.name,
          website: variables.website,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', currentClient?.id] });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    },
  });

  const handleProfileSave = () => {
    updateProfileMutation.mutate(profileData);
  };

  // Re-run discovery mutation
  const rerunDiscoveryMutation = useMutation({
    mutationFn: (prompt: string) => {
      if (!currentClient?.id || !fullClientData?.website) {
        throw new Error('No client or website URL');
      }
      return clientsApi.discover(currentClient.id, fullClientData.website, prompt || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', currentClient?.id] });
      queryClient.invalidateQueries({ queryKey: ['icp', currentClient?.id] });
      setShowRerunDiscovery(false);
      setAdditionalPrompt('');
    },
  });

  const handleRerunDiscovery = () => {
    rerunDiscoveryMutation.mutate(additionalPrompt);
  };

  // Fetch email settings for current client
  const { data: emailSettingsResponse, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['emailSettings', currentClient?.id],
    queryFn: () => clientsApi.getEmailSettings(currentClient!.id),
    enabled: !!currentClient?.id,
  });

  // Fetch ICP for current client
  const { data: icpResponse, isLoading: isLoadingICP } = useQuery({
    queryKey: ['icp', currentClient?.id],
    queryFn: () => clientsApi.getICP(currentClient!.id),
    enabled: !!currentClient?.id,
  });

  const icp = (icpResponse as { data?: unknown })?.data as {
    icpSummary?: string;
    firmographicCriteria?: {
      companySize?: {
        employeeRanges?: string[];
        revenueRanges?: string[];
      };
      companyStage?: string[];
      fundingStatus?: string[];
    };
    geographicTargeting?: {
      primaryMarkets?: Array<{
        city: string;
        state: string;
        country: string;
        priority: string;
      }>;
      expansionMarkets?: Array<{
        city: string;
        state: string;
        country: string;
      }>;
    };
    industryTargeting?: {
      primaryIndustries?: Array<{
        name: string;
        subSegments: string[];
        priority: string;
      }>;
      secondaryIndustries?: Array<{
        name: string;
        subSegments: string[];
      }>;
    };
    decisionMakerTargeting?: {
      primaryTitles?: string[];
      secondaryTitles?: string[];
      departments?: string[];
    };
    messagingFramework?: {
      primaryPainPointsToAddress?: string[];
      valuePropositions?: string[];
      proofPoints?: string[];
      objectionHandlers?: Record<string, string>;
    };
    status?: string;
  } | null;

  // Populate form when settings are loaded
  useEffect(() => {
    const settings = (emailSettingsResponse as { data?: unknown })?.data as {
      provider?: EmailProvider;
      fromEmail?: string;
      fromName?: string;
      replyToEmail?: string;
      apiKey?: string;
      smtpConfig?: {
        host?: string;
        port?: number;
        secure?: boolean;
        username?: string;
        password?: string;
      };
      imapConfig?: {
        host?: string;
        port?: number;
        secure?: boolean;
        username?: string;
        password?: string;
        mailbox?: string;
        pollIntervalSeconds?: number;
      };
      dailySendLimit?: number;
      hourlySendLimit?: number;
      minDelaySeconds?: number;
      signature?: string;
      trackOpens?: boolean;
      trackClicks?: boolean;
    } | null;
    if (settings) {
      setHasExistingSettings(true);
      setFormData({
        provider: settings.provider || 'resend',
        fromEmail: settings.fromEmail || '',
        fromName: settings.fromName || '',
        replyToEmail: settings.replyToEmail || '',
        apiKey: settings.apiKey || '',
        smtpHost: settings.smtpConfig?.host || '',
        smtpPort: settings.smtpConfig?.port || 587,
        smtpSecure: settings.smtpConfig?.secure ?? true,
        smtpUsername: settings.smtpConfig?.username || '',
        smtpPassword: settings.smtpConfig?.password || '',
        imapHost: settings.imapConfig?.host || '',
        imapPort: settings.imapConfig?.port || 993,
        imapSecure: settings.imapConfig?.secure ?? true,
        imapUsername: settings.imapConfig?.username || '',
        imapPassword: settings.imapConfig?.password || '',
        imapMailbox: settings.imapConfig?.mailbox || 'INBOX',
        imapPollInterval: settings.imapConfig?.pollIntervalSeconds || 60,
        dailySendLimit: settings.dailySendLimit || 200,
        hourlySendLimit: settings.hourlySendLimit || 50,
        minDelaySeconds: settings.minDelaySeconds || 5,
        signature: settings.signature || '',
        trackOpens: settings.trackOpens ?? true,
        trackClicks: settings.trackClicks ?? true,
      });
    } else {
      setHasExistingSettings(false);
      setFormData(defaultFormValues);
    }
  }, [emailSettingsResponse]);

  // Build payload for email settings
  const buildPayload = (data: EmailSettingsForm) => ({
    provider: data.provider,
    fromEmail: data.fromEmail,
    fromName: data.fromName,
    replyToEmail: data.replyToEmail || undefined,
    apiKey: data.provider !== 'smtp' ? data.apiKey : undefined,
    smtpConfig: data.provider === 'smtp' ? {
      host: data.smtpHost,
      port: data.smtpPort,
      secure: data.smtpSecure,
      username: data.smtpUsername,
      password: data.smtpPassword,
    } : undefined,
    imapConfig: data.imapHost ? {
      host: data.imapHost,
      port: data.imapPort,
      secure: data.imapSecure,
      username: data.imapUsername,
      password: data.imapPassword,
      mailbox: data.imapMailbox,
      pollIntervalSeconds: data.imapPollInterval,
    } : undefined,
    dailySendLimit: data.dailySendLimit,
    hourlySendLimit: data.hourlySendLimit,
    minDelaySeconds: data.minDelaySeconds,
    signature: data.signature || undefined,
    trackOpens: data.trackOpens,
    trackClicks: data.trackClicks,
  });

  // Create email settings mutation
  const createMutation = useMutation({
    mutationFn: (data: EmailSettingsForm) => {
      return clientsApi.createEmailSettings(currentClient!.id, buildPayload(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailSettings', currentClient?.id] });
      setSaved(true);
      setHasExistingSettings(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  // Update email settings mutation
  const updateMutation = useMutation({
    mutationFn: (data: EmailSettingsForm) => {
      return clientsApi.updateEmailSettings(currentClient!.id, buildPayload(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailSettings', currentClient?.id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = () => {
    if (hasExistingSettings) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'icp' as const, label: 'ICP & Targeting', icon: Target },
    { id: 'email' as const, label: 'Email Settings', icon: Mail },
    { id: 'integrations' as const, label: 'Integrations', icon: Zap },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'billing' as const, label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Settings</h1>
        <p className="mt-1 text-surface-500">
          Manage your account and preferences
          {currentClient && (
            <span className="ml-2 text-primary-600 font-medium">
              • {currentClient.name}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <nav className="lg:w-64 flex-shrink-0">
          <div className="card p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-surface-600 hover:bg-surface-50'
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="card p-6 space-y-6">
              {!currentClient ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-surface-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-surface-900 mb-2">No Client Selected</h3>
                  <p className="text-surface-500">Please select a client to edit profile settings.</p>
                </div>
              ) : (
                <>
                  {/* Basic Information */}
                  <div>
                    <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary-600" />
                      Basic Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="company" className="label">
                          Company Name
                        </label>
                        <input
                          id="company"
                          type="text"
                          value={profileData.name}
                          onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                          placeholder="Enter company name"
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="website" className="label">
                          Company Website
                        </label>
                        <input
                          id="website"
                          type="url"
                          value={profileData.website}
                          onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                          placeholder="https://example.com"
                          className="input"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="industry" className="label">
                          Industry
                        </label>
                        <input
                          id="industry"
                          type="text"
                          value={profileData.industry}
                          onChange={(e) => setProfileData({ ...profileData, industry: e.target.value })}
                          placeholder="e.g., SaaS, Healthcare Technology, Financial Services"
                          className="input"
                        />
                        <p className="mt-1 text-sm text-surface-500">
                          The primary industry your company operates in.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Company Summary */}
                  <div>
                    <h3 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-surface-500" />
                      Company Summary
                      {profileData.summary && (
                        <span className="text-xs bg-surface-100 text-surface-600 px-2 py-0.5 rounded-full">AI Generated</span>
                      )}
                    </h3>
                    <div>
                      <textarea
                        id="summary"
                        rows={4}
                        value={profileData.summary}
                        onChange={(e) => setProfileData({ ...profileData, summary: e.target.value })}
                        placeholder="A brief overview of your company, its market position, and key characteristics. This is typically auto-generated during business discovery."
                        className="input resize-none"
                      />
                      <p className="mt-1 text-sm text-surface-500">
                        This summary provides context about your business for email personalization.
                      </p>
                    </div>
                  </div>

                  {/* Company Solution/Product */}
                  <div>
                    <h3 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-surface-500" />
                      Value Proposition
                    </h3>
                    <div>
                      <textarea
                        id="solution"
                        rows={4}
                        value={profileData.solution}
                        onChange={(e) => setProfileData({ ...profileData, solution: e.target.value })}
                        placeholder="Describe what your company offers, the problems you solve, and the value you provide to customers. This will be used to personalize outreach emails."
                        className="input resize-none"
                      />
                      <p className="mt-1 text-sm text-surface-500">
                        This description is used by AI to generate personalized email templates that accurately represent your offering.
                      </p>
                    </div>
                  </div>

                  {/* Info box about email personalization */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Used for Email Personalization</p>
                        <p className="text-sm text-blue-600 mt-1">
                          The industry and solution description are used alongside your ICP data to generate highly personalized email templates that resonate with your target prospects.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Error message */}
                  {updateProfileMutation.error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Failed to save profile</p>
                        <p className="text-sm text-red-600">{updateProfileMutation.error.message}</p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-surface-200 flex items-center gap-4">
                    <button
                      onClick={handleProfileSave}
                      disabled={updateProfileMutation.isPending || !profileData.name || !profileData.website}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : profileSaved ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>

                  {/* Re-run Discovery Section */}
                  <div className="pt-6 border-t border-surface-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium text-surface-900 flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-surface-500" />
                          Re-run Business Discovery
                        </h3>
                        <p className="text-sm text-surface-500 mt-1">
                          Re-analyze your website and regenerate the company profile and ICP with additional guidance.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowRerunDiscovery(!showRerunDiscovery)}
                        className="btn-secondary text-sm"
                      >
                        {showRerunDiscovery ? 'Cancel' : 'Configure'}
                      </button>
                    </div>

                    {showRerunDiscovery && (
                      <div className="space-y-4 p-4 bg-surface-50 rounded-lg">
                        <div>
                          <label htmlFor="additionalPrompt" className="label flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary-500" />
                            Additional Guidance (Optional)
                          </label>
                          <textarea
                            id="additionalPrompt"
                            rows={4}
                            value={additionalPrompt}
                            onChange={(e) => setAdditionalPrompt(e.target.value)}
                            placeholder="Provide additional context to guide the AI analysis. For example:&#10;- 'Focus on manufacturing companies in the Nordic region'&#10;- 'Our main competitors are X and Y'&#10;- 'We specialize in enterprise clients with 500+ employees'"
                            className="input resize-none"
                          />
                          <p className="mt-1 text-xs text-surface-500">
                            This prompt will be added to the AI analysis to help generate more accurate results.
                          </p>
                        </div>

                        {rerunDiscoveryMutation.error && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600">{rerunDiscoveryMutation.error.message}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleRerunDiscovery}
                            disabled={rerunDiscoveryMutation.isPending}
                            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {rerunDiscoveryMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Running Discovery...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Re-run Discovery
                              </>
                            )}
                          </button>
                          <p className="text-xs text-surface-500">
                            This will update your company profile, summary, and ICP.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'icp' && (
            <div className="card p-6 space-y-6">
              {!currentClient ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-surface-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-surface-900 mb-2">No Client Selected</h3>
                  <p className="text-surface-500">Please select a client to view ICP data.</p>
                </div>
              ) : isLoadingICP ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : !icp ? (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-surface-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-surface-900 mb-2">No ICP Generated</h3>
                  <p className="text-surface-500">Run business discovery from the onboarding process to generate an ICP.</p>
                </div>
              ) : (
                <>
                  {/* ICP Summary */}
                  <div>
                    <h2 className="text-lg font-semibold text-surface-900 mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5 text-primary-600" />
                      Ideal Customer Profile
                    </h2>
                    <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
                      <p className="text-surface-700 leading-relaxed">{icp.icpSummary}</p>
                    </div>
                    {icp.status && (
                      <div className="mt-2">
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          icp.status === 'approved' ? 'bg-green-100 text-green-700' :
                          icp.status === 'refined' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        )}>
                          {icp.status.charAt(0).toUpperCase() + icp.status.slice(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Geographic Targeting */}
                  {icp.geographicTargeting && (
                    <div>
                      <h3 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-surface-500" />
                        Geographic Targeting
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {icp.geographicTargeting.primaryMarkets && icp.geographicTargeting.primaryMarkets.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Primary Markets</p>
                            <div className="flex flex-wrap gap-2">
                              {icp.geographicTargeting.primaryMarkets.map((market, idx) => (
                                <span
                                  key={idx}
                                  className={clsx(
                                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                                    market.priority === 'high' ? 'bg-green-100 text-green-700' :
                                    market.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-surface-200 text-surface-600'
                                  )}
                                >
                                  {market.city}, {market.state}, {market.country}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {icp.geographicTargeting.expansionMarkets && icp.geographicTargeting.expansionMarkets.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Expansion Markets</p>
                            <div className="flex flex-wrap gap-2">
                              {icp.geographicTargeting.expansionMarkets.map((market, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surface-200 text-surface-600"
                                >
                                  {market.city}, {market.state}, {market.country}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Industry Targeting */}
                  {icp.industryTargeting && (
                    <div>
                      <h3 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-surface-500" />
                        Industry Targeting
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {icp.industryTargeting.primaryIndustries && icp.industryTargeting.primaryIndustries.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Primary Industries</p>
                            <div className="space-y-2">
                              {icp.industryTargeting.primaryIndustries.map((industry, idx) => (
                                <div key={idx}>
                                  <span className={clsx(
                                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                                    industry.priority === 'high' ? 'bg-green-100 text-green-700' :
                                    industry.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-surface-200 text-surface-600'
                                  )}>
                                    {industry.name}
                                  </span>
                                  {industry.subSegments && industry.subSegments.length > 0 && (
                                    <p className="text-xs text-surface-500 mt-1 ml-1">
                                      {industry.subSegments.join(', ')}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {icp.industryTargeting.secondaryIndustries && icp.industryTargeting.secondaryIndustries.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Secondary Industries</p>
                            <div className="space-y-2">
                              {icp.industryTargeting.secondaryIndustries.map((industry, idx) => (
                                <div key={idx}>
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surface-200 text-surface-600">
                                    {industry.name}
                                  </span>
                                  {industry.subSegments && industry.subSegments.length > 0 && (
                                    <p className="text-xs text-surface-500 mt-1 ml-1">
                                      {industry.subSegments.join(', ')}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Firmographic Criteria */}
                  {icp.firmographicCriteria && (
                    <div>
                      <h3 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-surface-500" />
                        Firmographic Criteria
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {icp.firmographicCriteria.companySize?.employeeRanges && icp.firmographicCriteria.companySize.employeeRanges.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Employee Count</p>
                            <div className="flex flex-wrap gap-1">
                              {icp.firmographicCriteria.companySize.employeeRanges.map((range, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-surface-200 text-surface-600">
                                  {range}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {icp.firmographicCriteria.companyStage && icp.firmographicCriteria.companyStage.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Company Stage</p>
                            <div className="flex flex-wrap gap-1">
                              {icp.firmographicCriteria.companyStage.map((stage, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-surface-200 text-surface-600">
                                  {stage}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {icp.firmographicCriteria.fundingStatus && icp.firmographicCriteria.fundingStatus.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Funding Status</p>
                            <div className="flex flex-wrap gap-1">
                              {icp.firmographicCriteria.fundingStatus.map((status, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-surface-200 text-surface-600">
                                  {status}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Decision Maker Targeting */}
                  {icp.decisionMakerTargeting && (
                    <div>
                      <h3 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-surface-500" />
                        Decision Maker Targeting
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {icp.decisionMakerTargeting.primaryTitles && icp.decisionMakerTargeting.primaryTitles.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Primary Titles</p>
                            <div className="flex flex-wrap gap-1">
                              {icp.decisionMakerTargeting.primaryTitles.map((title, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                  {title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {icp.decisionMakerTargeting.secondaryTitles && icp.decisionMakerTargeting.secondaryTitles.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Secondary Titles</p>
                            <div className="flex flex-wrap gap-1">
                              {icp.decisionMakerTargeting.secondaryTitles.map((title, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-surface-200 text-surface-600">
                                  {title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {icp.decisionMakerTargeting.departments && icp.decisionMakerTargeting.departments.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Departments</p>
                            <div className="flex flex-wrap gap-1">
                              {icp.decisionMakerTargeting.departments.map((dept, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                                  {dept}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Messaging Framework */}
                  {icp.messagingFramework && (
                    <div>
                      <h3 className="font-medium text-surface-900 mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-surface-500" />
                        Messaging Framework
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {icp.messagingFramework.primaryPainPointsToAddress && icp.messagingFramework.primaryPainPointsToAddress.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Pain Points to Address</p>
                            <ul className="space-y-1">
                              {icp.messagingFramework.primaryPainPointsToAddress.map((point, idx) => (
                                <li key={idx} className="text-sm text-surface-600 flex items-start gap-2">
                                  <span className="text-red-500 mt-1">•</span>
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {icp.messagingFramework.valuePropositions && icp.messagingFramework.valuePropositions.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg">
                            <p className="text-sm font-medium text-surface-700 mb-2">Value Propositions</p>
                            <ul className="space-y-1">
                              {icp.messagingFramework.valuePropositions.map((prop, idx) => (
                                <li key={idx} className="text-sm text-surface-600 flex items-start gap-2">
                                  <span className="text-green-500 mt-1">•</span>
                                  {prop}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {icp.messagingFramework.proofPoints && icp.messagingFramework.proofPoints.length > 0 && (
                          <div className="p-4 bg-surface-50 rounded-lg md:col-span-2">
                            <p className="text-sm font-medium text-surface-700 mb-2">Proof Points</p>
                            <ul className="space-y-1">
                              {icp.messagingFramework.proofPoints.map((point, idx) => (
                                <li key={idx} className="text-sm text-surface-600 flex items-start gap-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'email' && (
            <div className="card p-6 space-y-6">
              {!currentClient ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-surface-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-surface-900 mb-2">No Client Selected</h3>
                  <p className="text-surface-500">Please select a client to configure email settings.</p>
                </div>
              ) : isLoadingSettings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Provider Selection */}
                  <div>
                    <h2 className="text-lg font-semibold text-surface-900 mb-4">
                      Email Provider
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {providerOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setFormData({ ...formData, provider: option.value })}
                          className={clsx(
                            'p-4 rounded-lg border-2 text-left transition-all',
                            formData.provider === option.value
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-surface-200 hover:border-surface-300'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {option.value === 'smtp' ? (
                              <Server className="w-5 h-5 text-surface-600" />
                            ) : (
                              <Mail className="w-5 h-5 text-surface-600" />
                            )}
                            <div>
                              <p className="font-medium text-surface-900">{option.label}</p>
                              <p className="text-sm text-surface-500">{option.description}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* API Key (for non-SMTP providers) */}
                  {formData.provider !== 'smtp' && (
                    <div>
                      <h3 className="font-medium text-surface-900 mb-3">API Configuration</h3>
                      <div>
                        <label htmlFor="apiKey" className="label">
                          API Key
                        </label>
                        <input
                          id="apiKey"
                          type="password"
                          value={formData.apiKey}
                          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                          placeholder={`Enter your ${providerOptions.find(p => p.value === formData.provider)?.label} API key`}
                          className="input"
                        />
                        <p className="mt-1 text-sm text-surface-500">
                          Your API key is encrypted and stored securely.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SMTP Configuration */}
                  {formData.provider === 'smtp' && (
                    <div>
                      <h3 className="font-medium text-surface-900 mb-3">SMTP Configuration</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="smtpHost" className="label">
                            SMTP Host
                          </label>
                          <input
                            id="smtpHost"
                            type="text"
                            value={formData.smtpHost}
                            onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                            placeholder="smtp.example.com"
                            className="input"
                          />
                        </div>
                        <div>
                          <label htmlFor="smtpPort" className="label">
                            Port
                          </label>
                          <input
                            id="smtpPort"
                            type="number"
                            value={formData.smtpPort}
                            onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) || 587 })}
                            className="input"
                          />
                        </div>
                        <div>
                          <label htmlFor="smtpUsername" className="label">
                            Username
                          </label>
                          <input
                            id="smtpUsername"
                            type="text"
                            value={formData.smtpUsername}
                            onChange={(e) => setFormData({ ...formData, smtpUsername: e.target.value })}
                            className="input"
                          />
                        </div>
                        <div>
                          <label htmlFor="smtpPassword" className="label">
                            Password
                          </label>
                          <input
                            id="smtpPassword"
                            type="password"
                            value={formData.smtpPassword}
                            onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                            className="input"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.smtpSecure}
                              onChange={(e) => setFormData({ ...formData, smtpSecure: e.target.checked })}
                              className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-surface-700">Use TLS/SSL encryption</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* IMAP Configuration (for receiving/tracking replies) */}
                  <div>
                    <h3 className="font-medium text-surface-900 mb-2">IMAP Configuration</h3>
                    <p className="text-sm text-surface-500 mb-4">
                      Configure IMAP settings to track email replies and manage campaign responses.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="imapHost" className="label">
                          IMAP Host
                        </label>
                        <input
                          id="imapHost"
                          type="text"
                          value={formData.imapHost}
                          onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                          placeholder="imap.example.com"
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="imapPort" className="label">
                          Port
                        </label>
                        <input
                          id="imapPort"
                          type="number"
                          value={formData.imapPort}
                          onChange={(e) => setFormData({ ...formData, imapPort: parseInt(e.target.value) || 993 })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="imapUsername" className="label">
                          Username
                        </label>
                        <input
                          id="imapUsername"
                          type="text"
                          value={formData.imapUsername}
                          onChange={(e) => setFormData({ ...formData, imapUsername: e.target.value })}
                          placeholder="email@example.com"
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="imapPassword" className="label">
                          Password
                        </label>
                        <input
                          id="imapPassword"
                          type="password"
                          value={formData.imapPassword}
                          onChange={(e) => setFormData({ ...formData, imapPassword: e.target.value })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="imapMailbox" className="label">
                          Mailbox Folder
                        </label>
                        <input
                          id="imapMailbox"
                          type="text"
                          value={formData.imapMailbox}
                          onChange={(e) => setFormData({ ...formData, imapMailbox: e.target.value })}
                          placeholder="INBOX"
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="imapPollInterval" className="label">
                          Poll Interval (seconds)
                        </label>
                        <input
                          id="imapPollInterval"
                          type="number"
                          value={formData.imapPollInterval}
                          onChange={(e) => setFormData({ ...formData, imapPollInterval: parseInt(e.target.value) || 60 })}
                          className="input"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.imapSecure}
                            onChange={(e) => setFormData({ ...formData, imapSecure: e.target.checked })}
                            className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-surface-700">Use TLS/SSL encryption</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Sender Information */}
                  <div>
                    <h3 className="font-medium text-surface-900 mb-3">Sender Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="fromEmail" className="label">
                          From Email
                        </label>
                        <input
                          id="fromEmail"
                          type="email"
                          value={formData.fromEmail}
                          onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                          placeholder="outreach@company.com"
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="fromName" className="label">
                          From Name
                        </label>
                        <input
                          id="fromName"
                          type="text"
                          value={formData.fromName}
                          onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                          placeholder="John from Company"
                          className="input"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="replyToEmail" className="label">
                          Reply-To Email (optional)
                        </label>
                        <input
                          id="replyToEmail"
                          type="email"
                          value={formData.replyToEmail}
                          onChange={(e) => setFormData({ ...formData, replyToEmail: e.target.value })}
                          placeholder="sales@company.com"
                          className="input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Rate Limiting */}
                  <div>
                    <h3 className="font-medium text-surface-900 mb-3">Rate Limiting</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="dailySendLimit" className="label">
                          Daily Send Limit
                        </label>
                        <input
                          id="dailySendLimit"
                          type="number"
                          value={formData.dailySendLimit}
                          onChange={(e) => setFormData({ ...formData, dailySendLimit: parseInt(e.target.value) || 200 })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="hourlySendLimit" className="label">
                          Hourly Send Limit
                        </label>
                        <input
                          id="hourlySendLimit"
                          type="number"
                          value={formData.hourlySendLimit}
                          onChange={(e) => setFormData({ ...formData, hourlySendLimit: parseInt(e.target.value) || 50 })}
                          className="input"
                        />
                      </div>
                      <div>
                        <label htmlFor="minDelaySeconds" className="label">
                          Min Delay (seconds)
                        </label>
                        <input
                          id="minDelaySeconds"
                          type="number"
                          value={formData.minDelaySeconds}
                          onChange={(e) => setFormData({ ...formData, minDelaySeconds: parseInt(e.target.value) || 5 })}
                          className="input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email Signature */}
                  <div>
                    <label htmlFor="signature" className="label">
                      Email Signature
                    </label>
                    <textarea
                      id="signature"
                      rows={4}
                      value={formData.signature}
                      onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                      placeholder="Best regards,&#10;John Doe&#10;Sales Director"
                      className="input resize-none"
                    />
                  </div>

                  {/* Tracking Options */}
                  <div>
                    <h3 className="font-medium text-surface-900 mb-3">Tracking</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.trackOpens}
                          onChange={(e) => setFormData({ ...formData, trackOpens: e.target.checked })}
                          className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-surface-900">Track Email Opens</span>
                          <p className="text-xs text-surface-500">Add a tracking pixel to detect when emails are opened</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.trackClicks}
                          onChange={(e) => setFormData({ ...formData, trackClicks: e.target.checked })}
                          className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-surface-900">Track Link Clicks</span>
                          <p className="text-xs text-surface-500">Rewrite links to track when recipients click them</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Failed to save settings</p>
                        <p className="text-sm text-red-600">{error.message}</p>
                      </div>
                    </div>
                  )}

                  {/* Save button */}
                  <div className="pt-4 border-t border-surface-200">
                    <button
                      onClick={handleSave}
                      disabled={isSubmitting || !formData.fromEmail || !formData.fromName}
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : saved ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Saved!
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          {hasExistingSettings ? 'Update Settings' : 'Save Settings'}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">
                API Integrations
              </h2>

              <div className="space-y-4">
                {[
                  { name: 'Anthropic API', connected: true, icon: Zap },
                  { name: 'Google Maps API', connected: true, icon: Globe },
                  { name: 'Firecrawl API', connected: true, icon: Globe },
                  { name: 'Perplexity API', connected: true, icon: Globe },
                  { name: 'Resend Email', connected: true, icon: Mail },
                  { name: 'Hunter.io', connected: false, icon: User },
                ].map((integration) => (
                  <div
                    key={integration.name}
                    className="flex items-center justify-between p-4 bg-surface-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white">
                        <integration.icon className="w-5 h-5 text-surface-600" />
                      </div>
                      <div>
                        <p className="font-medium text-surface-900">
                          {integration.name}
                        </p>
                        <p className="text-sm text-surface-500">
                          {integration.connected ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    <button
                      className={clsx(
                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                        integration.connected
                          ? 'bg-green-100 text-green-700'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      )}
                    >
                      {integration.connected ? 'Connected' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">
                Notification Preferences
              </h2>

              <div className="space-y-4">
                {[
                  {
                    label: 'Email responses',
                    description: 'Get notified when someone replies to your emails',
                    enabled: true,
                  },
                  {
                    label: 'Campaign completion',
                    description: 'Get notified when a campaign finishes',
                    enabled: true,
                  },
                  {
                    label: 'Daily summary',
                    description: 'Receive a daily digest of your campaign performance',
                    enabled: false,
                  },
                  {
                    label: 'Bounce alerts',
                    description: 'Get notified when emails bounce',
                    enabled: true,
                  },
                ].map((notification) => (
                  <div
                    key={notification.label}
                    className="flex items-center justify-between p-4 bg-surface-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-surface-900">
                        {notification.label}
                      </p>
                      <p className="text-sm text-surface-500">
                        {notification.description}
                      </p>
                    </div>
                    <button
                      className={clsx(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        notification.enabled ? 'bg-primary-600' : 'bg-surface-300'
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          notification.enabled ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-lg font-semibold text-surface-900 mb-4">
                Billing & Subscription
              </h2>

              <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-primary-900">Pro Plan</p>
                    <p className="text-sm text-primary-700">
                      $99/month • Unlimited campaigns
                    </p>
                  </div>
                  <span className="badge-primary">Active</span>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-surface-900 mb-3">
                  Usage This Month
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-surface-600">Emails Sent</span>
                      <span className="font-medium">3,420 / 10,000</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: '34.2%' }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-surface-600">API Calls</span>
                      <span className="font-medium">1,250 / 5,000</span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-500 rounded-full"
                        style={{ width: '25%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-surface-200">
                <button className="btn-secondary">Manage Subscription</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
