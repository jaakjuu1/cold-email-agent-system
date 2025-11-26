import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Mail,
  Eye,
  MousePointer,
  MessageSquare,
  Users,
  Target,
} from 'lucide-react';
import { analyticsApi } from '../lib/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#0ea5e9', '#f97316', '#10b981', '#8b5cf6', '#ef4444'];

export function Analytics() {
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.getDashboard,
  });

  const { data: funnel } = useQuery({
    queryKey: ['funnel'],
    queryFn: () => analyticsApi.getFunnel(),
  });

  const { data: responses } = useQuery({
    queryKey: ['responses'],
    queryFn: () => analyticsApi.getResponses(),
  });

  const metrics = dashboard?.data || {
    totalEmailsSent: 0,
    averageOpenRate: 0,
    averageReplyRate: 0,
    totalResponses: 0,
  };

  const funnelData = funnel?.data?.stages || [];
  const responseData = responses?.data || { positive: 0, neutral: 0, negative: 0, outOfOffice: 0 };

  // Mock daily data for chart
  const dailyData = [
    { date: 'Mon', sent: 45, opened: 20, replied: 3 },
    { date: 'Tue', sent: 52, opened: 25, replied: 4 },
    { date: 'Wed', sent: 48, opened: 22, replied: 2 },
    { date: 'Thu', sent: 55, opened: 28, replied: 5 },
    { date: 'Fri', sent: 40, opened: 18, replied: 3 },
    { date: 'Sat', sent: 0, opened: 5, replied: 1 },
    { date: 'Sun', sent: 0, opened: 3, replied: 0 },
  ];

  const sentimentData = [
    { name: 'Positive', value: responseData.positive, color: '#10b981' },
    { name: 'Neutral', value: responseData.neutral, color: '#6b7280' },
    { name: 'Negative', value: responseData.negative, color: '#ef4444' },
    { name: 'Out of Office', value: responseData.outOfOffice, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Analytics</h1>
        <p className="mt-1 text-surface-500">
          Track your outreach performance and optimize campaigns
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500">Total Emails Sent</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">
                {metrics.totalEmailsSent.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary-50">
              <Mail className="w-6 h-6 text-primary-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-green-600">+12%</span>
            <span className="text-surface-400">vs last week</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500">Open Rate</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">
                {(metrics.averageOpenRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-accent-50">
              <Eye className="w-6 h-6 text-accent-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-green-600">+5.2%</span>
            <span className="text-surface-400">vs last week</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500">Reply Rate</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">
                {(metrics.averageReplyRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-green-50">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-red-600">-2.1%</span>
            <span className="text-surface-400">vs last week</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-surface-500">Total Responses</p>
              <p className="text-2xl font-bold text-surface-900 mt-1">
                {metrics.totalResponses}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-sm">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-green-600">+18</span>
            <span className="text-surface-400">this week</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">
            Daily Activity
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e4e4e7',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stackId="1"
                  stroke="#0ea5e9"
                  fill="#0ea5e9"
                  fillOpacity={0.3}
                  name="Sent"
                />
                <Area
                  type="monotone"
                  dataKey="opened"
                  stackId="2"
                  stroke="#f97316"
                  fill="#f97316"
                  fillOpacity={0.3}
                  name="Opened"
                />
                <Area
                  type="monotone"
                  dataKey="replied"
                  stackId="3"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                  name="Replied"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Sentiment */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-surface-900 mb-4">
            Response Sentiment
          </h2>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {sentimentData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-surface-600">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Funnel */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-surface-900 mb-6">
          Conversion Funnel
        </h2>
        <div className="space-y-4">
          {funnelData.map((stage: { name: string; count: number; percentage: number }, index: number) => (
            <div key={stage.name} className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-surface-900">{stage.name}</span>
                <span className="text-sm text-surface-500">
                  {stage.count.toLocaleString()} ({stage.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-8 bg-surface-100 rounded-lg overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${stage.percentage}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

