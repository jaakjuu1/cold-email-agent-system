import { useState } from 'react';
import {
  X,
  Building2,
  MapPin,
  Users,
  ExternalLink,
  Mail,
  Phone,
  Copy,
  Check,
  Loader2,
  Search,
  Briefcase,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Newspaper,
  Target,
  GraduationCap,
  Globe,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { DeepResearchResult, ContactResearch, FundingRound, NewsItem } from '@cold-outreach/shared';
import { InlineStatusSelect } from './InlineStatusSelect';
import { safeGetHostname } from '../lib/url';

type ProspectStatus = 'new' | 'researched' | 'contacted' | 'responded' | 'converted' | 'rejected';

interface Contact {
  id: string;
  name: string;
  title: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

interface Prospect {
  id: string;
  companyName: string;
  website?: string;
  industry: string;
  subIndustry?: string;
  employeeCount?: string;
  description?: string;
  location: {
    city: string;
    state: string;
    country: string;
    address?: string;
  };
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  painPoints?: string[];
  technologies?: string[];
  contacts: Contact[];
  icpMatchScore: number;
  status: ProspectStatus;
}

interface ProspectDetailPanelProps {
  prospect: Prospect;
  deepResearch?: DeepResearchResult | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: ProspectStatus) => void;
  onDeepResearch: () => void;
  onDelete: () => void;
  isResearching?: boolean;
  isLoadingResearch?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-surface-100 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-surface-400" />
      )}
    </button>
  );
}

