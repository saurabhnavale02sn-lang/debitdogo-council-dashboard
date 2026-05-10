import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2, Clock, TrendingUp, IndianRupee } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Brand {
  id: string; name: string; tier: string; category: string; monthly_gmv: number;
  marketplaces: string[]; contact_email: string; contact_phone: string; gstin: string; pan: string; created_at: string;
}

export default function ClientDetailPage() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'discrepancies' | 'claims' | 'files' | 'invoices'>('overview');

  useEffect(() => {
    if (!brandId) return;
    fetchAll();
  }, [brandId]);

  const fetchAll = async () => {
    setLoading(true);
    const [bRes, fRes, dRes, cRes, iRes] = await Promise.all([
      supabase.from('brands').select('*').eq('id', brandId).single(),
      supabase.from('settlement_files').select('*').eq('brand_id', brandId).order('uploaded_at', { ascending: false }),
      supabase.from('discrepancies').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
      supabase.from('claims').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
    ]);
    setBrand(bRes.data as Brand);
    setFiles(fRes.data || []);
    setDiscrepancies(dRes.data || []);
    setClaims(cRes.data || []);
    setInvoices(iRes.data || []);
    setLoading(false);
  };

  const formatINR = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-maroon-700 border-t-transparent rounded-full animate-spin" /></div>;
  if (!brand) return <div className="text-center py-20 text-gray-400">Brand not found</div>;

  // Compute stats
  const totalDelta = discrepancies.reduce((s, d) => s + Math.abs(d.delta_amount || 0), 0);
  const totalRecovered = claims.reduce((s, c) => s + (c.recovered_amount || 0), 0);
  const pendingClaims = claims.filter(c => ['submitted', 'under_review', 'escalated'].includes(c.status));
  const resolvedClaims = claims.filter(c => c.status === 'recovered' || c.status === 'partial_recovery');
  const openDisc = discrepancies.filter(d => d.status === 'open' || d.status === 'confirmed');
  const recoveryRate = totalDelta > 0 ? (totalRecovered / totalDelta) * 100 : 0;
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_payable || 0), 0);
  const paidInvoices = invoices.filter(i => i.status === 'paid');

  // Discrepancy type breakdown
  const discByType: Record<string, number> = {};
  discrepancies.forEach(d => { discByType[d.discrepancy_type] = (discByType[d.discrepancy_type] || 0) + 1; });

  // Marketplace breakdown
  const discByMarket: Record<string, number> = {};
  discrepancies.forEach(d => { discByMarket[d.marketplace] = (discByMarket[d.marketplace] || 0) + Math.abs(d.delta_amount || 0); });

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-orange-100 text-orange-700',
      claimed: 'bg-blue-100 text-blue-700', recovered: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700', submitted: 'bg-blue-100 text-blue-700',
      under_review: 'bg-purple-100 text-purple-700', escalated: 'bg-orange-100 text-orange-700',
      partial_recovery: 'bg-teal-100 text-teal-700', paid: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700', draft: 'bg-gray-100 text-gray-600',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'discrepancies', label: `Discrepancies (${discrepancies.length})` },
    { key: 'claims', label: `Claims (${claims.length})` },
    { key: 'files', label: `Files (${files.length})` },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
  ] as const;

  return (
    <div>
      {/* Header */}
      <button onClick={() => navigate('/clients')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-maroon-700 mb-4">
        <ArrowLeft size={14} /> Back to Clients
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{brand.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="badge bg-gray-100 text-gray-600">{brand.tier?.toUpperCase()}</span>
            <span className="text-sm text-gray-400">{brand.category}</span>
            <span className="text-sm text-gray-400">{brand.contact_email}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Monthly GMV</p>
          <p className="text-xl font-bold text-gray-900">{formatINR(brand.monthly_gmv)}</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <div className="card p-4 text-center">
          <AlertTriangle size={18} className="mx-auto text-yellow-500 mb-1" />
          <p className="text-xl font-bold text-gray-900">{discrepancies.length}</p>
          <p className="text-[10px] text-gray-500 uppercase">Discrepancies</p>
          {openDisc.length > 0 && <p className="text-xs text-red-500 mt-1">{openDisc.length} open</p>}
        </div>
        <div className="card p-4 text-center">
          <IndianRupee size={18} className="mx-auto text-red-500 mb-1" />
          <p className="text-xl font-bold text-gray-900">{formatINR(totalDelta)}</p>
          <p className="text-[10px] text-gray-500 uppercase">Total Delta</p>
        </div>
        <div className="card p-4 text-center">
          <CheckCircle2 size={18} className="mx-auto text-green-500 mb-1" />
          <p className="text-xl font-bold text-green-600">{formatINR(totalRecovered)}</p>
          <p className="text-[10px] text-gray-500 uppercase">Recovered</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp size={18} className="mx-auto text-blue-500 mb-1" />
          <p className="text-xl font-bold text-blue-600">{recoveryRate.toFixed(1)}%</p>
          <p className="text-[10px] text-gray-500 uppercase">Recovery Rate</p>
        </div>
        <div className="card p-4 text-center">
          <Clock size={18} className="mx-auto text-orange-500 mb-1" />
          <p className="text-xl font-bold text-gray-900">{pendingClaims.length}</p>
          <p className="text-[10px] text-gray-500 uppercase">Pending Claims</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-maroon-700 text-maroon-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Discrepancy Types */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Discrepancy Breakdown by Type</h3>
            {Object.keys(discByType).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No discrepancies yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(discByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-maroon-700 rounded-full" style={{ width: `${(count / discrepancies.length) * 100}%` }} />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Marketplace Delta */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Delta by Marketplace</h3>
            {Object.keys(discByMarket).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No marketplace data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(discByMarket).sort((a, b) => b[1] - a[1]).map(([mp, amount]) => (
                  <div key={mp} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 capitalize">{mp}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${totalDelta > 0 ? (amount / totalDelta) * 100 : 0}%` }} />
                      </div>
                      <span className="text-sm font-medium text-red-600 w-20 text-right">{formatINR(amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Brand Info */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Brand Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">GSTIN:</span> <span className="font-mono text-gray-700">{brand.gstin || '—'}</span></div>
              <div><span className="text-gray-500">PAN:</span> <span className="font-mono text-gray-700">{brand.pan || '—'}</span></div>
              <div><span className="text-gray-500">Phone:</span> <span className="text-gray-700">{brand.contact_phone || '—'}</span></div>
              <div><span className="text-gray-500">Category:</span> <span className="text-gray-700">{brand.category || '—'}</span></div>
              <div><span className="text-gray-500">Marketplaces:</span> <span className="text-gray-700">{(brand.marketplaces || []).join(', ') || '—'}</span></div>
              <div><span className="text-gray-500">Joined:</span> <span className="text-gray-700">{formatDistanceToNow(new Date(brand.created_at), { addSuffix: true })}</span></div>
            </div>
          </div>

          {/* Revenue from this client */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Revenue</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-green-600">{formatINR(totalInvoiced)}</p>
                <p className="text-xs text-gray-500">Total Invoiced</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-600">{paidInvoices.length}/{invoices.length}</p>
                <p className="text-xs text-gray-500">Invoices Paid</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'discrepancies' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Marketplace</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Expected</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actual</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Delta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Severity</th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No discrepancies found</td></tr>
              ) : discrepancies.map(d => (
                <tr key={d.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{d.order_id}</td>
                  <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-600 text-xs">{d.discrepancy_type?.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-3 capitalize text-gray-600">{d.marketplace}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatINR(d.expected_amount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatINR(d.actual_amount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">{formatINR(Math.abs(d.delta_amount))}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusColor(d.status)}`}>{d.status}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${d.severity === 'critical' ? 'bg-red-100 text-red-700' : d.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.severity}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'claims' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Claim Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Marketplace</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Claimed</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recovered</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Escalation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody>
              {claims.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No claims found</td></tr>
              ) : claims.map(c => (
                <tr key={c.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.claim_reference || '—'}</td>
                  <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-600 text-xs">{c.claim_type?.replace(/_/g, ' ')}</span></td>
                  <td className="px-4 py-3 capitalize text-gray-600">{c.marketplace}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatINR(c.claim_amount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">{formatINR(c.recovered_amount)}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusColor(c.status)}`}>{c.status}</span></td>
                  <td className="px-4 py-3 text-gray-500">L{c.escalation_level || 0}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'files' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">File Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Marketplace</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Period</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rows</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No files uploaded</td></tr>
              ) : files.map(f => (
                <tr key={f.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 flex items-center gap-2"><FileText size={14} className="text-gray-400" /><span className="text-gray-700 truncate max-w-[200px]">{f.file_name}</span></td>
                  <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-600">{f.file_type}</span></td>
                  <td className="px-4 py-3 capitalize text-gray-600">{f.marketplace}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{f.period_start || '—'} → {f.period_end || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{f.total_rows || 0}</td>
                  <td className="px-4 py-3"><span className={`badge ${f.parse_status === 'success' ? 'bg-green-100 text-green-700' : f.parse_status === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{f.parse_status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDistanceToNow(new Date(f.uploaded_at), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'invoices' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recovered</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Commission</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">GST</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total Payable</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No invoices yet</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="border-b last:border-b-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.id?.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatINR(inv.recovered_amount)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatINR(inv.invoice_amount)} ({(inv.commission_rate * 100).toFixed(0)}%)</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatINR(inv.gst_amount)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatINR(inv.total_payable)}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusColor(inv.status)}`}>{inv.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{inv.due_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
