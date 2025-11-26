import { useState } from 'react';
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
} from 'lucide-react';
import { campaignsApi, prospectsApi } from '../../lib/api';
import { clsx } from 'clsx';

type Step = 'basics' | 'prospects' | 'emails' | 'settings' | 'review';

interface CampaignFormData {
  name: string;
  description: string;
  prospectIds: string[];
  emailTemplates: Array<{
    sequence: number;
    subject: string;
    body: string;
    delayDays: number;
  }>;
  settings: {
    dailySendLimit: number;
    sendWindowStart: string;
    sendWindowEnd: string;
    timezone: string;
    skipWeekends: boolean;
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
  const [step, setStep] = useState<Step>('basics');
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    prospectIds: [],
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

  const { data: prospectsData } = useQuery({
    queryKey: ['prospects', 'all'],
    queryFn: () => prospectsApi.list({ pageSize: 1000 }),
  });

  const prospects = prospectsData?.data?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: CampaignFormData) =>
      campaignsApi.create({
        clientId: 'default', // TODO: Get from context
        name: data.name,
        description: data.description,
        prospectIds: data.prospectIds,
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

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
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
            <EmailsStep formData={formData} setFormData={setFormData} />
          )}
          {step === 'settings' && (
            <SettingsStep formData={formData} setFormData={setFormData} />
          )}
          {step === 'review' && (
            <ReviewStep formData={formData} prospects={prospects} />
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
                disabled={createMutation.isPending}
                className="btn-primary"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
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
  prospects: Array<{ id: string; companyName: string; icpMatchScore: number }>;
}) {
  const [selectAll, setSelectAll] = useState(false);

  const toggleAll = () => {
    if (selectAll) {
      setFormData({ ...formData, prospectIds: [] });
    } else {
      setFormData({ ...formData, prospectIds: prospects.map((p) => p.id) });
    }
    setSelectAll(!selectAll);
  };

  const toggleProspect = (id: string) => {
    const newIds = formData.prospectIds.includes(id)
      ? formData.prospectIds.filter((pid) => pid !== id)
      : [...formData.prospectIds, id];
    setFormData({ ...formData, prospectIds: newIds });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-surface-900">
          Select Prospects
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-surface-500">
            {formData.prospectIds.length} selected
          </span>
          <button onClick={toggleAll} className="text-sm text-primary-600 hover:underline">
            {selectAll ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      <div className="border border-surface-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
        {prospects.length === 0 ? (
          <div className="p-8 text-center text-surface-500">
            No prospects available. Discover leads first.
          </div>
        ) : (
          prospects.map((prospect) => (
            <div
              key={prospect.id}
              onClick={() => toggleProspect(prospect.id)}
              className={clsx(
                'px-4 py-3 flex items-center gap-4 cursor-pointer border-b border-surface-100 last:border-b-0 hover:bg-surface-50',
                formData.prospectIds.includes(prospect.id) && 'bg-primary-50'
              )}
            >
              <input
                type="checkbox"
                checked={formData.prospectIds.includes(prospect.id)}
                onChange={() => toggleProspect(prospect.id)}
                className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <div className="flex-1">
                <p className="font-medium text-surface-900">
                  {prospect.companyName}
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
                    style={{ width: `${prospect.icpMatchScore * 100}%` }}
                  />
                </div>
                <span className="text-xs text-surface-500">
                  {Math.round(prospect.icpMatchScore * 100)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EmailsStep({
  formData,
  setFormData,
}: {
  formData: CampaignFormData;
  setFormData: (data: CampaignFormData) => void;
}) {
  const [activeEmail, setActiveEmail] = useState(0);

  const updateEmail = (
    index: number,
    field: 'subject' | 'body' | 'delayDays',
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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-surface-900">
        Email Sequence
      </h3>

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
          {formData.emailTemplates.length > 1 && (
            <button
              onClick={() => removeEmail(activeEmail)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

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

        <div>
          <label className="label">Subject Line</label>
          <input
            type="text"
            value={formData.emailTemplates[activeEmail].subject}
            onChange={(e) => updateEmail(activeEmail, 'subject', e.target.value)}
            placeholder="Quick question about {company_name}"
            className="input"
          />
          <p className="mt-1 text-xs text-surface-500">
            Use {'{first_name}'}, {'{company_name}'}, etc. for personalization
          </p>
        </div>

        <div>
          <label className="label">Email Body</label>
          <textarea
            value={formData.emailTemplates[activeEmail].body}
            onChange={(e) => updateEmail(activeEmail, 'body', e.target.value)}
            placeholder="Hi {first_name},&#10;&#10;I noticed that {company_name}..."
            rows={10}
            className="input font-mono text-sm"
          />
        </div>
      </div>
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

function ReviewStep({
  formData,
  prospects,
}: {
  formData: CampaignFormData;
  prospects: Array<{ id: string; companyName: string }>;
}) {
  const selectedProspects = prospects.filter((p) =>
    formData.prospectIds.includes(p.id)
  );

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-surface-900">
        Review Campaign
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h4 className="font-medium text-surface-900 mb-2">Campaign Details</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-surface-500">Name</dt>
              <dd className="font-medium">{formData.name}</dd>
            </div>
            {formData.description && (
              <div className="flex justify-between">
                <dt className="text-surface-500">Description</dt>
                <dd className="font-medium">{formData.description}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card p-4">
          <h4 className="font-medium text-surface-900 mb-2">Audience</h4>
          <p className="text-2xl font-bold text-primary-600">
            {selectedProspects.length}
          </p>
          <p className="text-sm text-surface-500">prospects selected</p>
        </div>

        <div className="card p-4">
          <h4 className="font-medium text-surface-900 mb-2">Email Sequence</h4>
          <p className="text-2xl font-bold text-primary-600">
            {formData.emailTemplates.length}
          </p>
          <p className="text-sm text-surface-500">emails in sequence</p>
        </div>

        <div className="card p-4">
          <h4 className="font-medium text-surface-900 mb-2">Settings</h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-surface-500">Daily Limit</dt>
              <dd>{formData.settings.dailySendLimit}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-500">Send Window</dt>
              <dd>
                {formData.settings.sendWindowStart} -{' '}
                {formData.settings.sendWindowEnd}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-500">Skip Weekends</dt>
              <dd>{formData.settings.skipWeekends ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-primary-50 rounded-lg p-4">
        <h4 className="font-medium text-primary-900 mb-2">
          Estimated Timeline
        </h4>
        <p className="text-sm text-primary-700">
          Based on your settings, this campaign will take approximately{' '}
          <strong>
            {Math.ceil(selectedProspects.length / formData.settings.dailySendLimit)}{' '}
            days
          </strong>{' '}
          to complete the first email to all prospects.
        </p>
      </div>
    </div>
  );
}

