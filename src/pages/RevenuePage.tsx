import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { IndianRupee, TrendingUp, Receipt, CreditCard, ArrowUpRight } from 'lucide-react';

export default function RevenuePage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [iRes, bRes, cRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('id, name, tier, monthly_gmv'),
      supabase.from('claims').select('brand_id, recovered_amount, status'),
    ]);
    setInvoices(iRes.data || []);
    setBrands(bRes.data || []);
    setClaims(cRes.data || []);
    setLoading(false);
  };

  const formatINR = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-3 border-maroon-700 border-t-transparent rounded-full animate-spin" /></div>;

  // Compute metrics
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_payable || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total_payable || 0), 0);
  const totalPending = invoices.filter(i => i.status === 'pending' || i.status === 'draft').reduce((s, i) => s + (i.total_payable || 0), 0);
  const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.total_payable || 0), 0);
  const totalCommission = invoices.reduce((s, i) => s + (i.invoice_amount || 0), 0);
  const totalGST = invoices.reduce((s, i) => s + (i.gst_amount || 0), 0);
  const totalRecoveredAll = claims.reduce((s, c) => s + (c.recovered_amount || 0), 0);
  const avgCommRate = invoices.length > 0 ? invoices.reduce((s, i) => s + (i.commission_rate || 0), 0) / invoices.length : 0;

  // Revenue by brand
  const brandRevenue: Record<string, { name: string; tier: string; invoiced: number; paid: number; count: number }> = {};
  invoices.forEach(inv => {
    const brand = brands.find(b => b.id === inv.brand_id);
    const bName = brand?.name || 'Unknown';
    if (!brandRevenue[inv.brand_id]) brandRevenue[inv.brand_id] = { name: bName, tier: brand?.tier || 'standard', invoiced: 0, paid: 0, count: 0 };
    brandRevenue[inv.brand_id].invoiced += inv.total_payable || 0;
    brandRevenue[inv.brand_id].count++;
    if (inv.status === 'paid') brandRevenue[inv.brand_id].paid += inv.total_payable || 0;
  });

  // Monthly revenue
  const monthlyRev: Record<string, { invoiced: number; paid: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    monthlyRev[key] = { invoiced: 0, paid: 0 };
  }
  invoices.forEach(inv => {
    const d = new Date(inv.created_at);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (monthlyRev[key]) {
      monthlyRev[key].invoiced += inv.total_payable || 0;
      if (inv.status === 'paid') monthlyRev[key].paid += inv.total_payable || 0;
    }
  });
  const maxMonthly = Math.max(...Object.values(monthlyRev).map(v => Math.max(v.invoiced, v.paid)), 1);

  // Projected monthly (based on pipeline)
  const pendingRecovery = claims.filter(c => ['submitted', 'under_review'].includes(c.status)).reduce((s, c) => s + (c.recovered_amount || 0), 0);
  const projectedCommission = pendingRecovery * avgCommRate;

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      paid: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700',
      draft: 'bg-gray-100 text-gray-600', overdue: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Revenue</h1>
      <p className="text-sm text-gray-500 mb-6">Commission revenue, invoicing, and financial overview</p>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-2">
            <IndianRupee size={16} className="text-green-500" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatINR(totalPaid)}</p>
          <p className="text-xs text-gray-400">Collected from clients</p>
        </div>
        <div className="card p-5 border-l-4 border-l-yellow-500">
          <div className="flex items-center gap-2 mb-2">
            <Receipt size={16} className="text-yellow-500" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Pending</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{formatINR(totalPending)}</p>
          <p className="text-xs text-gray-400">{invoices.filter(i => i.status === 'pending').length} invoices</p>
        </div>
        <div className="card p-5 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Pipeline</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatINR(projectedCommission)}</p>
          <p className="text-xs text-gray-400">From pending claims</p>
        </div>
        <div className="card p-5 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={16} className="text-purple-500" />
            <span className="text-xs text-gray-500 uppercase font-semibold">Avg Commission</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{(avgCommRate * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-400">Across {invoices.length} invoices</p>
        </div>
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Total Recovered (All Brands)</p>
            <p className="text-lg font-bold text-gray-900">{formatINR(totalRecoveredAll)}</p>
          </div>
          <ArrowUpRight size={20} className="text-green-500" />
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Your Commission</p>
            <p className="text-lg font-bold text-gray-900">{formatINR(totalCommission)}</p>
          </div>
          <IndianRupee size={20} className="text-maroon-700" />
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">GST Collected</p>
            <p className="text-lg font-bold text-gray-900">{formatINR(totalGST)}</p>
          </div>
          <Receipt size={20} className="text-gray-400" />
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="card p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Monthly Revenue</h3>
        <div className="flex items-end gap-3 h-40">
          {Object.entries(monthlyRev).map(([month, data], i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex gap-0.5 items-end w-full justify-center h-32">
                <div className="w-5 bg-gray-200 rounded-t" style={{ height: `${(data.invoiced / maxMonthly) * 100}%`, minHeight: data.invoiced > 0 ? '4px' : '0' }} title={`Invoiced: ${formatINR(data.invoiced)}`} />
                <div className="w-5 bg-green-400 rounded-t" style={{ height: `${(data.paid / maxMonthly) * 100}%`, minHeight: data.paid > 0 ? '4px' : '0' }} title={`Paid: ${formatINR(data.paid)}`} />
              </div>
              <span className="text-[10px] text-gray-500">{month}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-gray-200" /><span className="text-xs text-gray-500">Invoiced</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-400" /><span className="text-xs text-gray-500">Paid</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue by Brand */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Revenue by Brand</h3>
          {Object.keys(brandRevenue).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No invoice data</p>
          ) : (
            <div className="space-y-3">
              {Object.values(brandRevenue).sort((a, b) => b.invoiced - a.invoiced).map(br => (
                <div key={br.name} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-0.5">
                      <span className="text-gray-700 font-medium">{br.name}</span>
                      <span className="text-gray-500">{formatINR(br.invoiced)}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${totalInvoiced > 0 ? (br.paid / totalInvoiced) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <span className="badge bg-gray-100 text-gray-500 text-[10px]">{br.count} inv</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Recent Invoices</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No invoices yet</p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 10).map(inv => {
                const brand = brands.find(b => b.id === inv.brand_id);
                return (
                  <div key={inv.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{brand?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{(inv.commission_rate * 100).toFixed(0)}% of {formatINR(inv.recovered_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatINR(inv.total_payable)}</p>
                      <span className={`badge text-[10px] ${statusColor(inv.status)}`}>{inv.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
