import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Building2,
  Users,
  UserSearch,
  TrendingUp,
  Loader2,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';

type DeepResearchPhase = 'company' | 'contacts' | 'contact_discovery' | 'market';

interface PhaseInfo {
  label: string;
  description: string;
  estimatedTime: string;
  icon: typeof Building2;
}

const PHASE_INFO: Record<DeepResearchPhase, PhaseInfo> = {
  company: {
    label: 'Company Research',
    description: 'Funding history, recent news, products/services, competitive positioning',
    estimatedTime: '2-4 min',
    icon: Building2,
  },
  contacts: {
    label: 'Contact Backgrounds',
    description: 'Career history and professional insights for existing contacts',
    estimatedTime: '1-2 min',
    icon: Users,
  },
  contact_discovery: {
    label: 'Find New Contacts',
    description: 'Discover decision makers, find email addresses and LinkedIn profiles',
    estimatedTime: '2-3 min',
    icon: UserSearch,
  },
  market: {
    label: 'Market Intelligence',
    description: 'Industry trends, market size, common pain points, buying signals',
    estimatedTime: '2-3 min',
    icon: TrendingUp,
  },
};

interface DeepResearchConfig {
  phases: DeepResearchPhase[];
  depth: number;
  breadth: number;
  focus: 'sales' | 'general' | 'technical';
}

interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: DeepResearchConfig) => void;
  isLoading: boolean;
  prospectName: string;
  hasExistingContacts: boolean;
}

export function DeepResearchModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  prospectName,
  hasExistingContacts,
}: DeepResearchModalProps) {
  const [selectedPhases, setSelectedPhases] = useState<Set<DeepResearchPhase>>(
    new Set(['company', 'contacts', 'contact_discovery', 'market'])
  );
  const [depth, setDepth] = useState(2);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset state when modal opens to ensure fresh selection each time
  useEffect(() => {
    if (isOpen) {
      setSelectedPhases(new Set(['company', 'contacts', 'contact_discovery', 'market']));
      setDepth(2);
      setShowAdvanced(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const togglePhase = (phase: DeepResearchPhase) => {
    const newSet = new Set(selectedPhases);
    if (newSet.has(phase)) {
      newSet.delete(phase);
    } else {
      newSet.add(phase);
    }
    setSelectedPhases(newSet);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPhases.size === 0) return;

    onSubmit({
      phases: Array.from(selectedPhases),
      depth,
      breadth: 3,
      focus: 'sales',
    });
  };

  // Calculate estimated time
  const estimatedMinutes = Array.from(selectedPhases).reduce((total, phase) => {
    const timeStr = PHASE_INFO[phase].estimatedTime;
    const [min] = timeStr.split('-').map(s => parseInt(s));
    return total + min;
  }, 0);

  const estimatedMax = Array.from(selectedPhases).reduce((total, phase) => {
    const timeStr = PHASE_INFO[phase].estimatedTime;
    const parts = timeStr.split('-');
    const max = parseInt(parts[parts.length - 1]);
    return total + max;
  }, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="research-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-100 transition-colors"
          aria-label="Close modal"
          disabled={isLoading}
        >
          <X className="w-5 h-5 text-surface-400" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 id="research-modal-title" className="text-xl font-bold text-surface-900">
              Deep Research
            </h2>
            <p className="text-sm text-surface-500">
              Configure research for {prospectName}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Phase Selection */}
          <div>
            <label className="label mb-3">Select Research Phases</label>
            <div className="space-y-2">
              {(Object.keys(PHASE_INFO) as DeepResearchPhase[]).map((phase) => {
                const info = PHASE_INFO[phase];
                const Icon = info.icon;
                const isSelected = selectedPhases.has(phase);
                const isDisabled = phase === 'contacts' && !hasExistingContacts;

                return (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => !isDisabled && togglePhase(phase)}
                    disabled={isDisabled}
                    className={clsx(
                      'w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left',
                      isSelected && !isDisabled
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-surface-200 hover:border-surface-300',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div
                      className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        isSelected && !isDisabled ? 'bg-primary-500' : 'bg-surface-200'
                      )}
                    >
                      {isSelected && !isDisabled ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <Icon className={clsx('w-5 h-5', isDisabled ? 'text-surface-400' : 'text-surface-500')} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={clsx(
                          'font-medium',
                          isSelected && !isDisabled ? 'text-primary-700' : 'text-surface-900'
                        )}>
                          {info.label}
                        </p>
                        <span className="text-xs text-surface-400">{info.estimatedTime}</span>
                      </div>
                      <p className="text-sm text-surface-500 mt-0.5">{info.description}</p>
                      {isDisabled && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          No existing contacts to research
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 p-4 bg-surface-50 rounded-lg">
                <div>
                  <label htmlFor="depth" className="label">
                    Research Depth
                  </label>
                  <p className="text-xs text-surface-500 mb-2">
                    Higher depth means more follow-up questions and deeper research
                  </p>
                  <div className="flex items-center gap-4">
                    {[1, 2, 3].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDepth(d)}
                        className={clsx(
                          'px-4 py-2 rounded-lg font-medium transition-colors',
                          depth === d
                            ? 'bg-primary-500 text-white'
                            : 'bg-white border border-surface-200 text-surface-700 hover:border-surface-300'
                        )}
                      >
                        {d === 1 ? 'Quick' : d === 2 ? 'Standard' : 'Deep'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Estimated Time */}
          {selectedPhases.size > 0 && (
            <div className="flex items-center justify-between py-3 px-4 bg-surface-50 rounded-lg">
              <span className="text-sm text-surface-600">Estimated time:</span>
              <span className="font-medium text-surface-900">
                {estimatedMinutes}-{estimatedMax} minutes
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || selectedPhases.size === 0}
              className="btn-primary flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Research
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
