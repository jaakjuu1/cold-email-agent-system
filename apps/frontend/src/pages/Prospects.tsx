import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Users,
  Building2,
  MapPin,
  Mail,
  ExternalLink,
  MoreVertical,
  Plus,
  Download,
  RefreshCw,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { prospectsApi } from '../lib/api';
import { useAppStore } from '../store';
import { clsx } from 'clsx';

interface Prospect {
  id: string;
  companyName: string;
  website?: string;
  industry: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  employeeCount?: string;
  contacts: Array<{
    id: string;
    name: string;
    title: string;
    email?: string;
    isPrimary: boolean;
  }>;
  icpMatchScore: number;
  status: 'new' | 'researched' | 'contacted' | 'responded' | 'converted' | 'rejected';
}

const statusColors = {
  new: 'bg-surface-100 text-surface-600',
  researched: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  responded: 'bg-green-100 text-green-700',
  converted: 'bg-primary-100 text-primary-700',
  rejected: 'bg-red-100 text-red-700',
};

function ProspectRow({ prospect }: { prospect: Prospect }) {
  const primaryContact = prospect.contacts.find((c) => c.isPrimary) || prospect.contacts[0];

  return (
    <tr className="hover:bg-surface-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="font-medium text-surface-900">{prospect.companyName}</p>
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
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        {primaryContact && (
          <div>
            <p className="font-medium text-surface-900">{primaryContact.name}</p>
            <p className="text-sm text-surface-500">{primaryContact.title}</p>
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <span className="text-sm text-surface-600">{prospect.industry}</span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1 text-sm text-surface-600">
          <MapPin className="w-4 h-4 text-surface-400" />
          {prospect.location.city}, {prospect.location.state}
        </div>
      </td>
      <td className="px-6 py-4">
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
          <span className="text-sm font-medium text-surface-700">
            {Math.round(prospect.icpMatchScore * 100)}%
          </span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span
          className={clsx(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            statusColors[prospect.status]
          )}
        >
          {prospect.status.charAt(0).toUpperCase() + prospect.status.slice(1)}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {primaryContact?.email && (
            <button className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
              <Mail className="w-4 h-4 text-surface-400" />
            </button>
          )}
          <button className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
            <MoreVertical className="w-4 h-4 text-surface-400" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function DiscoverLeadsModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { locations: Array<{ city: string; state: string; country: string }>; industries: string[]; limit: number }) => void;
  isLoading: boolean;
}) {
  const [city, setCity] = useState('San Francisco');
  const [state, setState] = useState('CA');
  const [country, setCountry] = useState('USA');
  const [industries, setIndustries] = useState('SaaS, Technology');
  const [limit, setLimit] = useState(50);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      locations: [{ city, state, country }],
      industries: industries.split(',').map((i) => i.trim()).filter(Boolean),
      limit,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-100 transition-colors"
        >
          <X className="w-5 h-5 text-surface-400" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-900">Discover Leads</h2>
            <p className="text-sm text-surface-500">Find prospects matching your ICP</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input"
                placeholder="San Francisco"
              />
            </div>
            <div>
              <label className="label">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="input"
                placeholder="CA"
              />
            </div>
            <div>
              <label className="label">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="input"
                placeholder="USA"
              />
            </div>
          </div>

          <div>
            <label className="label">Industries (comma-separated)</label>
            <input
              type="text"
              value={industries}
              onChange={(e) => setIndustries(e.target.value)}
              className="input"
              placeholder="SaaS, Technology, Healthcare"
            />
          </div>

          <div>
            <label className="label">Max Leads to Find</label>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
              className="input"
              min={10}
              max={500}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Discovering...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Discovery
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Prospects() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  
  const currentClient = useAppStore((state) => state.currentClient);
  const queryClient = useQueryClient();

  const discoverMutation = useMutation({
    mutationFn: (data: {
      locations: Array<{ city: string; state: string; country: string }>;
      industries: string[];
      limit: number;
    }) =>
      prospectsApi.discover({
        clientId: currentClient?.id || 'demo-client',
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      setShowDiscoverModal(false);
    },
  });

  const { data: prospectsData, isLoading } = useQuery({
    queryKey: ['prospects', statusFilter, page],
    queryFn: () =>
      prospectsApi.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        pageSize: 20,
      }),
  });

  const prospects = prospectsData?.data?.data || [];
  const total = prospectsData?.data?.total || 0;

  const filteredProspects = prospects.filter((prospect: Prospect) =>
    prospect.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Prospects</h1>
          <p className="mt-1 text-surface-500">
            {total.toLocaleString()} prospects in your database
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <button className="btn-primary" onClick={() => setShowDiscoverModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Discover Leads
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search prospects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {['all', 'new', 'researched', 'contacted', 'responded', 'converted'].map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  statusFilter === status
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-surface-400 animate-spin mx-auto" />
            <p className="mt-2 text-surface-500">Loading prospects...</p>
          </div>
        ) : filteredProspects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    ICP Match
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filteredProspects.map((prospect: Prospect) => (
                  <ProspectRow key={prospect.id} prospect={prospect} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-surface-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-900 mb-2">
              No prospects found
            </h3>
            <p className="text-surface-500 mb-6">
              Start discovering leads to populate your prospect database.
            </p>
            <button className="btn-primary" onClick={() => setShowDiscoverModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Discover Leads
            </button>
          </div>
        )}
      </div>

      {/* Discover Leads Modal */}
      <DiscoverLeadsModal
        isOpen={showDiscoverModal}
        onClose={() => setShowDiscoverModal(false)}
        onSubmit={(data) => discoverMutation.mutate(data)}
        isLoading={discoverMutation.isPending}
      />

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-500">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of{' '}
            {total} prospects
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 20 >= total}
              className="btn-secondary disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

