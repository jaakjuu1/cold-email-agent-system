import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Zap,
  Globe,
  Target,
  CheckCircle,
  ArrowRight,
  Loader2,
  Building2,
  MapPin,
  Users,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { clientsApi } from '../lib/api';
import { useAppStore } from '../store';
import { useDiscoveryProgress } from '../hooks/useWebSocket';

interface ICPData {
  icpSummary: string;
  firmographicCriteria: {
    companySize: {
      employeeRanges: string[];
      revenueRanges: string[];
    };
    companyStage: string[];
  };
  geographicTargeting: {
    primaryMarkets: Array<{
      city: string;
      state: string;
      country: string;
      priority: string;
    }>;
  };
  industryTargeting: {
    primaryIndustries: Array<{
      name: string;
      subSegments: string[];
      priority: string;
    }>;
  };
  decisionMakerTargeting: {
    primaryTitles: string[];
    departments: string[];
  };
  messagingFramework: {
    primaryPainPointsToAddress: string[];
    valuePropositions: string[];
    proofPoints: string[];
  };
}

export function Onboarding() {
  const navigate = useNavigate();
  const setCurrentClient = useAppStore((state) => state.setCurrentClient);
  const [step, setStep] = useState(1);
  const [clientName, setClientName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [icpData, setIcpData] = useState<ICPData | null>(null);

  // Discovery progress hook
  const { progress, reset: resetProgress } = useDiscoveryProgress(clientId || undefined);

  // Phase display configuration
  const discoveryPhases = [
    {
      key: 'analyzing_website' as const,
      label: 'Analyzing website',
      description: 'Crawling and extracting business information',
    },
    {
      key: 'researching_market' as const,
      label: 'Researching market',
      description: 'Analyzing market position and competitors',
    },
    {
      key: 'generating_icp' as const,
      label: 'Generating ICP',
      description: 'Creating ideal customer profile',
    },
    {
      key: 'validating' as const,
      label: 'Validating',
      description: 'Ensuring data quality and completeness',
    },
  ];

  const createClientMutation = useMutation({
    mutationFn: (data: { name: string; website: string }) =>
      clientsApi.create(data),
    onSuccess: (response: { data: { id: string; name: string; website: string } }) => {
      setClientId(response.data.id);
      setStep(2);
      discoverMutation.mutate({
        id: response.data.id,
        websiteUrl: websiteUrl,
      });
    },
  });

  const discoverMutation = useMutation({
    mutationFn: (data: { id: string; websiteUrl: string }) =>
      clientsApi.discover(data.id, data.websiteUrl),
    onSuccess: (response: { data: ICPData }) => {
      setIcpData(response.data);
      setStep(3);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => clientsApi.approveICP(id),
    onSuccess: () => {
      if (clientId) {
        setCurrentClient({
          id: clientId,
          name: clientName,
          website: websiteUrl,
        });
      }
      navigate('/dashboard');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !websiteUrl) return;
    createClientMutation.mutate({ name: clientName, website: websiteUrl });
  };

  const handleApprove = () => {
    if (clientId) {
      approveMutation.mutate(clientId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-900 via-surface-800 to-primary-900">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      <div className="relative min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">Outreach</span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-2xl">
            {/* Progress steps */}
            <div className="flex items-center justify-center mb-12">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
                      step >= s
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface-700 text-surface-400'
                    }`}
                  >
                    {step > s ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      s
                    )}
                  </div>
                  {s < 3 && (
                    <div
                      className={`w-24 h-1 mx-2 rounded transition-all ${
                        step > s ? 'bg-primary-500' : 'bg-surface-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Enter website */}
            {step === 1 && (
              <div className="card p-8 animate-fade-in">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-surface-900">
                    Let&apos;s discover your business
                  </h1>
                  <p className="mt-2 text-surface-500">
                    Enter your company details and we&apos;ll analyze your business to
                    create the perfect outreach strategy.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="label">
                      Company Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Acme Inc"
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="website" className="label">
                      Website URL
                    </label>
                    <input
                      id="website"
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://yourcompany.com"
                      className="input"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={createClientMutation.isPending || !clientName || !websiteUrl}
                    className="btn-primary w-full py-3"
                  >
                    {createClientMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Analyze My Business
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Step 2: Analyzing with real-time progress */}
            {step === 2 && (
              <div className="card p-8 text-center animate-fade-in">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900 mb-2">
                  Analyzing your business...
                </h1>
                <p className="text-surface-500 mb-8">
                  {progress.message || 'Our AI is researching your company, market, and ideal customers.'}
                </p>

                <div className="space-y-3 text-left max-w-md mx-auto">
                  {discoveryPhases.map((phase) => {
                    const isCompleted = progress.completedPhases.includes(phase.key);
                    const isActive = progress.currentPhase === phase.key && progress.status !== 'completed';
                    const isFailed = progress.isFailed && progress.currentPhase === phase.key;
                    // Show sub-phase message if this phase is active and we have a message
                    const showSubPhase = isActive && progress.message && progress.status === 'in_progress';

                    return (
                      <div
                        key={phase.key}
                        className={`transition-opacity duration-300 ${
                          isCompleted || isActive ? 'opacity-100' : 'opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 text-sm">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                              isCompleted
                                ? 'bg-green-500'
                                : isFailed
                                ? 'bg-red-500'
                                : isActive
                                ? 'bg-primary-100'
                                : 'bg-surface-200'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4 text-white" />
                            ) : isFailed ? (
                              <XCircle className="w-4 h-4 text-white" />
                            ) : isActive ? (
                              <Loader2 className="w-3 h-3 text-primary-600 animate-spin" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-surface-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span
                              className={`font-medium ${
                                isCompleted
                                  ? 'text-green-600'
                                  : isFailed
                                  ? 'text-red-600'
                                  : isActive
                                  ? 'text-primary-600'
                                  : 'text-surface-500'
                              }`}
                            >
                              {phase.label}
                            </span>
                            {isActive && !showSubPhase && (
                              <p className="text-xs text-surface-400 mt-0.5">{phase.description}</p>
                            )}
                          </div>
                        </div>
                        {/* Sub-phase progress message */}
                        {showSubPhase && (
                          <div className="ml-9 mt-1.5 pl-3 border-l-2 border-primary-200">
                            <p className="text-xs text-surface-600 font-mono truncate">
                              {progress.message}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {progress.isFailed && (
                  <div className="mt-6 p-4 bg-red-50 rounded-lg text-red-700">
                    <p className="font-medium">Discovery failed</p>
                    <p className="text-sm mt-1">{progress.error}</p>
                    <button
                      onClick={() => {
                        resetProgress();
                        setStep(1);
                      }}
                      className="mt-3 btn-secondary text-sm"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review ICP */}
            {step === 3 && icpData && (
              <div className="space-y-6 animate-fade-in">
                <div className="card p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-surface-900">
                        Your Ideal Customer Profile
                      </h1>
                      <p className="mt-1 text-surface-500">
                        Review and approve your ICP to start finding prospects.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-primary-50 rounded-lg mb-6">
                    <p className="text-primary-800">{icpData.icpSummary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Company Size */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-5 h-5 text-surface-400" />
                        <h3 className="font-semibold text-surface-900">
                          Company Size
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {icpData.firmographicCriteria.companySize.employeeRanges.map(
                            (range) => (
                              <span key={range} className="badge-primary">
                                {range} employees
                              </span>
                            )
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {icpData.firmographicCriteria.companySize.revenueRanges.map(
                            (range) => (
                              <span key={range} className="badge-neutral">
                                {range}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Geographic Focus */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-5 h-5 text-surface-400" />
                        <h3 className="font-semibold text-surface-900">
                          Geographic Focus
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {icpData.geographicTargeting.primaryMarkets.map((market) => (
                          <span
                            key={`${market.city}-${market.state}`}
                            className={
                              market.priority === 'high'
                                ? 'badge-primary'
                                : 'badge-neutral'
                            }
                          >
                            {market.city}, {market.state}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Industries */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-5 h-5 text-surface-400" />
                        <h3 className="font-semibold text-surface-900">
                          Target Industries
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {icpData.industryTargeting.primaryIndustries.map(
                          (industry) => (
                            <span key={industry.name} className="badge-primary">
                              {industry.name}
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Decision Makers */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-5 h-5 text-surface-400" />
                        <h3 className="font-semibold text-surface-900">
                          Decision Makers
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {icpData.decisionMakerTargeting.primaryTitles.map(
                          (title) => (
                            <span key={title} className="badge-neutral">
                              {title}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messaging Framework */}
                <div className="card p-8">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-surface-400" />
                    <h3 className="font-semibold text-surface-900">
                      Messaging Framework
                    </h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-surface-500 mb-2">
                        Pain Points to Address
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {icpData.messagingFramework.primaryPainPointsToAddress.map(
                          (point) => (
                            <li key={point} className="text-surface-700">
                              {point}
                            </li>
                          )
                        )}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-surface-500 mb-2">
                        Value Propositions
                      </h4>
                      <ul className="list-disc list-inside space-y-1">
                        {icpData.messagingFramework.valuePropositions.map(
                          (prop) => (
                            <li key={prop} className="text-surface-700">
                              {prop}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  <button
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                    className="btn-primary flex-1 py-3"
                  >
                    {approveMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve & Continue
                      </>
                    )}
                  </button>
                  <button className="btn-secondary py-3">Refine ICP</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

