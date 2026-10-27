import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import api from '../lib/api';

const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);

function CampaignTable({ campaigns }: { campaigns: any[] }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('sentAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = campaigns
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const toggle = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const Th = ({ k, label }: { k: string; label: string }) => (
    <th
      onClick={() => toggle(k)}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
    >
      {label} {sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search campaigns…"
        className="mb-4 w-full max-w-sm border border-gray-300 rounded-md px-3 py-2 text-sm"
      />
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th k="name" label="Campaign" />
              <Th k="sentAt" label="Sent" />
              <Th k="totalRecipients" label="Recipients" />
              <Th k="openRate" label="Open %" />
              <Th k="ctr" label="CTR %" />
              <Th k="bounceRate" label="Bounce %" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link to={`/analytics/${c.id}`} className="text-blue-600 hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 text-gray-700">{c.totalRecipients.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-700">{fmtPct(c.openRate)}</td>
                <td className="px-4 py-3 text-gray-700">{fmtPct(c.ctr)}</td>
                <td className="px-4 py-3 text-gray-700">{fmtPct(c.bounceRate)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    c.source === 'MAILCHIMP' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {c.source}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No campaigns found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CSVUploadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', file!);
      const { data } = await api.post('/api/campaigns/upload', fd);
      return data;
    },
    onSuccess: (data) => {
      const skipped = data.skipped ? `, skipped ${data.skipped} duplicate(s)` : '';
      toast.success(`Imported ${data.count} campaign(s)${skipped}`);
      qc.invalidateQueries();
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Upload failed'),
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    onDrop: (files) => setFile(files[0] ?? null),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload CSV</h3>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          {file
            ? <p className="text-sm text-gray-700 font-medium">{file.name}</p>
            : <p className="text-sm text-gray-500">Drag & drop a CSV file here, or click to select</p>
          }
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Required columns: Campaign Name, Recipients, Opens, Clicks, Bounces, Unsubscribes.
          Optional: Subject, Send Time, Unique Opens, Unique Clicks.
        </p>
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => mutate()}
            disabled={!file || isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MailchimpConnectCard() {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [showInput, setShowInput] = useState(false);
  // undefined = not syncing; otherwise the lastSyncAt value seen when sync started
  const [syncBaseline, setSyncBaseline] = useState<string | null | undefined>(undefined);
  const syncing = syncBaseline !== undefined;

  const { data: status } = useQuery({
    queryKey: ['mailchimpStatus'],
    queryFn: () => api.get('/api/integrations/mailchimp/status').then((r) => r.data),
    refetchInterval: syncing ? 3000 : false,
  });

  // Sync finished when lastSyncAt changes
  useEffect(() => {
    if (!syncing || !status) return;
    if ((status.lastSyncAt ?? null) !== syncBaseline) {
      setSyncBaseline(undefined);
      toast.success('Mailchimp sync complete');
      qc.invalidateQueries();
    }
  }, [status, syncing, syncBaseline, qc]);

  // Stop waiting after 2 minutes
  useEffect(() => {
    if (!syncing) return;
    const t = setTimeout(() => {
      setSyncBaseline(undefined);
      toast.info('Sync is taking longer than expected. Refresh the page in a moment.');
    }, 120000);
    return () => clearTimeout(t);
  }, [syncing]);

  const { mutate: connect, isPending: connecting } = useMutation({
    mutationFn: () => api.post('/api/integrations/mailchimp/connect', { apiKey }),
    onSuccess: () => {
      toast.success('Mailchimp connected');
      setShowInput(false);
      setApiKey('');
      qc.invalidateQueries({ queryKey: ['mailchimpStatus'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Connection failed'),
  });

  const { mutate: syncNow, isPending: startingSync } = useMutation({
    mutationFn: () => api.post('/api/integrations/mailchimp/sync'),
    onSuccess: () => {
      setSyncBaseline(status?.lastSyncAt ?? null);
      toast.success('Sync started');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Sync failed'),
  });

  const { mutate: disconnect, isPending: disconnecting } = useMutation({
    mutationFn: () => api.delete('/api/integrations/mailchimp'),
    onSuccess: () => {
      toast.success('Mailchimp disconnected');
      qc.invalidateQueries({ queryKey: ['mailchimpStatus'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Disconnect failed'),
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Mailchimp Integration</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          status?.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {status?.connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      {status?.lastSyncAt && (
        <p className="text-xs text-gray-400 mb-3">Last sync: {new Date(status.lastSyncAt).toLocaleString()}</p>
      )}
      {!status?.connected && !showInput && (
        <button onClick={() => setShowInput(true)} className="text-sm text-blue-600 hover:underline">
          Connect API key
        </button>
      )}
      {showInput && (
        <div className="flex gap-2">
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="xxxxxxxxxxxxxxx-us6"
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={() => connect()}
            disabled={!apiKey || connecting}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md disabled:opacity-50"
          >
            {connecting ? '…' : 'Save'}
          </button>
          <button onClick={() => setShowInput(false)} className="px-3 py-2 text-sm text-gray-500">
            Cancel
          </button>
        </div>
      )}
      {status?.connected && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => syncNow()}
            disabled={syncing || startingSync}
            className="text-sm bg-yellow-500 text-white px-3 py-1.5 rounded-md hover:bg-yellow-600 disabled:opacity-50"
          >
            {syncing || startingSync ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            onClick={() => disconnect()}
            disabled={disconnecting || syncing}
            className="text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  const [showUpload, setShowUpload] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/api/analytics/campaigns').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Campaigns</h2>
        <button
          onClick={() => setShowUpload(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
        >
          Upload CSV
        </button>
      </div>

      <MailchimpConnectCard />

      {isLoading
        ? <div className="text-center py-12 text-gray-400">Loading campaigns…</div>
        : <CampaignTable campaigns={campaigns} />
      }

      {showUpload && <CSVUploadModal onClose={() => setShowUpload(false)} />}
    </div>
  );
}