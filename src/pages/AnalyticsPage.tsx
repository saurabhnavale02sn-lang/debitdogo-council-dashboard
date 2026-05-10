import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, IndianRupee, BarChart3, PieChart, Activity } from 'lucide-react';

interface Stats {
  totalBrands: number;
  totalTransactions: number;
  totalDiscrepancies: number;
  openDiscrepancies: number;
  totalClaims: number;
  resolvedClaims: number;
  totalDelta: number;
  totalRecovered: number;
  pendingRecovery: number;
  recoveryRate: number;
  totalInvoiced: number;
  totalPaid: number;
  avgRecoveryRate: number;
  discByType: Record<string, { count: number; amount: number }>;
  discByMarketplace: Record<string, { count: number; amount: number }>;
  discBySeverity: Record<string, number>;
  claimsByStatus: Record<string, number>;
  topBrands: { name: string; delta: number; recovered: number; rate: number }[];
  agentUsage: { name: string; icon: string; runs: number; successRate: number }[];
  monthlyTrend: { month: string; discrepancies: number; recovered: number }[];
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);

    const [brandsRes, discRes, claimsRes, invoicesRes, txnRes, agentsRes, runsRes] = await Promise.all([
      supabase.from('brands').select('id, name'),
      supabase.from('discrepancies').select('brand_id, discrepancy_type, marketplace, severity, status, delta_amount, expected_amount, actual_amount, created_at'),
      supabase.from('claims').select('brand_id, status, claim_amount, recovered_amount, marketplace, created_at'),
      supabase.from('invoices').select('brand_id, invoice_amount, total_payable, gst_amount, status'),
      supabase.from('transactions').select('brand_id, marketplace, settlement_amount, created_at').limit(50000),
      supabase.from('council_agents').select('display_name, icon, run_count, last_run_status'),
      supabase.from('council_agent_runs').select('agent_name, status, created_at').order('created_at', { ascending: false }).limit(1000),
    ]);

    const brands = brandsRes.data || [];
    const disc = discRes.data || [];
    const claims = claimsRes.data || [];
    const invoices = invoicesRes.data || [];
    const txn = txnRes.data || [];
    const agents = agentsRes.data || [];
    const runs = runsRes.data || [];

    const totalDelta = disc.reduce((s, d) => s + Math.abs(d.delta_amount || 0), 0);
    const totalRecovered = claims.reduce((s, c) => s + (c.recovered_amount || 0), 0);
    const pendingClaims = claims.filter(c => ['submitted', 'under_review', 'escalated'].includes(c.status));
    const pendingRecovery = pendingClaims.reduce((s, c) => s + (c.claim_amount || 0), 0);
    const resolvedClaims = claims.filter(c => ['recovered', 'partial_recovery'].includes(c.status));
    const openDisc = disc.filter(d => d.status === 'open' || d.status === 'confirmed');

    // Discrepancy breakdowns
    const discByType: Record<string, { count: number; amount: number }> = {};
    disc.forEach(d => {
      const t = d.discrepancy_type || 'unknown';
      if (!discByType[t]) discByType[t] = { count: 0, amount: 0 };
      discByType[t].count++;
      discByType[t].amount += Math.abs(d.delta_amount || 0);
    });

    const discByMarketplace: Record<string, { count: number; amount: number }> = {};
    disc.forEach(d => {
      const m = d.marketplace || 'unknown';
      if (!discByMarketplace[m]) discByMarketplace[m] = { count: 0, amount: 0 };
      discByMarketplace[m].count++;
      discByMarketplace[m].amount += Math.abs(d.delta_amount || 0);
    });

    const discBySeverity: Record<string, number> = {};
    disc.forEach(d => { discBySeverity[d.severity || 'medium'] = (discBySeverity[d.severity || 'medium'] || 0) + 1; });

    const claimsByStatus: Record<string, number> = {};
    claims.forEach(c => { claimsByStatus[c.status || 'unknown'] = (claimsByStatus[c.status || 'unknown'] || 0) + 1; });

    // Top brands by delta
    const brandMap: Record<string, { name: string; delta: number; recovered: number }> = {};
    brands.forEach(b => { brandMap[b.id] = { name: b.name, delta: 0, recovered: 0 }; });
    disc.forEach(d => { if (brandMap[d.brand_id]) brandMap[d.brand_id].delta += Math.abs(d.delta_amount || 0); });
    claims.forEach(c => { if (brandMap[c.brand_id]) brandMap[c.brand_id].recovered += (c.recovered_amount || 0); });
    const topBrands = Object.values(brandMap)
      .map(b => ({ ...b, rate: b.delta > 0 ? (b.recovered / b.delta) * 100 : 0 }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 10);

    // Agent usage
    const agentUsage = agents.map((a: any) => {
      const agentRuns = runs.filter(r => r.agent_name === a.display_name);
      const success = agentRuns.filter(r => r.status === 'success').length;
      return {
        name: a.display_name,
        icon: a.icon,
        runs: a.run_count || 0,
        successRate: agentRuns.length > 0 ? (success / agentRuns.length) * 100 : 0,
      };
    });

    // Monthly trend (last 6 months)
    const monthlyTrend: { month: string; discrepancies: number; recovered: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const y = d.getFullYear();
      const m = d.getMonth();
      const monthDisc = disc.filter(dd => { const cd = new Date(dd.created_at); return cd.getFullYear() === y && cd.getMonth() === m; });
      const monthClaims = claims.filter(c => { const cd = new Date(c.created_at); return cd.getFullYear() === y && cd.getMonth() === m; });
      monthlyTrend.push({
        month: monthStr,
        discrepancies: monthDisc.reduce((s, dd) => s + Math.abs(dd.delta_amount || 0), 0),
        recovered: monthClaims.reduce((s, c) => s + (c.recovered_amount || 0), 0),
      });
    }

    const totalInvoiced = invoices.reduce((s, i) => s + (i.total_payable || 0), 0);
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_payable || 0), 0);

    setStats({
      totalBrands: brands.length,
      totalTransactions: txn.length,
      totalDiscrepancies: disc.length,
      openDiscrepancies: openDisc.length,
      totalClaims: claims.length,
      resolvedClaims: resolvedClaims.length,
      totalDelta,
      totalRecovered,
      pendingRecovery,
      recoveryRate: totalDelta > 0 ? (totalRecovered / totalDelta) * 100 : 0,
      totalInvoiced,
      totalPaid,
      avgRecoveryRate: totalDelta > 0 ? (totalRecovered / totalDelta) * 100 : 0,
      discByType,
      discByMarketplace,
      discBySeverity,
      claimsByStatus,
      topBrands,
      agentUsage,
      monthlyTrend,
    });
    setLoading(false);
  };

  const formatINR = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-maroon-700 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const maxTrend = Math.max(...stats.monthlyTrend.map(t => Math.max(t.discrepancies, t.recovered)), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Analytics</h1>
      <p className="text-sm text-gray-500 mb-6">Deep insights across all brands, claims, and AI agents</p>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Total Leakage</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatINR(stats.totalDelta)}</p>
          <p className="text-xs text-gray-400">{stats.totalDiscrepancies} discrepancies found</p>
        </div>
        <div className="card p-5 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={16} className="text-green-500" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Recovered</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatINR(stats.totalRecovered)}</p>
          <p className="text-xs text-gray-400">{stats.resolvedClaims} claims resolved</p>
        </div>
        <div className="card p-5 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee size={16} className="text-yellow-500" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Pending</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{formatINR(stats.pendingRecovery)}</p>
          <p className="text-xs text-gray-400">{stats.totalClaims - stats.resolvedClaims} claims active</p>
        </div>
        <div className="card p-5 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Recovery Rate</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.recoveryRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-400">{stats.totalBrands} brands tracked</p>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-500 uppercase">Monthly Trend (Last 6 Months)</h3>
        </div>
        <div className="flex items-end gap-3 h-48">
          {stats.monthlyTrend.map((t, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-0.5 items-end w-full justify-center h-40">
                <div
                  className="w-5 bg-red-200 rounded-t transition-all"
                  style={{ height: `${maxTrend > 0 ? (t.discrepancies / maxTrend) * 100 : 0}%`, minHeight: t.discrepancies > 0 ? '4px' : '0' }}
                  title={`Leakage: ${formatINR(t.discrepancies)}`}
                />
                <div
                  className="w-5 bg-green-400 rounded-t transition-all"
                  style={{ height: `${maxTrend > 0 ? (t.recovered / maxTrend) * 100 : 0}%`, minHeight: t.recovered > 0 ? '4px' : '0' }}
                  title={`Recovered: ${formatINR(t.recovered)}`}
                />
              </div>
              <span className="text-[10px] text-gray-500">{t.month}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-200" /><span className="text-xs text-gray-500">Leakage Found</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-400" /><span className="text-xs text-gray-500">Recovered</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Discrepancy Types */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Discrepancy Types</h3>
          </div>
          {Object.keys(stats.discByType).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.discByType).sort((a, b) => b[1].amount - a[1].amount).map(([type, data]) => (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="text-gray-500">{data.count} · {formatINR(data.amount)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-maroon-700 rounded-full" style={{ width: `${(data.amount / stats.totalDelta) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Marketplace Breakdown */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Leakage by Marketplace</h3>
          </div>
          {Object.keys(stats.discByMarketplace).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.discByMarketplace).sort((a, b) => b[1].amount - a[1].amount).map(([mp, data]) => (
                <div key={mp}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 capitalize">{mp}</span>
                    <span className="text-gray-500">{data.count} issues · {formatINR(data.amount)}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(data.amount / stats.totalDelta) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Claims by Status */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Claims Pipeline</h3>
          {Object.keys(stats.claimsByStatus).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No claims yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.claimsByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const colors: Record<string, string> = {
                  submitted: 'bg-blue-500', under_review: 'bg-purple-500', escalated: 'bg-orange-500',
                  recovered: 'bg-green-500', partial_recovery: 'bg-teal-500', rejected: 'bg-red-500',
                  draft: 'bg-gray-400',
                };
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-700 flex-1 capitalize">{status.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[status] || 'bg-gray-400'}`} style={{ width: `${(count / stats.totalClaims) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Agent Performance */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase">AI Agent Performance</h3>
          </div>
          <div className="space-y-3">
            {stats.agentUsage.map(a => (
              <div key={a.name} className="flex items-center gap-3">
                <span className="text-lg">{a.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-gray-700 font-medium">{a.name}</span>
                    <span className="text-gray-500">{a.runs} runs</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${a.successRate}%` }} />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">{a.successRate.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Brands Table */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Top Brands by Leakage</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Brand</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Total Leakage</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Recovered</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Recovery Rate</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Progress</th>
              </tr>
            </thead>
            <tbody>
              {stats.topBrands.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No brand data yet</td></tr>
              ) : stats.topBrands.map((b, i) => (
                <tr key={b.name} className="border-b last:border-b-0">
                  <td className="py-2 text-gray-400 text-xs">{i + 1}</td>
                  <td className="py-2 font-medium text-gray-900">{b.name}</td>
                  <td className="py-2 text-right text-red-600">{formatINR(b.delta)}</td>
                  <td className="py-2 text-right text-green-600">{formatINR(b.recovered)}</td>
                  <td className="py-2 text-right">
                    <span className={`font-medium ${b.rate >= 50 ? 'text-green-600' : 'text-red-600'}`}>{b.rate.toFixed(1)}%</span>
                  </td>
                  <td className="py-2 px-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${b.rate >= 75 ? 'bg-green-500' : b.rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${Math.min(b.rate, 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
