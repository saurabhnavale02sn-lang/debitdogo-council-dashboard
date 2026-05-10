import { useState } from 'react';
import { X, Play, Copy, Loader2, CheckCircle2 } from 'lucide-react';
import { N8N_DISPATCH_URL } from '../lib/supabase';
import type { Agent } from '../types';
import toast from 'react-hot-toast';

interface Props {
  agent: Agent;
  onClose: () => void;
}

export default function TestRunModal({ agent, onClose }: Props) {
  const [input, setInput] = useState('');
  const [context, setContext] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ model: string; tokens: number; runId: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRun = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResponse(null);
    setMeta(null);

    try {
      const res = await fetch(N8N_DISPATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: agent.department,
          input_text: input,
          context_data: context ? JSON.parse(context) : null,
          triggered_by: 'council_dashboard_test',
          brand_id: null,
        }),
      });

      const data = await res.json();

      if (data.error || data.status === 'error') {
        setError(data.error || 'Agent returned an error');
      } else {
        const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2);
        setResponse(output);
        setMeta({
          model: data.model || agent.model,
          tokens: (data.tokens_input || 0) + (data.tokens_output || 0),
          runId: data.run_id || '',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to dispatcher');
    }
    setLoading(false);
  };

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      toast.success('Copied to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col fade-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{agent.icon}</span>
            <div>
              <h2 className="font-bold text-gray-900">Test Run</h2>
              <span className="text-xs text-gray-400">{agent.display_name} &middot; {agent.department}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Input Text</label>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={4}
              className="input-field text-sm"
              placeholder="Enter test input for this agent..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Context Data <span className="text-gray-400 font-normal">(optional JSON)</span>
            </label>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={2}
              className="input-field text-sm font-mono"
              placeholder='{"marketplace": "amazon", "amount": 45000}'
            />
          </div>

          <button
            onClick={handleRun}
            disabled={loading || !input.trim()}
            className="btn-maroon w-full flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {loading ? 'Running...' : 'Run Agent'}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-red-700">{error}</div>
          )}

          {response && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Response</span>
                </div>
                <div className="flex items-center gap-3">
                  {meta && (
                    <span className="text-xs text-gray-400">
                      {meta.model} &middot; {meta.tokens} tokens
                    </span>
                  )}
                  <button onClick={copyResponse} className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs">
                    <Copy size={12} /> Copy
                  </button>
                </div>
              </div>
              <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-auto max-h-64 font-mono leading-relaxed">
                {response}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
