import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Mail,
  Users,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import { analyticsApi } from '../lib/api';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  color: 'primary' | 'accent' | 'green' | 'purple';
}

function MetricCard({ title, value, change, icon: Icon, color }: MetricCardProps) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600',
    accent: 'bg-accent-50 text-accent-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-surface-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-surface-900">{value}</p>
          {change !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {change >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm font-medium ${
                  change >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {Math.abs(change)}%
              </span>
              <span className="text-sm text-surface-400">vs last week</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.getDashboard,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-surface-200 rounded w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-surface-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = dashboard?.data || {
    totalCampaigns: 0,
    totalEmailsSent: 0,
    totalProspects: 0,
    totalResponses: 0,
    averageOpenRate: 0,
    averageReplyRate: 0,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
        <p className="mt-1 text-surface-500">
          Overview of your outreach performance
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-stagger">
        <MetricCard
          title="Active Campaigns"
          value={metrics.activeCampaigns || metrics.totalCampaigns}
          change={12}
          icon={Mail}
          color="primary"
        />
        <MetricCard
          title="Emails Sent"
          value={metrics.totalEmailsSent.toLocaleString()}
          change={8}
          icon={Zap}
          color="accent"
        />
        <MetricCard
          title="Total Prospects"
          value={metrics.totalProspects.toLocaleString()}
          change={15}
          icon={Users}
          color="green"
        />
        <MetricCard
          title="Responses"
          value={metrics.totalResponses}
          change={-3}
          icon={MessageSquare}
          color="purple"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">
            Performance Overview
          </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600">Open Rate</span>
                <span className="font-medium text-surface-900">
                  {(metrics.averageOpenRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.averageOpenRate * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-surface-600">Reply Rate</span>
                <span className="font-medium text-surface-900">
                  {(metrics.averageReplyRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all duration-500"
                  style={{ width: `${metrics.averageReplyRate * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {metrics.recentActivity?.map((activity: { type: string; message: string; timestamp: string }, i: number) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-surface-50"
              >
                <div
                  className={`w-2 h-2 mt-2 rounded-full ${
                    activity.type === 'response'
                      ? 'bg-green-500'
                      : activity.type === 'campaign'
                      ? 'bg-primary-500'
                      : 'bg-surface-400'
                  }`}
                />
                <div>
                  <p className="text-sm text-surface-700">{activity.message}</p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            )) || (
              <p className="text-sm text-surface-500">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-900 mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="/campaigns"
            className="btn-primary inline-flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            New Campaign
          </a>
          <a
            href="/prospects"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            Find Prospects
          </a>
          <a
            href="/analytics"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" />
            View Analytics
          </a>
        </div>
      </div>
    </div>
  );
}

