import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mail,
  Users,
  Settings,
  Eye,
  Loader2,
  X,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  User,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
import { campaignsApi, prospectsApi, clientsApi } from '../../lib/api';
import { useAppStore } from '../../store';
import { clsx } from 'clsx';

// Invalid values that should be flagged across the application
const INVALID_VALUES = [
  'unknown', 'n/a', 'na', 'none', 'not available', 'not specified',
  'undefined', 'null', '-', '--', '...', 'tbd', 'to be determined',
];

const isValidValue = (value: string | null | undefined): boolean => {
  if (!value || !value.trim()) return false;
  return !INVALID_VALUES.includes(value.trim().toLowerCase());
};

type Step = 'basics' | 'prospects' | 'emails' | 'settings' | 'review';

// Contact selection: { prospectId: contactId }
type ContactSelection = Record<string, string>;

interface Contact {
  id: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  isPrimary: boolean;
}

interface ProspectWithContacts {
  id: string;
  companyName: string;
  industry: string;
  icpMatchScore: number;
  contacts: Contact[];
}

interface CampaignFormData {
  name: string;
  description: string;
  prospectIds: string[];
  contactSelections: ContactSelection; // Which contact to use per prospect
  emailTemplates: Array<{
    sequence: number;
    subject: string;
    body: string;
    delayDays: number;
    customInstructions?: string; // Per-template AI generation instructions
  }>;
  settings: {
    dailySendLimit: number;
    sendWindowStart: string;
    sendWindowEnd: string;
    timezone: string;
    skipWeekends: boolean;
  };
}

interface EmailSettings {
  id: string;
  provider: string;
  fromEmail: string;
  fromName: string;
  isVerified: boolean;
  isActive: boolean;
  smtpConfig?: {
    host: string;
    port: number;
  };
  imapConfig?: {
    host: string;
    port: number;
  };
}

const STEPS: { id: Step; label: string; icon: typeof Mail }[] = [
  { id: 'basics', label: 'Basics', icon: Mail },
  { id: 'prospects', label: 'Prospects', icon: Users },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'review', label: 'Review', icon: Eye },
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
];