function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="border-b border-surface-100 pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-700 mb-3">
        {Icon && <Icon className="w-4 h-4 text-surface-400" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function FundingSection({ funding }: { funding?: FundingRound[] }) {
  if (!funding || funding.length === 0) return null;

  return (
    <Section title="Funding History" icon={DollarSign}>
      <div className="space-y-2">
        {funding.map((round, i) => (
          <div key={i} className="flex items-start justify-between p-2 bg-surface-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-surface-800">{round.round}</p>
              <p className="text-xs text-surface-500">{round.date}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-green-600">{round.amount}</p>
              <p className="text-xs text-surface-500">{round.investors.slice(0, 2).join(', ')}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function NewsSection({ news }: { news?: NewsItem[] }) {
  if (!news || news.length === 0) return null;

  return (
    <Section title="Recent News" icon={Newspaper}>
      <div className="space-y-2">
        {news.slice(0, 3).map((item, i) => (
          <div key={i} className="p-2 bg-surface-50 rounded-lg">
            <p className="text-sm font-medium text-surface-800 line-clamp-2">{item.title}</p>
            <p className="text-xs text-surface-500 mt-1">{item.date}</p>
            <p className="text-xs text-surface-600 mt-1 line-clamp-2">{item.summary}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ContactResearchSection({ contacts }: { contacts?: ContactResearch[] }) {
  if (!contacts || contacts.length === 0) return null;

  return (
    <Section title="Contact Backgrounds" icon={GraduationCap}>
      <div className="space-y-3">
        {contacts.map((contact, i) => (
          <div key={i} className="p-3 bg-surface-50 rounded-lg">
            <p className="text-sm font-semibold text-surface-800">{contact.name}</p>
            {contact.education && (
              <p className="text-xs text-surface-500 mt-1">{contact.education}</p>
            )}
            {contact.careerHistory && contact.careerHistory.length > 0 && (
              <div className="mt-2 space-y-1">
                {contact.careerHistory.slice(0, 3).map((job, j) => (
                  <div key={j} className="text-xs text-surface-600">
                    <span className="font-medium">{job.title}</span> at {job.company}
                    <span className="text-surface-400 ml-1">({job.duration})</span>
                  </div>
                ))}
              </div>
            )}
            {contact.insights && (
              <p className="text-xs text-surface-600 mt-2 italic">{contact.insights}</p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function MarketSection({ market }: { market?: DeepResearchResult['market'] }) {
  if (!market) return null;

  return (
    <Section title="Market Intelligence" icon={TrendingUp}>
      <div className="space-y-3">
        {market.marketSize && (
          <div className="flex justify-between text-sm">
            <span className="text-surface-500">Market Size</span>
            <span className="font-medium text-surface-800">{market.marketSize}</span>
          </div>
        )}
        {market.growthRate && (
          <div className="flex justify-between text-sm">
            <span className="text-surface-500">Growth Rate</span>
            <span className="font-medium text-green-600">{market.growthRate}</span>
          </div>
        )}
        {market.trends && market.trends.length > 0 && (
          <div>
            <p className="text-xs font-medium text-surface-500 mb-1">Industry Trends</p>
            <div className="flex flex-wrap gap-1">
              {market.trends.map((trend, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full">
                  {trend}
                </span>
              ))}
            </div>
          </div>
        )}
        {market.painPoints && market.painPoints.length > 0 && (
          <div>
            <p className="text-xs font-medium text-surface-500 mb-1">Common Pain Points</p>
            <ul className="space-y-1">
              {market.painPoints.map((point, i) => (
                <li key={i} className="text-xs text-surface-600 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
        {market.buyingSignals && market.buyingSignals.length > 0 && (
          <div>
            <p className="text-xs font-medium text-surface-500 mb-1">Buying Signals</p>
            <div className="flex flex-wrap gap-1">
              {market.buyingSignals.map((signal, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-green-50 text-green-700 rounded-full">
                  {signal}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

export function ProspectDetailPanel({
  prospect,
  deepResearch,
  isOpen,
  onClose,
  onStatusChange,
  onDeepResearch,
  onDelete,
  isResearching,
  isLoadingResearch,
}: ProspectDetailPanelProps) {
  if (!isOpen) return null;

  const hasDeepResearch = deepResearch && (deepResearch.company || deepResearch.contacts || deepResearch.market);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-surface-900/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-surface-200">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-surface-900">{prospect.companyName}</h2>
                {prospect.website && (
                  <a
                    href={prospect.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline flex items-center gap-1"
                  >
                    {new URL(prospect.website).hostname}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <div className="mt-2">
                  <InlineStatusSelect
                    status={prospect.status}
                    onStatusChange={onStatusChange}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-100 transition-colors"
            >
              <X className="w-5 h-5 text-surface-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Company Info */}
            <Section title="Company Information" icon={Briefcase}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-surface-500">Industry</p>
                  <p className="font-medium text-surface-800">{prospect.industry}</p>
                  {prospect.subIndustry && (
                    <p className="text-xs text-surface-500">{prospect.subIndustry}</p>
                  )}
                </div>
                <div>
                  <p className="text-surface-500">Employees</p>
                  <p className="font-medium text-surface-800">{prospect.employeeCount || 'Unknown'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-surface-500">Location</p>
                  <p className="font-medium text-surface-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-surface-400" />
                    {prospect.location.city}, {prospect.location.state}, {prospect.location.country}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-surface-500">Website</p>
                  {prospect.website && safeGetHostname(prospect.website) ? (
                    <a
                      href={prospect.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary-600 hover:underline flex items-center gap-1"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {safeGetHostname(prospect.website)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-surface-400 italic">Not available</p>
                  )}
                </div>
                {prospect.description && (
                  <div className="col-span-2">
                    <p className="text-surface-500">Description</p>
                    <p className="text-surface-700 text-xs leading-relaxed">{prospect.description}</p>
                  </div>
                )}
              </div>
            </Section>

            {/* ICP Match */}
            <Section title="ICP Match Score" icon={Target}>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      prospect.icpMatchScore >= 0.8 ? 'bg-green-500' :
                      prospect.icpMatchScore >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ width: `${prospect.icpMatchScore * 100}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-surface-800">
                  {Math.round(prospect.icpMatchScore * 100)}%
                </span>
              </div>
              {prospect.painPoints && prospect.painPoints.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-surface-500 mb-1">Identified Pain Points</p>
                  <ul className="space-y-1">
                    {prospect.painPoints.map((point, i) => (
                      <li key={i} className="text-xs text-surface-600 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            {/* Contacts */}
            <Section title={`Contacts (${prospect.contacts.length})`} icon={Users}>
              <div className="space-y-2">
                {prospect.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={clsx(
                      'p-3 rounded-lg',
                      contact.isPrimary ? 'bg-primary-50 ring-1 ring-primary-200' : 'bg-surface-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-surface-800">{contact.name}</p>
                        <p className="text-xs text-surface-500">{contact.title}</p>
                      </div>
                      {contact.isPrimary && (
                        <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-3.5 h-3.5 text-surface-400" />
                          <span className="text-surface-700">{contact.email}</span>
                          <CopyButton text={contact.email} />
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-3.5 h-3.5 text-surface-400" />
                          <span className="text-surface-700">{contact.phone}</span>
                          <CopyButton text={contact.phone} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Deep Research Results */}
            {isLoadingResearch ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                <span className="ml-2 text-sm text-surface-500">Loading research data...</span>
              </div>
            ) : hasDeepResearch ? (
              <>
                <div className="border-t border-surface-200 pt-4 mt-4">
                  <h3 className="text-sm font-bold text-surface-800 mb-4 flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary-500" />
                    Deep Research Results
                    {deepResearch?.researchedAt && (
                      <span className="text-xs font-normal text-surface-400">
                        {new Date(deepResearch.researchedAt).toLocaleDateString()}
                      </span>
                    )}
                  </h3>
                </div>
                <FundingSection funding={deepResearch?.company?.funding} />
                <NewsSection news={deepResearch?.company?.recentNews} />
                <ContactResearchSection contacts={deepResearch?.contacts} />
                <MarketSection market={deepResearch?.market} />

                {deepResearch?.company?.competitors && deepResearch.company.competitors.length > 0 && (
                  <Section title="Competitors">
                    <div className="flex flex-wrap gap-1">
                      {deepResearch.company.competitors.map((comp, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-surface-100 text-surface-700 rounded-full">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-3 p-4 border-t border-surface-200 bg-surface-50">
            <button
              onClick={onDeepResearch}
              disabled={isResearching}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors',
                isResearching
                  ? 'bg-surface-200 text-surface-400 cursor-not-allowed'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              )}
            >
              {isResearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Researching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  {hasDeepResearch ? 'Re-run Research' : 'Run Deep Research'}
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
