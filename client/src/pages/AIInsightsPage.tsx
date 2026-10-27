import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import api from '../lib/api';

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
};

function InsightCard({ item }: { item: { category: string; suggestion: string; priority: string } }) {
  const copy = () => {
    navigator.clipboard.writeText(item.suggestion);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.category}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_COLORS[item.priority] || 'bg-gray-100 text-gray-600'}`}>
          {item.priority}
        </span>
      </div>
      <p className="text-sm text-gray-800 leading-relaxed">{item.suggestion}</p>
      <button onClick={copy} className="mt-2 text-xs text-blue-500 hover:underline">Copy</button>
    </div>
  );
}

export default function AIInsightsPage() {
  const [campaignId, setCampaignId] = useState<string>('');

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/api/analytics/campaigns').then((r) => r.data),
  });

  const { data: insightData, refetch } = useQuery({
    queryKey: ['insights', campaignId],
    queryFn: () => api.get(`/api/ai/insights/${campaignId}`).then((r) => r.data),
    enabled: !!campaignId,
    retry: false,
  });

  const { mutate: generate, isPending } = useMutation({
    mutationFn: () => api.post(`/api/ai/insights/${campaignId}`),
    onSuccess: () => refetch(),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Gemini request failed'),
  });

  const { mutate: regenerate, isPending: regenerating } = useMutation({
    mutationFn: () => api.post(`/api/ai/insights/${campaignId}/regenerate`),
    onSuccess: () => refetch(),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Regeneration failed'),
  });

  const suggestions: any[] = insightData?.insight?.response || [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">AI Insights</h2>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Campaign</label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-48"
          >
            <option value="">— choose a campaign —</option>
            {campaigns.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {campaignId && (
          <>
            <button
              onClick={() => generate()}
              disabled={isPending || regenerating}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Analyzing…' : 'Analyze'}
            </button>
            {suggestions.length > 0 && (
              <button
                onClick={() => regenerate()}
                disabled={isPending || regenerating}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                {regenerating ? 'Regenerating…' : 'Regenerate'}
              </button>
            )}
          </>
        )}
      </div>

      {(isPending || regenerating) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-28 animate-pulse" />
          ))}
        </div>
      )}

      {suggestions.length > 0 && !isPending && !regenerating && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suggestions.map((item, i) => <InsightCard key={i} item={item} />)}
        </div>
      )}

      {!isPending && !regenerating && campaignId && suggestions.length === 0 && (
        <p className="text-sm text-gray-400">Click "Analyze" to generate AI-powered suggestions for this campaign.</p>
      )}
    </div>
  );
}