export function CampaignBuilder({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const currentClient = useAppStore((state) => state.currentClient);
  const [step, setStep] = useState<Step>('basics');
  const [reviewValidationPassed, setReviewValidationPassed] = useState(true);
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    prospectIds: [],
    contactSelections: {},
    emailTemplates: [
      { sequence: 1, subject: '', body: '', delayDays: 0 },
      { sequence: 2, subject: '', body: '', delayDays: 3 },
      { sequence: 3, subject: '', body: '', delayDays: 7 },
    ],
    settings: {
      dailySendLimit: 50,
      sendWindowStart: '09:00',
      sendWindowEnd: '17:00',
      timezone: 'America/New_York',
      skipWeekends: true,
    },
  });

  // Fetch email settings for the current client
  const { data: emailSettingsData, isLoading: isLoadingEmailSettings } = useQuery({
    queryKey: ['emailSettings', currentClient?.id],
    queryFn: () => clientsApi.getEmailSettings(currentClient!.id),
    enabled: !!currentClient?.id,
  });

  const emailSettings = emailSettingsData?.data as EmailSettings | undefined;

  const { data: prospectsData } = useQuery({
    queryKey: ['prospects', 'all'],
    queryFn: () => prospectsApi.list({ pageSize: 1000 }),
  });

  // Filter prospects to only those with at least 1 contact with valid email
  const allProspects = (prospectsData?.data?.data || []) as ProspectWithContacts[];
  const prospects = allProspects.filter((p) =>
    p.contacts?.some((c) => c.email && c.email.includes('@'))
  );

  const createMutation = useMutation({
    mutationFn: (data: CampaignFormData) =>
      campaignsApi.create({
        clientId: currentClient?.id || 'default',
        name: data.name,
        description: data.description,
        prospectIds: data.prospectIds,
        contactSelections: data.contactSelections, // Which contact to email per prospect
        emailTemplates: data.emailTemplates.map((template, index) => ({
          id: `template-${index + 1}`,
          sequence: template.sequence,
          subject: template.subject,
          body: template.body,
          bodyHtml: template.body.replace(/\n/g, '<br>'), // Simple HTML conversion
          delayDays: template.delayDays,
        })),
        settings: data.settings,
      }),
    onSuccess: (response) => {
      navigate(`/campaigns/${response.data.id}`);
    },
  });

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goNext = () => {
    const nextIndex = Math.min(stepIndex + 1, STEPS.length - 1);
    setStep(STEPS[nextIndex].id);
  };

  const goPrev = () => {
    const prevIndex = Math.max(stepIndex - 1, 0);
    setStep(STEPS[prevIndex].id);
  };

  const canProceed = () => {
    switch (step) {
      case 'basics':
        return formData.name.trim().length > 0;
      case 'prospects':
        return formData.prospectIds.length > 0;
      case 'emails':
        return formData.emailTemplates.every(
          (t) => t.subject.trim() && t.body.trim()
        );
      case 'settings':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    createMutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-surface-900">
            Create Campaign
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 bg-surface-50 border-b border-surface-200">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => setStep(s.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    step === s.id
                      ? 'bg-primary-100 text-primary-700'
                      : stepIndex > i
                      ? 'text-primary-600'
                      : 'text-surface-400'
                  )}
                >
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      step === s.id
                        ? 'bg-primary-500 text-white'
                        : stepIndex > i
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-surface-200 text-surface-500'
                    )}
                  >
                    {stepIndex > i ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <s.icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="font-medium hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={clsx(
                      'w-8 h-0.5 mx-2',
                      stepIndex > i ? 'bg-primary-500' : 'bg-surface-200'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Email Settings Status Banner */}
        <EmailSettingsStatus
          emailSettings={emailSettings}
          isLoading={isLoadingEmailSettings}
        />

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 260px)' }}>
          {step === 'basics' && (
            <BasicsStep formData={formData} setFormData={setFormData} />
          )}
          {step === 'prospects' && (
            <ProspectsStep
              formData={formData}
              setFormData={setFormData}
              prospects={prospects}
            />
          )}
          {step === 'emails' && (
            <EmailsStep
              formData={formData}
              setFormData={setFormData}
              clientId={currentClient?.id || 'default'}
              prospects={prospects}
            />
          )}
          {step === 'settings' && (
            <SettingsStep formData={formData} setFormData={setFormData} />
          )}
          {step === 'review' && (
            <ReviewStep
              formData={formData}
              setFormData={setFormData}
              prospects={prospects}
              onValidationChange={setReviewValidationPassed}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-200 flex items-center justify-between bg-surface-50">
          <button
            onClick={goPrev}
            disabled={stepIndex === 0}
            className="btn-secondary disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            {step === 'review' ? (
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !reviewValidationPassed}
                className={clsx(
                  'btn-primary',
                  !reviewValidationPassed && 'opacity-50 cursor-not-allowed'
                )}
                title={!reviewValidationPassed ? 'Fix invalid values before creating campaign' : undefined}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : !reviewValidationPassed ? (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Fix Values First
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Create Campaign
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className="btn-primary disabled:opacity-50"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BasicsStep({
  formData,
  setFormData,
}: {
  formData: CampaignFormData;
  setFormData: (data: CampaignFormData) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-surface-900 mb-4">
          Campaign Details
        </h3>
        <div className="space-y-4">
          <div>
            <label className="label">Campaign Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Q1 2025 Outreach - SaaS Companies"
              className="input"
            />
          </div>
          <div>
            <label className="label">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief description of the campaign goals and target audience"
              rows={3}
              className="input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProspectsStep({
  formData,
  setFormData,
  prospects,
}: {
  formData: CampaignFormData;
  setFormData: (data: CampaignFormData) => void;
  prospects: ProspectWithContacts[];
}) {
  const [expandedProspects, setExpandedProspects] = useState<Set<string>>(new Set());

  // Get contacts with valid emails for a prospect
  const getValidContacts = (prospect: ProspectWithContacts) =>
    prospect.contacts?.filter((c) => c.email && c.email.includes('@')) || [];

  // Toggle prospect selection and auto-select primary/first contact
  const toggleProspect = (prospect: ProspectWithContacts) => {
    const isSelected = formData.prospectIds.includes(prospect.id);

    if (isSelected) {
      // Remove prospect and its contact selection
      const newIds = formData.prospectIds.filter((pid) => pid !== prospect.id);
      const newSelections = { ...formData.contactSelections };
      delete newSelections[prospect.id];
      setFormData({ ...formData, prospectIds: newIds, contactSelections: newSelections });
    } else {
      // Add prospect and auto-select primary or first valid contact
      const validContacts = getValidContacts(prospect);
      const primaryContact = validContacts.find((c) => c.isPrimary) || validContacts[0];
      setFormData({
        ...formData,
        prospectIds: [...formData.prospectIds, prospect.id],
        contactSelections: {
          ...formData.contactSelections,
          [prospect.id]: primaryContact?.id || '',
        },
      });
    }
  };

  // Change contact selection for a prospect
  const selectContact = (prospectId: string, contactId: string) => {
    setFormData({
      ...formData,
      contactSelections: {
        ...formData.contactSelections,
        [prospectId]: contactId,
      },
    });
  };

  // Toggle expand/collapse for prospect contacts
  const toggleExpanded = (prospectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedProspects);
    if (newExpanded.has(prospectId)) {
      newExpanded.delete(prospectId);
    } else {
      newExpanded.add(prospectId);
    }
    setExpandedProspects(newExpanded);
  };

  // Select all prospects with their primary contacts
  const selectAll = () => {
    const newIds = prospects.map((p) => p.id);
    const newSelections: ContactSelection = {};
    prospects.forEach((prospect) => {
      const validContacts = getValidContacts(prospect);
      const primaryContact = validContacts.find((c) => c.isPrimary) || validContacts[0];
      if (primaryContact) {
        newSelections[prospect.id] = primaryContact.id;
      }
    });
    setFormData({ ...formData, prospectIds: newIds, contactSelections: newSelections });
  };

  // Deselect all
  const deselectAll = () => {
    setFormData({ ...formData, prospectIds: [], contactSelections: {} });
  };

  const allSelected = formData.prospectIds.length === prospects.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-surface-900">
            Select Prospects & Contacts
          </h3>
          <p className="text-sm text-surface-500 mt-1">
            Only prospects with valid email contacts are shown
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-surface-500">
            {formData.prospectIds.length} of {prospects.length} selected
          </span>
          <button
            onClick={allSelected ? deselectAll : selectAll}
            className="text-sm text-primary-600 hover:underline"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      <div className="border border-surface-200 rounded-lg overflow-hidden max-h-[28rem] overflow-y-auto">
        {prospects.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-surface-300" />
            <p className="font-medium">No prospects with email contacts</p>
            <p className="text-sm mt-1">
              Discover leads and run contact discovery first.
            </p>
          </div>
        ) : (
          prospects.map((prospect) => {
            const validContacts = getValidContacts(prospect);
            const isSelected = formData.prospectIds.includes(prospect.id);
            const isExpanded = expandedProspects.has(prospect.id);
            const selectedContactId = formData.contactSelections[prospect.id];
            const selectedContact = validContacts.find((c) => c.id === selectedContactId);

            return (
              <div
                key={prospect.id}
                className={clsx(
                  'border-b border-surface-100 last:border-b-0',
                  isSelected && 'bg-primary-50/50'
                )}
              >
                {/* Prospect row */}
                <div
                  onClick={() => toggleProspect(prospect)}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-50"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleProspect(prospect)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                  />

                  {/* Expand/collapse button */}
                  <button
                    onClick={(e) => toggleExpanded(prospect.id, e)}
                    className="p-1 hover:bg-surface-200 rounded transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-surface-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-surface-400" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-surface-900 truncate">
                      {prospect.companyName}
                    </p>
                    <p className="text-xs text-surface-500">
                      {prospect.industry} · {validContacts.length} contact{validContacts.length !== 1 ? 's' : ''}
                      {isSelected && selectedContact && (
                        <span className="text-primary-600">
                          {' '}· Sending to: {selectedContact.name}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full',
                          prospect.icpMatchScore >= 0.8
                            ? 'bg-green-500'
                            : prospect.icpMatchScore >= 0.6
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        )}
                        style={{ width: `${(prospect.icpMatchScore || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-surface-500 w-10 text-right">
                      {Math.round((prospect.icpMatchScore || 0) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Expanded contacts list */}
                {isExpanded && (
                  <div className="pl-12 pr-4 pb-3 space-y-1">
                    {validContacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected) {
                            selectContact(prospect.id, contact.id);
                          }
                        }}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer',
                          isSelected && selectedContactId === contact.id
                            ? 'bg-primary-100 border border-primary-300'
                            : 'bg-surface-50 hover:bg-surface-100 border border-transparent'
                        )}
                      >
                        <User className="w-4 h-4 text-surface-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-surface-900 truncate">
                              {contact.name}
                            </span>
                            {contact.isPrimary && (
                              <span className="text-xs bg-surface-200 text-surface-600 px-1.5 py-0.5 rounded">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-surface-500 truncate">
                            {contact.title} · {contact.email}
                          </p>
                        </div>
                        {isSelected && selectedContactId === contact.id && (
                          <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Generated email with AI metadata
interface GeneratedEmailData {
  prospectId: string;
  contactId: string;
  sequenceNumber: number;
  subject: string;
  body: string;
  personalizationUsed: Array<{
    type: string;
    source: string;
    text: string;
  }>;
  qualityScore: number;
  spamRiskScore: number;
}

function EmailsStep({
  formData,
  setFormData,
  clientId,
  prospects,
}: {
  formData: CampaignFormData;
  setFormData: (data: CampaignFormData) => void;
  clientId: string;
  prospects: ProspectWithContacts[];
}) {
  const [activeEmail, setActiveEmail] = useState(0);
  const [generationMode, setGenerationMode] = useState<'template' | 'personalized'>('template');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmailData[]>([]);
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [generationStats, setGenerationStats] = useState<{
    totalGenerated: number;
    averageQualityScore: number;
    averageSpamRisk: number;
    generationTimeMs: number;
  } | null>(null);

  // Get selected prospects with contacts
  const selectedProspects = prospects.filter((p) =>
    formData.prospectIds.includes(p.id)
  );

  // Calculate placeholder availability across all selected prospects
  const placeholderAvailability = useMemo(() => {
    if (selectedProspects.length === 0) {
      return [];
    }

    // Define all placeholders and how to extract their values
    const placeholders = [
      {
        key: '{first_name}',
        label: 'First Name',
        extractor: (prospect: ProspectWithContacts) => {
          const contactId = formData.contactSelections[prospect.id];
          const contact = prospect.contacts?.find(c => c.id === contactId) || prospect.contacts?.[0];
          const name = contact?.name?.split(' ')[0];
          return name;
        },
      },
      {
        key: '{company}',
        label: 'Company',
        extractor: (prospect: ProspectWithContacts) => prospect.companyName,
      },
      {
        key: '{title}',
        label: 'Job Title',
        extractor: (prospect: ProspectWithContacts) => {
          const contactId = formData.contactSelections[prospect.id];
          const contact = prospect.contacts?.find(c => c.id === contactId) || prospect.contacts?.[0];
          return contact?.title;
        },
      },
      {
        key: '{industry}',
        label: 'Industry',
        extractor: (prospect: ProspectWithContacts) => prospect.industry,
      },
    ];

    return placeholders.map(p => {
      let validCount = 0;
      const invalidProspects: string[] = [];

      selectedProspects.forEach(prospect => {
        const value = p.extractor(prospect);
        if (isValidValue(value)) {
          validCount++;
        } else {
          invalidProspects.push(prospect.companyName);
        }
      });

      const total = selectedProspects.length;
      const availability: 'all' | 'partial' | 'none' =
        validCount === total ? 'all' :
        validCount > 0 ? 'partial' : 'none';

      return {
        key: p.key,
        label: p.label,
        validCount,
        total,
        availability,
        invalidProspects: invalidProspects.slice(0, 3), // Show max 3 for tooltip
        moreInvalid: invalidProspects.length > 3 ? invalidProspects.length - 3 : 0,
      };
    });
  }, [selectedProspects, formData.contactSelections]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      // Build per-template instructions array
      const templateInstructions = formData.emailTemplates.map((t, i) => ({
        sequenceNumber: i + 1,
        instructions: t.customInstructions || '',
      })).filter(t => t.instructions);

      const params: {
        clientId: string;
        mode: 'template' | 'personalized';
        prospects?: Array<{ prospectId: string; contactId: string }>;
        sequenceCount: number;
        generalInstructions?: string;
        templateInstructions?: Array<{ sequenceNumber: number; instructions: string }>;
      } = {
        clientId,
        mode: generationMode,
        sequenceCount: formData.emailTemplates.length,
        generalInstructions: generalInstructions || undefined,
        templateInstructions: templateInstructions.length > 0 ? templateInstructions : undefined,
      };

      if (generationMode === 'personalized') {
        params.prospects = selectedProspects.map((p) => ({
          prospectId: p.id,
          contactId: formData.contactSelections[p.id] || p.contacts?.[0]?.id || '',
        }));
      }

      return campaignsApi.generateAIEmails(params);
    },
    onSuccess: (response) => {
      const result = response as {
        data: {
          mode: string;
          templates?: Array<{
            sequenceNumber: number;
            subject: string;
            body: string;
            delayDays: number;
          }>;
          emails?: GeneratedEmailData[];
          stats: {
            totalGenerated: number;
            averageQualityScore: number;
            averageSpamRisk: number;
            generationTimeMs: number;
          };
        };
      };

      if (result.data.mode === 'template' && result.data.templates) {
        // Apply templates to form data
        const newTemplates = result.data.templates.map((t) => ({
          sequence: t.sequenceNumber,
          subject: t.subject,
          body: t.body,
          delayDays: t.delayDays,
        }));
        setFormData({ ...formData, emailTemplates: newTemplates });
      } else if (result.data.mode === 'personalized' && result.data.emails) {
        setGeneratedEmails(result.data.emails);
        // Also update templates with first prospect's emails
        const firstProspectEmails = result.data.emails.filter(
          (e) => e.prospectId === selectedProspects[0]?.id
        );
        if (firstProspectEmails.length > 0) {
          const newTemplates = firstProspectEmails.map((e) => ({
            sequence: e.sequenceNumber,
            subject: e.subject,
            body: e.body,
            delayDays: e.sequenceNumber === 1 ? 0 : e.sequenceNumber === 2 ? 3 : 7,
          }));
          setFormData({ ...formData, emailTemplates: newTemplates });
        }
      }

      setGenerationStats(result.data.stats);
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error('Email generation failed:', error);
      setIsGenerating(false);
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const updateEmail = (
    index: number,
    field: 'subject' | 'body' | 'delayDays' | 'customInstructions',
    value: string | number
  ) => {
    const newTemplates = [...formData.emailTemplates];
    newTemplates[index] = { ...newTemplates[index], [field]: value };
    setFormData({ ...formData, emailTemplates: newTemplates });
  };

  const addEmail = () => {
    const lastEmail = formData.emailTemplates[formData.emailTemplates.length - 1];
    setFormData({
      ...formData,
      emailTemplates: [
        ...formData.emailTemplates,
        {
          sequence: formData.emailTemplates.length + 1,
          subject: '',
          body: '',
          delayDays: lastEmail.delayDays + 4,
          customInstructions: '',
        },
      ],
    });
    setActiveEmail(formData.emailTemplates.length);
  };

  const removeEmail = (index: number) => {
    if (formData.emailTemplates.length <= 1) return;
    const newTemplates = formData.emailTemplates.filter((_, i) => i !== index);
    setFormData({ ...formData, emailTemplates: newTemplates });
    setActiveEmail(Math.min(activeEmail, newTemplates.length - 1));
  };

  // Get personalization info for current email if in personalized mode
  const currentGeneratedEmail = generatedEmails.find(
    (e) => e.sequenceNumber === activeEmail + 1 && e.prospectId === selectedProspects[0]?.id
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">
          Email Sequence
        </h3>

        {/* Generation stats badge */}
        {generationStats && (
          <div className="flex items-center gap-3 text-xs">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
              Quality: {generationStats.averageQualityScore}%
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
              Spam Risk: {generationStats.averageSpamRisk}%
            </span>
            <span className="text-surface-500">
              Generated in {(generationStats.generationTimeMs / 1000).toFixed(1)}s
            </span>
          </div>
        )}
      </div>

      {/* AI Generation Panel */}
      <div className="border border-primary-200 bg-primary-50 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary-600" />
            <span className="font-medium text-primary-900">AI Email Generation</span>
          </div>
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-primary-600 hover:text-primary-800"
          >
            {showInstructions ? 'Hide' : 'Show'} Custom Instructions
          </button>
        </div>

        {/* Mode selection */}
        <div className="flex gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="generationMode"
              checked={generationMode === 'template'}
              onChange={() => setGenerationMode('template')}
              className="text-primary-600"
            />
            <span className="text-sm text-surface-700">
              Template Mode
              <span className="text-xs text-surface-500 ml-1">
                (Generate templates with placeholders)
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="generationMode"
              checked={generationMode === 'personalized'}
              onChange={() => setGenerationMode('personalized')}
              className="text-primary-600"
            />
            <span className="text-sm text-surface-700">
              Personalized Mode
              <span className="text-xs text-surface-500 ml-1">
                (Generate unique emails per prospect)
              </span>
            </span>
          </label>
        </div>

        {/* General instructions (apply to all emails) */}
        {showInstructions && (
          <div className="space-y-2">
            <label className="label text-sm flex items-center gap-2">
              General Instructions
              <span className="text-xs font-normal text-surface-500">(applies to all emails)</span>
            </label>
            <textarea
              value={generalInstructions}
              onChange={(e) => setGeneralInstructions(e.target.value)}
              placeholder="e.g., Focus on cost savings, mention our recent case study with TechCorp, use a more casual tone..."
              rows={2}
              className="input text-sm"
            />
            <p className="text-xs text-surface-500">
              You can also add specific instructions per email template below in the email editor.
            </p>
          </div>
        )}

        {/* Selected prospects info for personalized mode */}
        {generationMode === 'personalized' && (
          <div className="text-sm text-surface-600">
            Will generate {formData.emailTemplates.length} emails each for{' '}
            <strong>{selectedProspects.length}</strong> prospects
            ({selectedProspects.length * formData.emailTemplates.length} total emails)
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (generationMode === 'personalized' && selectedProspects.length === 0)}
          className={clsx(
            'btn w-full flex items-center justify-center gap-2',
            isGenerating
              ? 'bg-surface-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Emails...
            </>
          ) : (
            <>
              <Mail className="w-4 h-4" />
              Generate with AI
            </>
          )}
        </button>
      </div>

      {/* Email tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {formData.emailTemplates.map((email, index) => (
          <button
            key={index}
            onClick={() => setActiveEmail(index)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-colors',
              activeEmail === index
                ? 'bg-primary-100 text-primary-700'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            )}
          >
            Email {index + 1}
            {index === 0 ? ' (Initial)' : ` (Day ${email.delayDays})`}
          </button>
        ))}
        <button
          onClick={addEmail}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add Email
        </button>
      </div>

      {/* Active email editor */}
      <div className="border border-surface-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-surface-900">
            Email {activeEmail + 1}
          </h4>
          <div className="flex items-center gap-2">
            {currentGeneratedEmail && (
              <div className="flex items-center gap-2 text-xs">
                <span className={clsx(
                  'px-2 py-1 rounded',
                  currentGeneratedEmail.qualityScore >= 80 ? 'bg-green-100 text-green-700' :
                  currentGeneratedEmail.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                )}>
                  Quality: {currentGeneratedEmail.qualityScore}%
                </span>
                <span className={clsx(
                  'px-2 py-1 rounded',
                  currentGeneratedEmail.spamRiskScore <= 15 ? 'bg-green-100 text-green-700' :
                  currentGeneratedEmail.spamRiskScore <= 30 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                )}>
                  Spam: {currentGeneratedEmail.spamRiskScore}%
                </span>
              </div>
            )}
            {formData.emailTemplates.length > 1 && (
              <button
                onClick={() => removeEmail(activeEmail)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Personalization used */}
        {currentGeneratedEmail && currentGeneratedEmail.personalizationUsed.length > 0 && (
          <div className="bg-surface-50 rounded-lg p-3 space-y-2">
            <h5 className="text-xs font-medium text-surface-600 uppercase tracking-wide">
              Personalization Used
            </h5>
            <div className="flex flex-wrap gap-2">
              {currentGeneratedEmail.personalizationUsed.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-surface-200 rounded text-xs"
                  title={p.text}
                >
                  <span className={clsx(
                    'w-2 h-2 rounded-full',
                    p.type === 'recent_news' ? 'bg-blue-500' :
                    p.type === 'funding_event' ? 'bg-green-500' :
                    p.type === 'role_based' ? 'bg-purple-500' :
                    p.type === 'pain_point' ? 'bg-red-500' :
                    p.type === 'company_specific' ? 'bg-orange-500' :
                    'bg-surface-400'
                  )} />
                  {p.type.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {activeEmail > 0 && (
          <div>
            <label className="label">Send After (Days)</label>
            <input
              type="number"
              min={1}
              value={formData.emailTemplates[activeEmail].delayDays}
              onChange={(e) =>
                updateEmail(activeEmail, 'delayDays', parseInt(e.target.value))
              }
              className="input w-24"
            />
          </div>
        )}

        {/* Available Placeholders with Real-time Availability */}
        {generationMode === 'template' && (
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-surface-50 px-3 py-2 border-b border-surface-200">
              <h5 className="font-medium text-surface-800 text-sm flex items-center gap-2">
                Placeholder Availability
                <span className="text-xs font-normal text-surface-500">
                  (for {selectedProspects.length} selected prospect{selectedProspects.length !== 1 ? 's' : ''})
                </span>
              </h5>
            </div>
            <div className="p-3 space-y-2">
              {placeholderAvailability.length === 0 ? (
                <p className="text-sm text-surface-500 italic">Select prospects to see placeholder availability</p>
              ) : (
                placeholderAvailability.map((p) => (
                  <div key={p.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'w-2 h-2 rounded-full',
                        p.availability === 'all' ? 'bg-green-500' :
                        p.availability === 'partial' ? 'bg-amber-500' : 'bg-red-500'
                      )} />
                      <code className={clsx(
                        'px-1.5 py-0.5 rounded text-xs font-mono',
                        p.availability === 'all' ? 'bg-green-100 text-green-700' :
                        p.availability === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      )}>
                        {p.key}
                      </code>
                      <span className="text-sm text-surface-600">{p.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full',
                        p.availability === 'all' ? 'bg-green-100 text-green-700' :
                        p.availability === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      )}>
                        {p.validCount}/{p.total}
                      </span>
                      {p.availability !== 'all' && p.invalidProspects.length > 0 && (
                        <span
                          className="text-xs text-surface-400 cursor-help"
                          title={`Missing for: ${p.invalidProspects.join(', ')}${p.moreInvalid > 0 ? ` +${p.moreInvalid} more` : ''}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {placeholderAvailability.some(p => p.availability !== 'all') && (
              <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
                <strong>Tip:</strong> Placeholders with partial availability will use fallback text for prospects missing data.
                You can fix missing values in the Review step.
              </div>
            )}
          </div>
        )}

        <div>
          <label className="label">Subject Line</label>
          <input
            type="text"
            value={formData.emailTemplates[activeEmail].subject}
            onChange={(e) => updateEmail(activeEmail, 'subject', e.target.value)}
            placeholder="Quick question for {first_name}"
            className="input"
          />
          <p className="mt-1 text-xs text-surface-500">
            Use placeholders like {'{first_name}'}, {'{company}'} for personalization
          </p>
        </div>

        <div>
          <label className="label">Email Body</label>
          <textarea
            value={formData.emailTemplates[activeEmail].body}
            onChange={(e) => updateEmail(activeEmail, 'body', e.target.value)}
            placeholder="Hi {first_name},&#10;&#10;I noticed that {company}..."
            rows={10}
            className="input font-mono text-sm"
          />
        </div>

        {/* Per-template AI Instructions */}
        <div className="border-t border-surface-200 pt-4 mt-4">
          <label className="label text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-surface-500" />
            Email {activeEmail + 1} Specific Instructions
            <span className="text-xs font-normal text-surface-500">(optional)</span>
          </label>
          <textarea
            value={formData.emailTemplates[activeEmail].customInstructions || ''}
            onChange={(e) => updateEmail(activeEmail, 'customInstructions', e.target.value)}
            placeholder={
              activeEmail === 0
                ? "e.g., Make the opening hook stronger, focus on their recent growth"
                : activeEmail === 1
                ? "e.g., Reference the initial email, add urgency"
                : "e.g., Keep it very short, offer one final value point"
            }
            rows={2}
            className="input text-sm"
          />
        </div>
      </div>

      {/* Generated emails preview for personalized mode */}
      {generationMode === 'personalized' && generatedEmails.length > 0 && (
        <div className="border border-surface-200 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-surface-900">
            Generated Emails Preview ({generatedEmails.length} emails for {selectedProspects.length} prospects)
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {selectedProspects.slice(0, 5).map((prospect) => {
              const prospectEmails = generatedEmails.filter((e) => e.prospectId === prospect.id);
              return (
                <div key={prospect.id} className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
                  <div>
                    <span className="font-medium text-surface-800">{prospect.companyName}</span>
                    <span className="text-xs text-surface-500 ml-2">
                      {prospectEmails.length} emails generated
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {prospectEmails.length > 0 && (
                      <span className={clsx(
                        'text-xs px-2 py-1 rounded',
                        prospectEmails[0].qualityScore >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      )}>
                        Avg Quality: {Math.round(prospectEmails.reduce((sum, e) => sum + e.qualityScore, 0) / prospectEmails.length)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {selectedProspects.length > 5 && (
              <p className="text-xs text-surface-500 italic">
                +{selectedProspects.length - 5} more prospects...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsStep({
  formData,
  setFormData,
}: {
  formData: CampaignFormData;
  setFormData: (data: CampaignFormData) => void;
}) {
  const updateSettings = (field: keyof typeof formData.settings, value: unknown) => {
    setFormData({
      ...formData,
      settings: { ...formData.settings, [field]: value },
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-surface-900">
        Campaign Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="label">Daily Send Limit</label>
          <input
            type="number"
            min={1}
            max={500}
            value={formData.settings.dailySendLimit}
            onChange={(e) =>
              updateSettings('dailySendLimit', parseInt(e.target.value))
            }
            className="input"
          />
          <p className="mt-1 text-xs text-surface-500">
            Maximum emails to send per day
          </p>
        </div>

        <div>
          <label className="label">Timezone</label>
          <select
            value={formData.settings.timezone}
            onChange={(e) => updateSettings('timezone', e.target.value)}
            className="input"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Send Window Start</label>
          <input
            type="time"
            value={formData.settings.sendWindowStart}
            onChange={(e) => updateSettings('sendWindowStart', e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Send Window End</label>
          <input
            type="time"
            value={formData.settings.sendWindowEnd}
            onChange={(e) => updateSettings('sendWindowEnd', e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="skipWeekends"
          checked={formData.settings.skipWeekends}
          onChange={(e) => updateSettings('skipWeekends', e.target.checked)}
          className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
        />
        <label htmlFor="skipWeekends" className="text-sm text-surface-700">
          Skip weekends (recommended for B2B outreach)
        </label>
      </div>
    </div>
  );
}

// Validation result types
interface PlaceholderValidation {
  placeholder: string;
  label: string;
  status: 'available' | 'fallback' | 'missing';
  actualValue: string | null;
  fallbackValue: string;
}

interface ProspectValidation {
  prospectId: string;
  prospectName: string;
  contactId?: string;
  contactName?: string;
  placeholders: PlaceholderValidation[];
  summary: {
    total: number;
    available: number;
    fallback: number;
    missing: number;
  };
  isFullyPopulated: boolean;
  hasAnyFallbacks: boolean;
}

interface ValidationResult {
  placeholdersUsed: string[];
  prospectValidations: ProspectValidation[];
  summary: {
    totalProspects: number;
    fullyPopulated: number;
    withFallbacks: number;
    withMissing: number;
  };
}

// Field overrides: { prospectId: { placeholder: value } }
type FieldOverrides = Record<string, Record<string, string>>;

function ReviewStep({
  formData,
  setFormData,
  prospects,
  onValidationChange,
}: {
  formData: CampaignFormData;
  setFormData: (data: CampaignFormData) => void;
  prospects: ProspectWithContacts[];
  onValidationChange: (isValid: boolean) => void;
}) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [expandedProspect, setExpandedProspect] = useState<string | null>(null);
  const [previewProspect, setPreviewProspect] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<number | null>(null);
  const [fieldOverrides, setFieldOverrides] = useState<FieldOverrides>({});

  const selectedProspects = prospects.filter((p) =>
    formData.prospectIds.includes(p.id)
  );

  // Update a field override for a prospect
  const updateFieldOverride = (prospectId: string, placeholder: string, value: string) => {
    setFieldOverrides(prev => ({
      ...prev,
      [prospectId]: {
        ...prev[prospectId],
        [placeholder]: value,
      },
    }));
  };

  // Run validation when component mounts or templates change
  useEffect(() => {
    if (formData.emailTemplates.length > 0 && selectedProspects.length > 0) {
      runValidation();
    }
  }, [formData.emailTemplates, formData.prospectIds, formData.contactSelections]);

  // Recalculate validation state when validation or overrides change
  useEffect(() => {
    if (!validation) {
      onValidationChange(true); // No validation yet, allow proceed
      return;
    }

    let allValid = true;
    validation.prospectValidations.forEach(pv => {
      const prospectOverrides = fieldOverrides[pv.prospectId] || {};

      pv.placeholders.forEach(p => {
        const hasValidOverride = prospectOverrides[p.placeholder] &&
          isValidValue(prospectOverrides[p.placeholder]);
        const originalIsInvalid = !isValidValue(p.actualValue);

        if (originalIsInvalid && !hasValidOverride) {
          allValid = false;
        }
      });
    });

    onValidationChange(allValid);
  }, [validation, fieldOverrides, onValidationChange]);

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const response = await campaignsApi.validatePlaceholders({
        templates: formData.emailTemplates.map(t => ({
          subject: t.subject,
          body: t.body,
        })),
        prospects: selectedProspects.map(p => ({
          prospectId: p.id,
          contactId: formData.contactSelections[p.id],
        })),
      });
      setValidation((response as { data: ValidationResult }).data);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  // Get contact for a prospect
  const getSelectedContact = (prospect: ProspectWithContacts) => {
    const contactId = formData.contactSelections[prospect.id];
    return prospect.contacts?.find((c) => c.id === contactId) || prospect.contacts?.[0];
  };

  // Replace placeholders in content for preview
  const renderPreview = (content: string, prospect: ProspectWithContacts) => {
    const contact = getSelectedContact(prospect);
    const overrides = fieldOverrides[prospect.id] || {};

    // Helper to get value considering overrides and validity
    const getValue = (original: string | undefined | null, fallback: string, placeholder: string) => {
      // Check for override first
      if (overrides[placeholder] && isValidValue(overrides[placeholder])) {
        return overrides[placeholder];
      }
      // Then check if original is valid
      if (original && isValidValue(original)) {
        return original;
      }
      // Return fallback (will be highlighted in preview)
      return fallback;
    };

    const firstName = contact?.name?.split(' ')[0];
    const replacements: Record<string, string> = {
      '{first_name}': getValue(firstName, '[first name]', '{first_name}'),
      '{full_name}': getValue(contact?.name, '[name]', '{full_name}'),
      '{company_name}': getValue(prospect.companyName, '[company]', '{company_name}'),
      '{company}': getValue(prospect.companyName, '[company]', '{company}'),
      '{title}': getValue(contact?.title, '[title]', '{title}'),
      '{industry}': getValue(prospect.industry, '[industry]', '{industry}'),
      '{city}': getValue(undefined, '[city]', '{city}'),
      '{state}': getValue(undefined, '', '{state}'),
    };

    let result = content;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    return result;
  };

  // Update email template
  const updateEmail = (index: number, field: 'subject' | 'body', value: string) => {
    const newTemplates = [...formData.emailTemplates];
    newTemplates[index] = { ...newTemplates[index], [field]: value };
    setFormData({ ...formData, emailTemplates: newTemplates });
  };

  // Get status color
  const getStatusColor = (status: 'available' | 'fallback' | 'missing') => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-50';
      case 'fallback': return 'text-amber-600 bg-amber-50';
      case 'missing': return 'text-red-600 bg-red-50';
    }
  };

  const getStatusIcon = (status: 'available' | 'fallback' | 'missing') => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4" />;
      case 'fallback': return <AlertTriangle className="w-4 h-4" />;
      case 'missing': return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-surface-900">
        Review Campaign
      </h3>

      {/* Validation Summary */}
      {isValidating ? (
        <div className="bg-surface-50 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
          <span className="text-surface-600">Validating email data for all prospects...</span>
        </div>
      ) : validation && (
        <div className="bg-surface-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-surface-900">Data Completeness Check</h4>
            <button
              onClick={runValidation}
              className="text-xs text-primary-600 hover:text-primary-800"
            >
              Re-validate
            </button>
          </div>

          {/* Placeholders used */}
          <div className="text-sm text-surface-600">
            <span className="font-medium">Placeholders used:</span>{' '}
            {validation.placeholdersUsed.map((p) => (
              <code key={p} className="px-1.5 py-0.5 bg-surface-200 rounded text-xs mx-0.5">
                {p}
              </code>
            ))}
          </div>

          {/* Summary stats - recalculated with overrides */}
          {(() => {
            let completeCount = 0;
            let invalidCount = 0;

            validation.prospectValidations.forEach(pv => {
              const prospectOverrides = fieldOverrides[pv.prospectId] || {};
              let hasInvalidField = false;

              pv.placeholders.forEach(p => {
                const hasValidOverride = prospectOverrides[p.placeholder] &&
                  isValidValue(prospectOverrides[p.placeholder]);
                const originalIsInvalid = !isValidValue(p.actualValue);

                if (originalIsInvalid && !hasValidOverride) {
                  hasInvalidField = true;
                }
              });

              if (hasInvalidField) {
                invalidCount++;
              } else {
                completeCount++;
              }
            });

            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{completeCount}</div>
                    <div className="text-xs text-green-700">Ready to Send</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{invalidCount}</div>
                    <div className="text-xs text-red-700">Needs Attention</div>
                  </div>
                </div>

                {invalidCount > 0 && (
                  <div className="text-xs text-red-700 bg-red-50 p-2 rounded flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {invalidCount} prospect(s) have invalid values (like "Unknown") that need to be fixed before sending.
                    Expand each prospect below to fix the values.
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Prospect List with Validation Details */}
      <div className="border border-surface-200 rounded-lg overflow-hidden">
        <div className="bg-surface-50 px-4 py-2 border-b border-surface-200 flex items-center justify-between">
          <h4 className="font-medium text-surface-900">Prospects ({selectedProspects.length})</h4>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-surface-100">
          {selectedProspects.map((prospect) => {
            const prospectValidation = validation?.prospectValidations.find(v => v.prospectId === prospect.id);
            const contact = getSelectedContact(prospect);
            const isExpanded = expandedProspect === prospect.id;
            const isPreviewing = previewProspect === prospect.id;

            return (
              <div key={prospect.id} className="bg-white">
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedProspect(isExpanded ? null : prospect.id)}
                      className="text-surface-400 hover:text-surface-600"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="font-medium text-surface-900">{prospect.companyName}</div>
                      <div className="text-xs text-surface-500">
                        {contact?.name} • {contact?.email || 'No email'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status badge - considering overrides and invalid values */}
                    {prospectValidation && (() => {
                      // Count issues considering overrides
                      const prospectOverrides = fieldOverrides[prospect.id] || {};
                      let invalidCount = 0;
                      let fixedCount = 0;

                      prospectValidation.placeholders.forEach(p => {
                        const hasValidOverride = prospectOverrides[p.placeholder] &&
                          isValidValue(prospectOverrides[p.placeholder]);
                        const originalIsInvalid = !isValidValue(p.actualValue);

                        if (originalIsInvalid && !hasValidOverride) {
                          invalidCount++;
                        } else if (originalIsInvalid && hasValidOverride) {
                          fixedCount++;
                        }
                      });

                      const isComplete = invalidCount === 0;
                      const hasPartialFixes = fixedCount > 0;

                      return (
                        <span className={clsx(
                          'px-2 py-1 rounded-full text-xs flex items-center gap-1',
                          isComplete
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        )}>
                          {isComplete ? (
                            <><CheckCircle className="w-3 h-3" /> Complete{hasPartialFixes ? ' (fixed)' : ''}</>
                          ) : (
                            <><AlertCircle className="w-3 h-3" /> {invalidCount} invalid</>
                          )}
                        </span>
                      );
                    })()}
                    {/* Preview button */}
                    <button
                      onClick={() => setPreviewProspect(isPreviewing ? null : prospect.id)}
                      className={clsx(
                        'px-2 py-1 rounded text-xs flex items-center gap-1',
                        isPreviewing ? 'bg-primary-100 text-primary-700' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                      )}
                    >
                      <Eye className="w-3 h-3" />
                      Preview
                    </button>
                  </div>
                </div>

                {/* Expanded validation details */}
                {isExpanded && prospectValidation && (
                  <div className="px-4 pb-3 pl-12">
                    <div className="bg-surface-50 rounded p-3 space-y-3">
                      <div className="text-xs font-medium text-surface-500 uppercase">Placeholder Values</div>
                      <div className="space-y-2">
                        {prospectValidation.placeholders.map((p) => {
                          const actualValue = p.actualValue;
                          const hasOverride = !!fieldOverrides[prospect.id]?.[p.placeholder];
                          const overrideValue = fieldOverrides[prospect.id]?.[p.placeholder] || '';

                          // Value is invalid if it's missing OR if it's a placeholder-like value
                          const valueIsInvalid = !isValidValue(actualValue);
                          const hasValidOverride = hasOverride && isValidValue(overrideValue);

                          // Determine effective status
                          const effectiveStatus: 'available' | 'fallback' | 'missing' =
                            hasValidOverride ? 'available' :
                            valueIsInvalid ? (p.status === 'missing' ? 'missing' : 'fallback') :
                            'available';

                          return (
                            <div key={p.placeholder} className="flex items-start gap-2 text-sm">
                              <span className={clsx('p-1 rounded flex-shrink-0 mt-0.5', getStatusColor(effectiveStatus))}>
                                {getStatusIcon(effectiveStatus)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-surface-600 font-medium">{p.label}:</span>
                                  {!valueIsInvalid && !hasOverride ? (
                                    <span className="text-surface-900 font-medium truncate">
                                      {actualValue}
                                    </span>
                                  ) : (
                                    <span className={clsx(
                                      'text-xs px-1.5 py-0.5 rounded',
                                      valueIsInvalid && !hasValidOverride ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                    )}>
                                      {valueIsInvalid && !hasValidOverride ? 'Needs value' : 'Fixed'}
                                    </span>
                                  )}
                                </div>

                                {/* Show input for invalid/missing values */}
                                {valueIsInvalid && (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={overrideValue}
                                      onChange={(e) => updateFieldOverride(prospect.id, p.placeholder, e.target.value)}
                                      placeholder={`Enter ${p.label.toLowerCase()}...`}
                                      className={clsx(
                                        'flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1',
                                        hasValidOverride
                                          ? 'border-green-300 focus:ring-green-500 bg-green-50'
                                          : 'border-amber-300 focus:ring-amber-500 bg-white'
                                      )}
                                    />
                                    {actualValue && (
                                      <span className="text-xs text-surface-400 italic" title="Original value">
                                        was: "{actualValue}"
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Show count of remaining issues */}
                      {(() => {
                        const invalidCount = prospectValidation.placeholders.filter(p => {
                          const hasValidOverride = fieldOverrides[prospect.id]?.[p.placeholder] &&
                            isValidValue(fieldOverrides[prospect.id]?.[p.placeholder]);
                          return !isValidValue(p.actualValue) && !hasValidOverride;
                        }).length;

                        if (invalidCount > 0) {
                          return (
                            <div className="mt-2 p-2 bg-amber-100 rounded text-xs text-amber-800 flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {invalidCount} field(s) need values before emails can be sent
                            </div>
                          );
                        }
                        return (
                          <div className="mt-2 p-2 bg-green-100 rounded text-xs text-green-800 flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5" />
                            All fields have valid values
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Email preview for this prospect */}
                {isPreviewing && (
                  <div className="px-4 pb-3 pl-12">
                    <div className="border border-primary-200 rounded-lg overflow-hidden">
                      <div className="bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700">
                        Email Preview for {prospect.companyName}
                      </div>
                      <div className="divide-y divide-surface-100">
                        {formData.emailTemplates.map((template, idx) => (
                          <div key={idx} className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-surface-500">Email {idx + 1}</span>
                              <span className="text-xs text-surface-400">Day {template.delayDays}</span>
                            </div>
                            <div className="text-sm font-medium text-surface-900">
                              {renderPreview(template.subject, prospect)}
                            </div>
                            <div className="text-sm text-surface-600 whitespace-pre-wrap">
                              {renderPreview(template.body, prospect)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Email Templates (Editable) */}
      <div className="border border-surface-200 rounded-lg overflow-hidden">
        <div className="bg-surface-50 px-4 py-2 border-b border-surface-200 flex items-center justify-between">
          <h4 className="font-medium text-surface-900">Email Templates ({formData.emailTemplates.length})</h4>
          <span className="text-xs text-surface-500">Click to edit</span>
        </div>
        <div className="divide-y divide-surface-100">
          {formData.emailTemplates.map((template, idx) => (
            <div key={idx} className="bg-white">
              <div
                onClick={() => setEditingEmail(editingEmail === idx ? null : idx)}
                className="px-4 py-3 cursor-pointer hover:bg-surface-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-surface-900 text-sm">{template.subject || '(No subject)'}</div>
                    <div className="text-xs text-surface-500">
                      Day {template.delayDays} • {template.body.split(' ').length} words
                    </div>
                  </div>
                </div>
                <Edit3 className="w-4 h-4 text-surface-400" />
              </div>

              {editingEmail === idx && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-100 bg-surface-50">
                  <div className="pt-3">
                    <label className="label text-xs">Subject Line</label>
                    <input
                      type="text"
                      value={template.subject}
                      onChange={(e) => updateEmail(idx, 'subject', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Email Body</label>
                    <textarea
                      value={template.body}
                      onChange={(e) => updateEmail(idx, 'body', e.target.value)}
                      rows={8}
                      className="input text-sm font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Settings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h4 className="font-medium text-surface-900 mb-2">Daily Limit</h4>
          <p className="text-2xl font-bold text-primary-600">{formData.settings.dailySendLimit}</p>
          <p className="text-xs text-surface-500">emails per day</p>
        </div>
        <div className="card p-4">
          <h4 className="font-medium text-surface-900 mb-2">Send Window</h4>
          <p className="text-lg font-bold text-primary-600">
            {formData.settings.sendWindowStart} - {formData.settings.sendWindowEnd}
          </p>
          <p className="text-xs text-surface-500">{formData.settings.timezone}</p>
        </div>
        <div className="card p-4">
          <h4 className="font-medium text-surface-900 mb-2">Timeline</h4>
          <p className="text-2xl font-bold text-primary-600">
            ~{Math.ceil(selectedProspects.length / formData.settings.dailySendLimit)} days
          </p>
          <p className="text-xs text-surface-500">for first email round</p>
        </div>
      </div>
    </div>
  );
}

function EmailSettingsStatus({
  emailSettings,
  isLoading,
}: {
  emailSettings: EmailSettings | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="px-6 py-3 bg-surface-50 border-b border-surface-200">
        <div className="flex items-center gap-2 text-surface-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Checking email settings...</span>
        </div>
      </div>
    );
  }

  if (!emailSettings) {
    return (
      <div className="px-6 py-3 bg-red-50 border-b border-red-200">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">
            Email settings not configured.{' '}
            <a href="/settings" className="underline hover:text-red-800">
              Configure in Settings
            </a>
          </span>
        </div>
      </div>
    );
  }

  const hasSmtp = !!emailSettings.smtpConfig?.host;
  const hasImap = !!emailSettings.imapConfig?.host;

  return (
    <div className={clsx(
      'px-6 py-3 border-b',
      emailSettings.isActive
        ? 'bg-green-50 border-green-200'
        : 'bg-yellow-50 border-yellow-200'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {emailSettings.isActive ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-600" />
          )}
          <div className="text-sm">
            <span className={clsx(
              'font-medium',
              emailSettings.isActive ? 'text-green-700' : 'text-yellow-700'
            )}>
              {emailSettings.isActive ? 'Email Ready' : 'Email Inactive'}
            </span>
            <span className="text-surface-600 ml-2">
              Sending as: {emailSettings.fromName} &lt;{emailSettings.fromEmail}&gt;
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-surface-500">
          <span className={clsx(
            'px-2 py-1 rounded',
            hasSmtp ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-500'
          )}>
            SMTP: {hasSmtp ? emailSettings.smtpConfig?.host : 'Not configured'}
          </span>
          <span className={clsx(
            'px-2 py-1 rounded',
            hasImap ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-500'
          )}>
            IMAP: {hasImap ? emailSettings.imapConfig?.host : 'Not configured'}
          </span>
        </div>
      </div>
    </div>
  );
}
