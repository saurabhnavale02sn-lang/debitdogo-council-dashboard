import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, TrendingUp, TrendingDown, Building2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BrandSummary {
  id: string;
  name: string;
  tier: string;
  category: string;
  monthly_gmv: number;
  marketplaces: string[];
  contact_email: string;
  created_at: string;
  // Computed
  total_transactions: number;
  total_discrepancies: number;
  open_discrepancies: number;
  total_claims: number;
  recovered_amount: number;
  pending_amount: number;
  total_delta: number;
  recovery_rate: number;
  health_score: number;
}

export default function ClientsPage() {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'monthly_gmv' | 'recovery_rate' | 'health_score'>('name');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBrandSummaries();
  }, []);

  const fetchBrandSummaries = async () => {
    setLoading(true);

    // Fetch brands
    const { data: brandsData } = await supabase.from('brands').select('*').order('name');
    if (!brandsData) { setLoading(false); return; }

    const { data: allDisc } = await supabase.from('discrepancies').select('brand_id, status, delta_amount');
    const { data: allClaims } = await supabase.from('claims').select('brand_id, status, claim_amount, recovered_amount');
    const { data: allTxn } = await supabase.from('transactions').select('brand_id').limit(10000);

    const summaries: BrandSummary[] = brandsData.map((b: any) => {
      const brandDisc = (allDisc || []).filter((d: any) => d.brand_id === b.id);
      const brandClaims = (allClaims || []).filter((c: any) => c.brand_id === b.id);
      const brandTxn = (allTxn || []).filter((t: any) => t.brand_id === b.id);

      const totalDelta = brandDisc.reduce((s: number, d: any) => s + Math.abs(d.delta_amount || 0), 0);
      const recovered = brandClaims.reduce((s: number, c: any) => s + (c.recovered_amount || 0), 0);
      const pending = brandClaims.filter((c: any) => ['submitted', 'under_review', 'escalated'].includes(c.status)).reduce((s: number, c: any) => s + (c.claim_amount || 0), 0);
      const openDisc = brandDisc.filter((d: any) => d.status === 'open' || d.status === 'confirmed').length;
      const recoveryRate = totalDelta > 0 ? (recovered / totalDelta) * 100 : 0;

      // Health score: 0-100 based on recovery rate, open issues, activity
      let health = 50;
      health += Math.min(recoveryRate * 0.3, 30); // Up to 30 pts for recovery
      health -= Math.min(openDisc * 2, 20); // Lose up to 20 for open issues
      health += brandTxn.length > 0 ? 10 : 0; // 10 pts for having data
      health = Math.max(0, Math.min(100, Math.round(health)));

      return {
        id: b.id,
        name: b.name,
        tier: b.tier || 'standard',
        category: b.category || '—',
        monthly_gmv: b.monthly_gmv || 0,
        marketplaces: b.marketplaces || [],
        contact_email: b.contact_email || '',
        created_at: b.created_at,
        total_transactions: brandTxn.length,
        total_discrepancies: brandDisc.length,
        open_discrepancies: openDisc,
        total_claims: brandClaims.length,
        recovered_amount: recovered,
        pending_amount: pending,
        total_delta: totalDelta,
        recovery_rate: recoveryRate,
        health_score: health,
      };
    });

    setBrands(summaries);
    setLoading(false);
  };

  const filtered = brands
    .filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.contact_email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'monthly_gmv') return b.monthly_gmv - a.monthly_gmv;
      if (sortBy === 'recovery_rate') return b.recovery_rate - a.recovery_rate;
      return b.health_score - a.health_score;
    });

  const formatINR = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const healthColor = (score: number) => {
    if (score >= 75) return 'text-green-600 bg-green-50';
    if (score >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const tierColor = (tier: string) => {
    if (tier === 'enterprise') return 'bg-purple-100 text-purple-700';
    if (tier === 'premium') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  // Aggregate stats
  const totalRecovered = brands.reduce((s, b) => s + b.recovered_amount, 0);
  const totalPending = brands.reduce((s, b) => s + b.pending_amount, 0);
  const totalOpenDisc = brands.reduce((s, b) => s + b.open_discrepancies, 0);
  const avgHealth = brands.length > 0 ? Math.round(brands.reduce((s, b) => s + b.health_score, 0) / brands.length) : 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500">Track all brands, recovery progress, and health scores</p>
        </div>
        <span className="badge bg-maroon-100 text-maroon-700 text-sm">{brands.length} Brands</span>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total Recovered</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatINR(totalRecovered)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Pending Recovery</p>
          <p className="text-xl font-bold text-yellow-600 mt-1">{formatINR(totalPending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Open Discrepancies</p>
          <p className="text-xl font-bold text-red-600 mt-1">{totalOpenDisc}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Avg Health Score</p>
          <p className={`text-xl font-bold mt-1 ${avgHealth >= 75 ? 'text-green-600' : avgHealth >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{avgHealth}/100</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search brands..."
            className="input-field pl-9"
          />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input-field w-auto">
          <option value="name">Sort: Name</option>
          <option value="monthly_gmv">Sort: GMV (High→Low)</option>
          <option value="recovery_rate">Sort: Recovery Rate</option>
          <option value="health_score">Sort: Health Score</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Brand</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Marketplaces</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Monthly GMV</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Discrepancies</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recovered</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recovery %</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Health</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  <Building2 size={32} className="mx-auto mb-2 text-gray-300" />
                  No brands found. Add brands via Supabase or the brand dashboard.
                </td></tr>
              ) : (
                filtered.map(b => (
                  <tr key={b.id} className="border-b last:border-b-0 hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/clients/${b.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-400">{b.contact_email || b.category}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${tierColor(b.tier)}`}>{b.tier.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(b.marketplaces || []).map((m: string) => (
                          <span key={m} className="badge bg-gray-100 text-gray-600 text-[10px]">{m}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">{formatINR(b.monthly_gmv)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-900">{b.total_discrepancies}</span>
                      {b.open_discrepancies > 0 && (
                        <span className="ml-1 text-xs text-red-500">({b.open_discrepancies} open)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{formatINR(b.recovered_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {b.recovery_rate >= 50 ? <TrendingUp size={12} className="text-green-500" /> : <TrendingDown size={12} className="text-red-500" />}
                        <span className={`font-medium ${b.recovery_rate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                          {b.recovery_rate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${healthColor(b.health_score)}`}>
                        {b.health_score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-gray-400 hover:text-maroon-700"><Eye size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
