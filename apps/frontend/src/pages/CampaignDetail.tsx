import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Mail,
  Users,
  TrendingUp,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { campaignsApi } from '../lib/api';
import { useCampaignUpdates } from '../hooks/useWebSocket';
import { clsx } from 'clsx';

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const { stats: realtimeStats, isConnected } = useCampaignUpdates(id);

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => campaignsApi.get(id!),
    enabled: !!id,
  });

  const { data: campaignStats } = useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => campaignsApi.getStats(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-200 rounded w-48" />
        <div className="h-32 bg-surface-200 rounded-xl" />
        <div className="grid grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!campaign?.data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-surface-900">
          Campaign not found
        </h2>
        <Link to="/campaigns" className="text-primary-600 hover:underline mt-2">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const stats = realtimeStats || campaignStats?.data || campaign.data.stats;
  const statusColors = {
    draft: 'bg-surface-100 text-surface-600',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-primary-100 text-primary-700',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            to="/campaigns"
            className="p-2 rounded-lg hover:bg-surface-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-surface-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-surface-900">
                {campaign.data.name}
              </h1>
              <span
                className={clsx(
                  'px-2.5 py-0.5 rounded-full text-xs font-medium',
                  statusColors[campaign.data.status as keyof typeof statusColors]
                )}
              >
                {campaign.data.status}
              </span>
              {isConnected && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="mt-1 text-surface-500">
              Created {new Date(campaign.data.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {campaign.data.status === 'active' ? (
            <button className="btn-secondary">
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </button>
          ) : (
            <button className="btn-primary">
              <Play className="w-4 h-4 mr-2" />
              Start
            </button>
          )}
          <button className="btn-ghost">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-50">
              <Mail className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {stats.emailsSent}
              </p>
              <p className="text-sm text-surface-500">Emails Sent</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {stats.emailsDelivered}
              </p>
              <p className="text-sm text-surface-500">Delivered</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-50">
              <TrendingUp className="w-5 h-5 text-accent-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {stats.emailsOpened}
              </p>
              <p className="text-sm text-surface-500">Opened</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-surface-900">
                {stats.responses}
              </p>
              <p className="text-sm text-surface-500">Responses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">
            Performance Metrics
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600">Delivery Rate</span>
                <span className="font-medium text-surface-900">
                  {stats.emailsSent > 0
                    ? ((stats.emailsDelivered / stats.emailsSent) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${
                      stats.emailsSent > 0
                        ? (stats.emailsDelivered / stats.emailsSent) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600">Open Rate</span>
                <span className="font-medium text-surface-900">
                  {stats.emailsSent > 0
                    ? ((stats.emailsOpened / stats.emailsSent) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{
                    width: `${
                      stats.emailsSent > 0
                        ? (stats.emailsOpened / stats.emailsSent) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600">Reply Rate</span>
                <span className="font-medium text-surface-900">
                  {stats.emailsSent > 0
                    ? ((stats.responses / stats.emailsSent) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full"
                  style={{
                    width: `${
                      stats.emailsSent > 0
                        ? (stats.responses / stats.emailsSent) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">
            Response Summary
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">
                {stats.positiveResponses}
              </p>
              <p className="text-sm text-green-600">Positive</p>
            </div>
            <div className="p-4 bg-surface-50 rounded-lg">
              <p className="text-2xl font-bold text-surface-700">
                {stats.responses - stats.positiveResponses}
              </p>
              <p className="text-sm text-surface-500">Other</p>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg">
              <p className="text-2xl font-bold text-primary-700">
                {stats.meetings}
              </p>
              <p className="text-sm text-primary-600">Meetings Booked</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">
                {stats.emailsBounced}
              </p>
              <p className="text-sm text-red-600">Bounced</p>
            </div>
          </div>
        </div>
      </div>

      {/* Prospects */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-surface-900">
            Prospects ({stats.totalProspects})
          </h2>
          <Link
            to={`/prospects?campaignId=${id}`}
            className="text-sm text-primary-600 hover:underline"
          >
            View all
          </Link>
        </div>
        <p className="text-surface-500">
          Prospects list will be displayed here with their email status and response history.
        </p>
      </div>
    </div>
  );
}

