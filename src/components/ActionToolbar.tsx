import { useState } from 'react';
import { Search, Sparkles, Send, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { callEdgeFunction } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Props {
  brandId: string;
  hasDiscrepancies: boolean;
  hasDraftedClaims: boolean;
  onComplete: () => void;
}

interface StepResult {
  status: 'idle' | 'running' | 'success' | 'error';
  data?: any;
  error?: string;
}

export default function ActionToolbar({ brandId, hasDiscrepancies, hasDraftedClaims, onComplete }: Props) {
  const [reconResult, setReconResult] = useState<StepResult>({ status: 'idle' });
  const [claimResult, setClaimResult] = useState<StepResult>({ status: 'idle' });
  const [emailResult, setEmailResult] = useState<StepResult>({ status: 'idle' });
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [claimPreview, setClaimPreview] = useState<{ subject: string; body: string; claim_id: string } | null>(null);

  // Step 1: Run Reconciliation
  const runReconciliation = async () => {
    setReconResult({ status: 'running' });
    try {
      const res = await callEdgeFunction('runReconciliation', { brand_id: brandId });
      if (res.error) {
        setReconResult({ status: 'error', error: res.error });
        toast.error(res.error);
      } else {
        setReconResult({ status: 'success', data: res });
        toast.success(`Found ${res.total_discrepancies} discrepancies across ${res.rules_run} rules`);
        onComplete();
      }
    } catch (err: any) {
      setReconResult({ status: 'error', error: err.message });
      toast.error('Reconciliation failed');
    }
  };

  // Step 2: Draft AI Claim
  const draftClaim = async () => {
    setClaimResult({ status: 'running' });
    setClaimPreview(null);
    try {
      const res = await callEdgeFunction('draftClaim', { brand_id: brandId });
      if (res.error) {
        setClaimResult({ status: 'error', error: res.error });
        toast.error(res.error);
      } else {
        setClaimResult({ status: 'success', data: res });
        setClaimPreview({ subject: res.subject, body: res.body, claim_id: res.claim_id });
        toast.success(`Claim drafted for ₹${res.total_amount?.toLocaleString('en-IN')} (${res.discrepancies_claimed} discrepancies)`);
        onComplete();
      }
    } catch (err: any) {
      setClaimResult({ status: 'error', error: err.message });
      toast.error('Claim drafting failed');
    }
  };

  // Step 3: Send Email
  const sendEmail = async () => {
    if (!claimPreview?.claim_id) {
      toast.error('Draft a claim first');
      return;
    }
    setEmailResult({ status: 'running' });
    try {
      const res = await callEdgeFunction('sendClaimEmail', { claim_id: claimPreview.claim_id });
      if (res.error) {
        setEmailResult({ status: 'error', error: res.error });
        toast.error(res.error);
      } else {
        setEmailResult({ status: 'success', data: res });
        toast.success(res.email_sent ? `Email sent to ${res.recipient}` : 'Claim marked as submitted (email provider note: ' + (res.note || 'check Resend config') + ')');
        onComplete();
      }
    } catch (err: any) {
      setEmailResult({ status: 'error', error: err.message });
      toast.error('Email sending failed');
    }
  };

  const stepIcon = (result: StepResult) => {
    if (result.status === 'running') return <Loader2 size={16} className="animate-spin text-maroon-700" />;
    if (result.status === 'success') return <CheckCircle2 size={16} className="text-green-600" />;
    if (result.status === 'error') return <AlertTriangle size={16} className="text-red-500" />;
    return null;
  };

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-maroon-700" />
        Recovery Pipeline
      </h3>

      <div className="space-y-3">
        {/* Step 1: Reconciliation */}
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-maroon-700 text-white flex items-center justify-center text-xs font-bold">1</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Run Reconciliation</p>
                <p className="text-xs text-gray-400">Scan transactions against 16 rules to find discrepancies</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stepIcon(reconResult)}
              <button
                onClick={runReconciliation}
                disabled={reconResult.status === 'running'}
                className="btn-maroon text-xs px-3 py-1.5 flex items-center gap-1"
              >
                <Search size={12} />
                {reconResult.status === 'running' ? 'Scanning...' : 'Scan'}
              </button>
              {reconResult.data && (
                <button onClick={() => setExpandedStep(expandedStep === 1 ? null : 1)} className="text-gray-400 hover:text-gray-600">
                  {expandedStep === 1 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              )}
            </div>
          </div>
          {expandedStep === 1 && reconResult.data && (
            <div className="p-4 border-t bg-white">
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-blue-600">{reconResult.data.rules_run}</p>
                  <p className="text-xs text-gray-500">Rules Run</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-red-600">{reconResult.data.total_discrepancies}</p>
                  <p className="text-xs text-gray-500">Discrepancies</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-green-600">{reconResult.data.results?.filter((r: any) => r.status === 'completed').length}</p>
                  <p className="text-xs text-gray-500">Rules OK</p>
                </div>
              </div>
              <div className="max-h-40 overflow-auto text-xs">
                {reconResult.data.results?.filter((r: any) => r.matches > 0).map((r: any) => (
                  <div key={r.rule_id} className="flex justify-between py-1 border-b last:border-b-0">
                    <span className="text-gray-700">{r.rule_name}</span>
                    <span className="font-medium text-red-600">{r.matches} found</span>
                  </div>
                ))}
                {reconResult.data.results?.filter((r: any) => r.matches > 0).length === 0 && (
                  <p className="text-gray-400 text-center py-2">No discrepancies detected</p>
                )}
              </div>
            </div>
          )}
          {reconResult.error && (
            <div className="p-3 border-t bg-red-50 text-xs text-red-600">{reconResult.error}</div>
          )}
        </div>

        {/* Step 2: AI Claim */}
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${hasDiscrepancies || reconResult.status === 'success' ? 'bg-maroon-700 text-white' : 'bg-gray-300 text-gray-500'}`}>2</div>
              <div>
                <p className="text-sm font-medium text-gray-900">AI Draft Claim</p>
                <p className="text-xs text-gray-400">Claude AI generates a professional claim email</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stepIcon(claimResult)}
              <button
                onClick={draftClaim}
                disabled={claimResult.status === 'running'}
                className="btn-maroon text-xs px-3 py-1.5 flex items-center gap-1"
              >
                <Sparkles size={12} />
                {claimResult.status === 'running' ? 'Drafting...' : 'Draft'}
              </button>
              {claimPreview && (
                <button onClick={() => setExpandedStep(expandedStep === 2 ? null : 2)} className="text-gray-400 hover:text-gray-600">
                  {expandedStep === 2 ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              )}
            </div>
          </div>
          {expandedStep === 2 && claimPreview && (
            <div className="p-4 border-t bg-white">
              <div className="mb-2">
                <p className="text-xs text-gray-500 uppercase font-semibold">Subject</p>
                <p className="text-sm text-gray-900 font-medium">{claimPreview.subject}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Body</p>
                <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap max-h-48 overflow-auto font-sans leading-relaxed">{claimPreview.body}</pre>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`badge ${claimResult.data?.ai_generated ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                  {claimResult.data?.ai_generated ? 'AI Generated' : 'Template'}
                </span>
                <span className="text-xs text-gray-400">
                  {claimResult.data?.discrepancies_claimed} discrepancies &middot; ₹{claimResult.data?.total_amount?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
          {claimResult.error && (
            <div className="p-3 border-t bg-red-50 text-xs text-red-600">{claimResult.error}</div>
          )}
        </div>

        {/* Step 3: Send Email */}
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${claimPreview || hasDraftedClaims ? 'bg-maroon-700 text-white' : 'bg-gray-300 text-gray-500'}`}>3</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Send Claim Email</p>
                <p className="text-xs text-gray-400">Send the drafted claim via Resend email</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stepIcon(emailResult)}
              <button
                onClick={sendEmail}
                disabled={emailResult.status === 'running' || !claimPreview}
                className={`text-xs px-3 py-1.5 flex items-center gap-1 rounded-lg font-medium transition-colors ${claimPreview ? 'btn-maroon' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                <Send size={12} />
                {emailResult.status === 'running' ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
          {emailResult.status === 'success' && emailResult.data && (
            <div className="p-3 border-t bg-green-50 text-xs text-green-700">
              {emailResult.data.email_sent
                ? `Email sent to ${emailResult.data.recipient}`
                : `Claim submitted. ${emailResult.data.note || 'Check email provider config.'}`}
            </div>
          )}
          {emailResult.error && (
            <div className="p-3 border-t bg-red-50 text-xs text-red-600">{emailResult.error}</div>
          )}
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-400 text-center">
          Full pipeline: Upload CSV → Parse → Reconcile → AI Claim → Send Email
        </p>
      </div>
    </div>
  );
}
