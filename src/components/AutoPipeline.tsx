import { useState, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, Download, X, Search, Sparkles, Send, AlertTriangle, Zap, RotateCcw } from 'lucide-react';
import { callEdgeFunction } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Props {
  brandId: string;
  onComplete: () => void;
}

type StepStatus = 'waiting' | 'running' | 'success' | 'error' | 'skipped';

interface PipelineStep {
  id: string;
  label: string;
  description: string;
  icon: any;
  status: StepStatus;
  result?: any;
  error?: string;
  duration?: number;
}

export default function AutoPipeline({ brandId, onComplete }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [marketplace, setMarketplace] = useState('amazon');
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: 'parse', label: 'Parse Settlement', description: 'Reading CSV and inserting transactions', icon: FileText, status: 'waiting' },
    { id: 'reconcile', label: 'Run Reconciliation', description: 'Scanning 16 rules for discrepancies', icon: Search, status: 'waiting' },
    { id: 'claim', label: 'AI Draft Claim', description: 'Claude generates professional claim email', icon: Sparkles, status: 'waiting' },
    { id: 'email', label: 'Send Claim Email', description: 'Dispatching via Resend', icon: Send, status: 'waiting' },
  ]);

  const updateStep = (id: string, updates: Partial<PipelineStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const runPipeline = async () => {
    if (!file) return;
    setRunning(true);
    setCompleted(false);

    // Reset all steps
    setSteps(prev => prev.map(s => ({ ...s, status: 'waiting' as StepStatus, result: undefined, error: undefined, duration: undefined })));

    let claimId: string | null = null;

    // ── Step 1: Parse Settlement ──
    updateStep('parse', { status: 'running' });
    let t0 = Date.now();
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) throw new Error('CSV is empty or invalid');

      const res = await callEdgeFunction('parseSettlement', {
        brand_id: brandId,
        file_name: file.name,
        file_type: 'settlement',
        marketplace,
        settlement_period: period,
        rows,
      });
      if (res.error) throw new Error(res.error);

      updateStep('parse', { status: 'success', result: res, duration: Date.now() - t0 });
      toast.success(`Parsed ${res.inserted} transactions`);
    } catch (err: any) {
      updateStep('parse', { status: 'error', error: err.message, duration: Date.now() - t0 });
      toast.error(`Parse failed: ${err.message}`);
      setRunning(false);
      return;
    }

    await sleep(500); // Brief pause so user sees the step complete

    // ── Step 2: Run Reconciliation ──
    updateStep('reconcile', { status: 'running' });
    t0 = Date.now();
    try {
      const res = await callEdgeFunction('runReconciliation', { brand_id: brandId });
      if (res.error) throw new Error(res.error);

      updateStep('reconcile', { status: 'success', result: res, duration: Date.now() - t0 });
      toast.success(`Found ${res.total_discrepancies} discrepancies`);

      if (res.total_discrepancies === 0) {
        updateStep('claim', { status: 'skipped', error: 'No discrepancies found — nothing to claim' });
        updateStep('email', { status: 'skipped', error: 'No claim to send' });
        setRunning(false);
        setCompleted(true);
        onComplete();
        return;
      }
    } catch (err: any) {
      updateStep('reconcile', { status: 'error', error: err.message, duration: Date.now() - t0 });
      toast.error(`Reconciliation failed: ${err.message}`);
      setRunning(false);
      return;
    }

    await sleep(500);

    // ── Step 3: AI Draft Claim ──
    updateStep('claim', { status: 'running' });
    t0 = Date.now();
    try {
      const res = await callEdgeFunction('draftClaim', { brand_id: brandId });
      if (res.error) throw new Error(res.error);

      claimId = res.claim_id;
      updateStep('claim', { status: 'success', result: res, duration: Date.now() - t0 });
      toast.success(`Claim drafted: ₹${res.total_amount?.toLocaleString('en-IN')}`);
    } catch (err: any) {
      updateStep('claim', { status: 'error', error: err.message, duration: Date.now() - t0 });
      toast.error(`Claim draft failed: ${err.message}`);
      updateStep('email', { status: 'skipped', error: 'No claim was drafted' });
      setRunning(false);
      return;
    }

    await sleep(500);

    // ── Step 4: Send Email ──
    updateStep('email', { status: 'running' });
    t0 = Date.now();
    try {
      const res = await callEdgeFunction('sendClaimEmail', { claim_id: claimId });
      if (res.error) throw new Error(res.error);

      updateStep('email', { status: 'success', result: res, duration: Date.now() - t0 });
      if (res.email_sent) {
        toast.success(`Email sent to ${res.recipient}`);
      } else {
        toast.success('Claim submitted — ' + (res.note || 'check email config'));
      }
    } catch (err: any) {
      updateStep('email', { status: 'error', error: err.message, duration: Date.now() - t0 });
      toast.error(`Email failed: ${err.message}`);
    }

    setRunning(false);
    setCompleted(true);
    onComplete();
  };

  const resetPipeline = () => {
    setFile(null);
    setCompleted(false);
    setSteps(prev => prev.map(s => ({ ...s, status: 'waiting' as StepStatus, result: undefined, error: undefined, duration: undefined })));
  };

  const downloadSample = () => {
    window.open('/sample_settlement.csv', '_blank');
  };

  const totalDuration = steps.reduce((s, st) => s + (st.duration || 0), 0);
  const successCount = steps.filter(s => s.status === 'success').length;
  const hasErrors = steps.some(s => s.status === 'error');

  const stepStatusIcon = (step: PipelineStep) => {
    if (step.status === 'running') return <Loader2 size={18} className="animate-spin text-maroon-700" />;
    if (step.status === 'success') return <CheckCircle2 size={18} className="text-green-600" />;
    if (step.status === 'error') return <AlertTriangle size={18} className="text-red-500" />;
    if (step.status === 'skipped') return <X size={18} className="text-gray-400" />;
    return <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300" />;
  };

  const stepBg = (step: PipelineStep) => {
    if (step.status === 'running') return 'border-maroon-200 bg-maroon-50/30';
    if (step.status === 'success') return 'border-green-200 bg-green-50/30';
    if (step.status === 'error') return 'border-red-200 bg-red-50/30';
    if (step.status === 'skipped') return 'border-gray-200 bg-gray-50/50 opacity-60';
    return 'border-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Zap size={20} className="text-maroon-700" />
            Automated Recovery Pipeline
          </h3>
          <button onClick={downloadSample} className="text-xs text-maroon-700 hover:underline flex items-center gap-1">
            <Download size={12} /> Sample CSV
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-5">
          Upload a settlement file and the pipeline runs automatically: Parse → Reconcile → AI Claim → Send Email
        </p>

        {/* File Drop Zone */}
        <div
          onClick={() => !running && fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${running ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${file ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-maroon-300 hover:bg-maroon-50/10'}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={running}
            onChange={e => { setFile(e.target.files?.[0] || null); setCompleted(false); setSteps(prev => prev.map(s => ({ ...s, status: 'waiting' as StepStatus, result: undefined, error: undefined, duration: undefined }))); }}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={28} className="text-green-600" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              {!running && (
                <button onClick={e => { e.stopPropagation(); setFile(null); setCompleted(false); }} className="text-gray-400 hover:text-red-500 ml-2">
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <>
              <Upload size={36} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-600">Drop your settlement CSV here</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse &middot; .csv with order_id, amount, commission columns</p>
            </>
          )}
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Marketplace</label>
            <select value={marketplace} onChange={e => setMarketplace(e.target.value)} disabled={running} className="input-field text-sm">
              <option value="amazon">Amazon</option>
              <option value="flipkart">Flipkart</option>
              <option value="meesho">Meesho</option>
              <option value="myntra">Myntra</option>
              <option value="ajio">AJIO</option>
              <option value="nykaa">Nykaa</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Period</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} disabled={running} className="input-field text-sm" />
          </div>
          <div className="sm:col-span-2 flex items-end">
            {completed ? (
              <button onClick={resetPipeline} className="btn-outline w-full flex items-center justify-center gap-2 py-2.5">
                <RotateCcw size={16} /> Run Another File
              </button>
            ) : (
              <button
                onClick={runPipeline}
                disabled={!file || running}
                className="btn-maroon w-full flex items-center justify-center gap-2 py-2.5 text-base"
              >
                {running ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                {running ? 'Pipeline Running...' : 'Start Pipeline'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Steps */}
      {(running || completed || hasErrors) && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase">Pipeline Progress</h3>
            {completed && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{successCount}/4 steps completed</span>
                <span>&middot;</span>
                <span>{(totalDuration / 1000).toFixed(1)}s total</span>
              </div>
            )}
          </div>

          {/* Vertical timeline */}
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={step.id}>
                {/* Connector line */}
                {i > 0 && (
                  <div className="ml-[21px] w-0.5 h-3 bg-gray-200" style={{
                    backgroundColor: steps[i - 1].status === 'success' ? '#16a34a' : steps[i - 1].status === 'error' ? '#ef4444' : '#e5e7eb'
                  }} />
                )}

                {/* Step card */}
                <div className={`border rounded-xl p-4 transition-all ${stepBg(step)}`}>
                  <div className="flex items-center gap-3">
                    {stepStatusIcon(step)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{step.label}</p>
                        {step.duration && (
                          <span className="text-[10px] text-gray-400">{(step.duration / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{step.description}</p>
                    </div>
                    <step.icon size={16} className="text-gray-300 flex-shrink-0" />
                  </div>

                  {/* Step result details */}
                  {step.status === 'success' && step.result && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {step.id === 'parse' && (
                        <div className="flex gap-4 text-xs">
                          <span className="text-gray-500">Rows: <span className="font-medium text-gray-900">{step.result.total_rows}</span></span>
                          <span className="text-gray-500">Inserted: <span className="font-medium text-green-600">{step.result.inserted}</span></span>
                          <span className="text-gray-500">File: <span className="font-medium text-gray-700">{step.result.file_id?.slice(0, 8)}...</span></span>
                        </div>
                      )}
                      {step.id === 'reconcile' && (
                        <div className="space-y-1">
                          <div className="flex gap-4 text-xs">
                            <span className="text-gray-500">Rules: <span className="font-medium text-gray-900">{step.result.rules_run}</span></span>
                            <span className="text-gray-500">Discrepancies: <span className="font-bold text-red-600">{step.result.total_discrepancies}</span></span>
                          </div>
                          {step.result.results?.filter((r: any) => r.matches > 0).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {step.result.results.filter((r: any) => r.matches > 0).map((r: any) => (
                                <span key={r.rule_id} className="badge bg-red-50 text-red-600 text-[10px]">
                                  {r.rule_name}: {r.matches}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {step.id === 'claim' && (
                        <div className="space-y-2">
                          <div className="flex gap-4 text-xs">
                            <span className="text-gray-500">Amount: <span className="font-bold text-maroon-700">₹{step.result.total_amount?.toLocaleString('en-IN')}</span></span>
                            <span className="text-gray-500">Discrepancies: <span className="font-medium text-gray-900">{step.result.discrepancies_claimed}</span></span>
                            <span className={`badge text-[10px] ${step.result.ai_generated ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                              {step.result.ai_generated ? 'AI Generated' : 'Template'}
                            </span>
                          </div>
                          {step.result.subject && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-700 mb-1">{step.result.subject}</p>
                              <p className="text-[11px] text-gray-500 line-clamp-3">{step.result.body?.slice(0, 200)}...</p>
                            </div>
                          )}
                        </div>
                      )}
                      {step.id === 'email' && (
                        <div className="flex gap-4 text-xs">
                          <span className="text-gray-500">Sent: <span className="font-medium text-green-600">{step.result.email_sent ? 'Yes' : 'Queued'}</span></span>
                          {step.result.recipient && <span className="text-gray-500">To: <span className="font-medium text-gray-900">{step.result.recipient}</span></span>}
                          {step.result.note && <span className="text-gray-400 italic">{step.result.note}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error message */}
                  {(step.status === 'error' || step.status === 'skipped') && step.error && (
                    <p className="mt-2 text-xs text-red-500">{step.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Completion banner */}
          {completed && !hasErrors && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-700">Pipeline Complete!</p>
                <p className="text-xs text-green-600">
                  Settlement parsed, discrepancies found, claim drafted and sent — all automatically.
                  Check the Discrepancies and Claims tabs to review.
                </p>
              </div>
            </div>
          )}

          {completed && hasErrors && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle size={24} className="text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-yellow-700">Pipeline completed with issues</p>
                <p className="text-xs text-yellow-600">
                  Some steps failed. Check the errors above and try again.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
