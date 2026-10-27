import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../lib/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

function KPICard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function OverviewPage() {
  const [range, setRange] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);

  const { data: overview } = useQuery({
    queryKey: ['overview', range],
    queryFn: () => api.get('/api/analytics/overview', { params: { range } }).then((r) => r.data),
  });

  const { data: trends = [] } = useQuery({
    queryKey: ['trends', range],
    queryFn: () => api.get('/api/analytics/trends', { params: { range } }).then((r) => r.data),
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/api/analytics/campaigns').then((r) => r.data),
  });

  const { data: comparisonRaw = [] } = useQuery({
    queryKey: ['compare', selected],
    queryFn: () =>
      api.get(`/api/analytics/compare?ids=${selected.join(',')}`).then((r) => r.data),
    enabled: selected.length >= 2,
  });

  if (!overview) return <div className="text-center py-12 text-gray-400">Loading…</div>;

  const totals = overview.eventTotals || { opens: 0, clicks: 0, bounces: 0, unsubscribes: 0 };
  const eventBreakdown = [
    { name: 'Opens', value: totals.opens },
    { name: 'Clicks', value: totals.clicks },
    { name: 'Bounces', value: totals.bounces },
    { name: 'Unsubs', value: totals.unsubscribes },
  ].filter((e) => e.value > 0);

  // Unique label per campaign so duplicate names don't collide on the axis
  const comparison = comparisonRaw.map((c: any) => ({
    ...c,
    label: c.sentAt ? `${c.name} (${new Date(c.sentAt).toLocaleDateString()})` : c.name,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {overview.totalCampaigns === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
          No campaigns in this period.{' '}
          <Link to="/campaigns" className="text-blue-600 hover:underline">Upload a CSV or sync Mailchimp</Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Campaigns" value={overview.totalCampaigns} />
        <KPICard label="Avg Open Rate" value={fmtPct(overview.avgOpenRate)} />
        <KPICard label="Avg CTR" value={fmtPct(overview.avgCtr)} />
        <KPICard label="Avg Bounce Rate" value={fmtPct(overview.avgBounceRate)} />
      </div>

      {/* Trends */}
      {trends.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Trends Over Time</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avgOpenRate" name="Open Rate %" stroke="#3b82f6" dot={false} />
              <Line type="monotone" dataKey="avgCtr" name="CTR %" stroke="#10b981" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Breakdown Pie (actual event counts) */}
        {eventBreakdown.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Event Breakdown</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={eventBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  label={({ name, value }) => `${name}: ${Number(value).toLocaleString()}`}
                >
                  {eventBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Campaign Comparison */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Compare Campaigns</h3>
          <p className="text-xs text-gray-400 mb-2">Select at least 2 campaigns</p>
          <div className="flex flex-wrap gap-2 mb-4 max-h-28 overflow-y-auto">
            {campaigns.map((c: any) => (
              <label key={c.id} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={(e) => {
                    setSelected(e.target.checked
                      ? [...selected, c.id]
                      : selected.filter((id) => id !== c.id));
                  }}
                  className="accent-blue-600"
                />
                {c.name}
                {c.sentAt ? ` (${new Date(c.sentAt).toLocaleDateString()})` : ''}
              </label>
            ))}
          </div>
          {comparison.length >= 2 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="openRate" name="Open %" fill="#3b82f6" />
                <Bar dataKey="ctr" name="CTR %" fill="#10b981" />
                <Bar dataKey="bounceRate" name="Bounce %" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function CampaignDetailPage() {
  const { id } = useParams();
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get(`/api/analytics/campaigns/${id}`).then((r) => r.data),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading…</div>;
  if (!campaign) {
    return (
      <div className="text-center py-12 text-gray-500">
        Campaign not found. <Link to="/campaigns" className="text-blue-600 hover:underline">Back to campaigns</Link>
      </div>
    );
  }

  const m = campaign.metrics || {};
  const metricRows = [
    { label: 'Total Recipients', value: campaign.totalRecipients },
    { label: 'Opens', value: m.opens }, { label: 'Unique Opens', value: m.uniqueOpens },
    { label: 'Clicks', value: m.clicks }, { label: 'Unique Clicks', value: m.uniqueClicks },
    { label: 'Bounces', value: m.bounces }, { label: 'Unsubscribes', value: m.unsubscribes },
    { label: 'Complaints', value: m.complaints }, { label: 'Deliveries', value: m.deliveries },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/campaigns" className="text-xs text-blue-600 hover:underline">← Back to campaigns</Link>
        <h2 className="text-xl font-bold text-gray-900 mt-1">{campaign.name}</h2>
        {campaign.subject && <p className="text-sm text-gray-500 mt-1">Subject: {campaign.subject}</p>}
        {campaign.sentAt && (
          <p className="text-xs text-gray-400 mt-1">Sent {new Date(campaign.sentAt).toLocaleString()}</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Open Rate" value={fmtPct(campaign.openRate)} />
        <KPICard label="CTR" value={fmtPct(campaign.ctr)} />
        <KPICard label="Bounce Rate" value={fmtPct(campaign.bounceRate)} />
        <KPICard label="Unsub Rate" value={fmtPct(campaign.unsubRate)} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metricRows.map(({ label, value }) => (
              <tr key={label}>
                <td className="px-4 py-3 text-gray-600">{label}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{value?.toLocaleString() ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {campaign.segments?.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Audience Segments</h3>
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead><tr>
              <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Segment</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Recipients</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Open %</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Click %</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {campaign.segments.map((s: any) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">{s.segmentName}</td>
                  <td className="px-3 py-2">{s.recipientCount}</td>
                  <td className="px-3 py-2">{s.openRate}%</td>
                  <td className="px-3 py-2">{s.clickRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export { OverviewPage, CampaignDetailPage };