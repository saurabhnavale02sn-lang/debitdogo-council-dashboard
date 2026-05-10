import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { AuditEntry } from '../types';
import { ShieldAlert, Search, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const ACTION_COLORS: Record<string, string> = {
  toggle_agent: 'bg-yellow-100 text-yellow-700',
  change_model: 'bg-blue-100 text-blue-700',
  update_prompt: 'bg-purple-100 text-purple-700',
  update_settings: 'bg-indigo-100 text-indigo-700',
  test_run: 'bg-green-100 text-green-700',
  create_user: 'bg-teal-100 text-teal-700',
  deactivate_user: 'bg-red-100 text-red-700',
  activate_user: 'bg-emerald-100 text-emerald-700',
};

export default function AuditLog() {
  const { isSuperAdmin } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  const perPage = 30;

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <ShieldAlert size={48} className="mb-4" />
        <h2 className="text-xl font-bold text-gray-600">Access Restricted</h2>
        <p className="text-sm mt-1">Only Super Admins can view the audit log.</p>
      </div>
    );
  }

  const fetchEntries = async () => {
    setLoading(true);
    let q = supabase
      .from('council_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1);

    if (filterAction) q = q.eq('action', filterAction);
    if (filterSearch) q = q.or(`user_email.ilike.%${filterSearch}%,target_name.ilike.%${filterSearch}%`);

    const { data, count } = await q;
    setEntries((data as AuditEntry[]) || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [page, filterAction, filterSearch]);

  const totalPages = Math.ceil(total / perPage);

  const actionLabel = (action: string) => action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Audit Log</h1>
      <p className="text-sm text-gray-500 mb-6">Track every configuration change across the council</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }} className="input-field w-auto">
          <option value="">All Actions</option>
          {Object.keys(ACTION_COLORS).map(a => (
            <option key={a} value={a}>{actionLabel(a)}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filterSearch}
            onChange={e => { setFilterSearch(e.target.value); setPage(0); }}
            placeholder="Search by user or target..."
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Target</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No audit entries yet.</td></tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{entry.user_email}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${entry.user_role === 'super_admin' ? 'bg-maroon-100 text-maroon-700' : 'bg-blue-100 text-blue-700'}`}>
                        {entry.user_role === 'super_admin' ? 'SUPER' : 'ADMIN'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-600'}`}>
                        {actionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="text-xs text-gray-400">{entry.target_type}:</span>{' '}
                      <span className="font-medium">{entry.target_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDetail(entry)} className="text-gray-400 hover:text-maroon-700"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col fade-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-bold">Audit Detail</h2>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">User:</span> <span className="font-medium">{detail.user_email}</span></div>
                <div><span className="text-gray-500">Role:</span> <span className="font-medium">{detail.user_role}</span></div>
                <div><span className="text-gray-500">Action:</span> <span className={`badge ml-1 ${ACTION_COLORS[detail.action] || 'bg-gray-100 text-gray-600'}`}>{actionLabel(detail.action)}</span></div>
                <div><span className="text-gray-500">Target:</span> <span className="font-medium">{detail.target_name}</span></div>
                <div className="col-span-2"><span className="text-gray-500">Time:</span> <span className="font-medium">{format(new Date(detail.created_at), 'PPpp')}</span></div>
              </div>

              {detail.old_value && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">Previous Value</h4>
                  <pre className="bg-gray-900 text-red-400 rounded-lg p-4 text-xs overflow-auto max-h-32 font-mono">{JSON.stringify(detail.old_value, null, 2)}</pre>
                </div>
              )}
              {detail.new_value && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-1">New Value</h4>
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs overflow-auto max-h-32 font-mono">{JSON.stringify(detail.new_value, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
