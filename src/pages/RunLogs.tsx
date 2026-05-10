import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Agent, AgentRun } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { Eye, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export default function RunLogs() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<AgentRun | null>(null);
  const perPage = 25;

  // Filters
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const fetchRuns = async () => {
    setLoading(true);
    let q = supabase
      .from('council_agent_runs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1);

    if (filterAgent) q = q.eq('agent_id', filterAgent);
    if (filterStatus) q = q.eq('status', filterStatus);
    if (filterSearch) q = q.or(`triggered_by.ilike.%${filterSearch}%,input_summary.ilike.%${filterSearch}%`);

    const { data, count } = await q;
    setRuns((data as AgentRun[]) || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('council_agents').select('id, display_name, icon, color').then(({ data }) => setAgents((data as Agent[]) || []));
  }, []);

  useEffect(() => { fetchRuns(); }, [page, filterAgent, filterStatus, filterSearch]);

  const getAgentInfo = (id: string) => agents.find(a => a.id === id);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Run Logs</h1>
      <p className="text-sm text-gray-500 mb-6">Full run history across all agents</p>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(0); }} className="input-field w-auto">
          <option value="">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} className="input-field w-auto">
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="running">Running</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filterSearch}
            onChange={e => { setFilterSearch(e.target.value); setPage(0); }}
            placeholder="Search by trigger or input..."
            className="input-field pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Triggered By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Input</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tokens</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No runs yet. Test an agent from the Council Overview.</td></tr>
              ) : (
                runs.map(run => {
                  const ai = getAgentInfo(run.agent_id);
                  return (
                    <tr key={run.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{ai?.icon || '🤖'}</span>
                          <span className="font-medium text-gray-700">{run.agent_name || ai?.display_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge bg-gray-100 text-gray-600">{run.triggered_by}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{run.input_summary || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          run.status === 'success' ? 'bg-green-100 text-green-700' :
                          run.status === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{run.tokens_input + run.tokens_output}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setDetail(run)} className="text-gray-400 hover:text-maroon-700"><Eye size={16} /></button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-xs text-gray-500">Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, total)} of {total}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-outline py-1 px-2"><ChevronLeft size={14} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-outline py-1 px-2"><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col fade-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold">Run Detail</h2>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Agent:</span> <span className="font-medium">{detail.agent_name}</span></div>
                <div><span className="text-gray-500">Status:</span> <span className={`badge ml-1 ${detail.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{detail.status}</span></div>
                <div><span className="text-gray-500">Triggered by:</span> <span className="font-medium">{detail.triggered_by}</span></div>
                <div><span className="text-gray-500">Tokens:</span> <span className="font-medium">{detail.tokens_input} in / {detail.tokens_output} out</span></div>
                <div><span className="text-gray-500">Duration:</span> <span className="font-medium">{detail.duration_ms ? `${detail.duration_ms}ms` : '—'}</span></div>
              </div>
              {detail.input_data && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Input Data</h4>
                  <pre className="bg-gray-900 text-gray-300 rounded-lg p-4 text-xs overflow-auto max-h-40 font-mono">{JSON.stringify(detail.input_data, null, 2)}</pre>
                </div>
              )}
              {detail.output_text && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Output</h4>
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-auto max-h-48 font-mono">{detail.output_text}</pre>
                </div>
              )}
              {detail.error_message && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-red-700">{detail.error_message}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
