import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Mail,
  MoreVertical,
  Users,
  Clock,
} from 'lucide-react';
import { campaignsApi } from '../lib/api';
import { clsx } from 'clsx';
import { CampaignBuilder } from '../components/CampaignBuilder';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  stats: {
    totalProspects: number;
    emailsSent: number;
    emailsOpened: number;
    responses: number;
  };
  createdAt: string;
}

const statusColors = {
  draft: 'bg-surface-100 text-surface-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-primary-100 text-primary-700',
};

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const openRate = campaign.stats.emailsSent > 0
    ? (campaign.stats.emailsOpened / campaign.stats.emailsSent) * 100
    : 0;
  const replyRate = campaign.stats.emailsSent > 0
    ? (campaign.stats.responses / campaign.stats.emailsSent) * 100
    : 0;

  return (
    <Link
      to={`/campaigns/${campaign.id}`}
      className="card p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-surface-900">{campaign.name}</h3>
          <span
            className={clsx(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2',
              statusColors[campaign.status]
            )}
          >
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </span>
        </div>
        <button
          className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
          onClick={(e) => e.preventDefault()}
        >
          <MoreVertical className="w-4 h-4 text-surface-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-surface-400" />
          <span className="text-sm text-surface-600">
            {campaign.stats.totalProspects} prospects
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-surface-400" />
          <span className="text-sm text-surface-600">
            {campaign.stats.emailsSent} sent
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-surface-500">Open Rate</span>
            <span className="font-medium text-surface-700">
              {openRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full"
              style={{ width: `${openRate}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-surface-500">Reply Rate</span>
            <span className="font-medium text-surface-700">
              {replyRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-500 rounded-full"
              style={{ width: `${replyRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-100">
        <Clock className="w-4 h-4 text-surface-400" />
        <span className="text-xs text-surface-500">
          Created {new Date(campaign.createdAt).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}

export function Campaigns() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showBuilder, setShowBuilder] = useState(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', statusFilter],
    queryFn: () =>
      campaignsApi.list(statusFilter !== 'all' ? { status: statusFilter } : undefined),
  });

  const filteredCampaigns = (campaigns?.data || []).filter((campaign: Campaign) =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Campaigns</h1>
          <p className="mt-1 text-surface-500">
            Manage your outreach campaigns
          </p>
        </div>
        <button onClick={() => setShowBuilder(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'paused', 'draft', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-surface-200 rounded w-3/4 mb-4" />
              <div className="h-4 bg-surface-200 rounded w-1/4 mb-4" />
              <div className="space-y-2">
                <div className="h-3 bg-surface-200 rounded w-full" />
                <div className="h-3 bg-surface-200 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCampaigns.map((campaign: Campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Mail className="w-12 h-12 text-surface-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-surface-900 mb-2">
            No campaigns yet
          </h3>
          <p className="text-surface-500 mb-6">
            Create your first campaign to start reaching out to prospects.
          </p>
          <button onClick={() => setShowBuilder(true)} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </button>
        </div>
      )}

      {/* Campaign Builder Modal */}
      {showBuilder && <CampaignBuilder onClose={() => setShowBuilder(false)} />}
    </div>
  );
}

