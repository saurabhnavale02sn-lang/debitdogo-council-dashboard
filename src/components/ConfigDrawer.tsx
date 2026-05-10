import { useState, useEffect } from 'react';
import { X, Save, RotateCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Agent, AgentRun } from '../types';
import { MODEL_OPTIONS, getModelDisplay } from '../types';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface Props {
  agent: Agent;
  onClose: () => void;
  onUpdated: () => void;
}

export default function ConfigDrawer({ agent, onClose, onUpdated }: Props) {
  const { user, isSuperAdmin } = useAuth();
  const [model, setModel] = useState(agent.model);
  const [enabled, setEnabled] = useState(agent.is_enabled);
  const [prompt, setPrompt] = useState(agent.system_prompt);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [maxTokens, setMaxTokens] = useState(agent.max_tokens);
  const [saving, setSaving] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>([]);

  useEffect(() => {
    supabase
      .from('council_agent_runs')
      .select('*')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentRuns((data as AgentRun[]) || []));
  }, [agent.id]);

  const logAudit = async (action: string, oldVal: unknown, newVal: unknown) => {
    await supabase.from('council_audit_log').insert({
      council_user_id: user?.id,
      user_email: user?.email,
      user_role: isSuperAdmin ? 'super_admin' : 'admin',
      action,
      target_type: 'agent',
      target_id: agent.id,
      target_name: agent.display_name,
      old_value: typeof oldVal === 'object' ? oldVal : { value: oldVal },
      new_value: typeof newVal === 'object' ? newVal : { value: newVal },
    });
  };

  const handleToggle = async () => {
    const newVal = !enabled;
    setEnabled(newVal);
    const { error } = await supabase
      .from('council_agents')
      .update({ is_enabled: newVal, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', agent.id);
    if (error) { setEnabled(!newVal); toast.error('Failed'); return; }
    await logAudit('toggle_agent', { is_enabled: !newVal }, { is_enabled: newVal });
    toast.success(newVal ? 'Agent enabled' : 'Agent disabled');
    onUpdated();
  };

  const handleModelChange = async (newModel: string) => {
    const old = model;
    setModel(newModel);
    const { error } = await supabase
      .from('council_agents')
      .update({ model: newModel, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', agent.id);
    if (error) { setModel(old); toast.error('Failed'); return; }
    await logAudit('change_model', { model: old }, { model: newModel });
    toast.success(`Model changed to ${getModelDisplay(newModel).label}`);
    onUpdated();
  };

  const handleSavePrompt = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('council_agents')
      .update({ system_prompt: prompt, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', agent.id);
    if (error) { toast.error('Failed to save'); setSaving(false); return; }
    await logAudit('update_prompt', { length: agent.system_prompt.length }, { length: prompt.length });
    toast.success('System prompt saved');
    setSaving(false);
    onUpdated();
  };

  const handleSaveAdvanced = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('council_agents')
      .update({ temperature, max_tokens: maxTokens, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq('id', agent.id);
    if (error) { toast.error('Failed'); setSaving(false); return; }
    await logAudit('update_settings', { temperature: agent.temperature, max_tokens: agent.max_tokens }, { temperature, max_tokens: maxTokens });
    toast.success('Advanced settings saved');
    setSaving(false);
    onUpdated();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto drawer-enter">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{agent.icon}</span>
            <div>
              <h2 className="font-bold text-gray-900">{agent.display_name}</h2>
              <span className="text-xs font-mono text-gray-400">{agent.department}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Section 1: Status & Model */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Status & Model</h3>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">Agent Status</span>
              <button
                onClick={handleToggle}
                className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">AI Model</label>
              <select
                value={model}
                onChange={e => handleModelChange(e.target.value)}
                className="input-field"
              >
                {MODEL_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: System Prompt */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">System Prompt</h3>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={14}
              className="input-field font-mono text-xs leading-relaxed resize-y min-h-[300px]"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">{prompt.length} characters</span>
              <div className="flex gap-2">
                {isSuperAdmin && (
                  <button onClick={() => setPrompt(agent.system_prompt)} className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
                <button onClick={handleSavePrompt} disabled={saving || prompt === agent.system_prompt} className="btn-maroon text-xs py-1.5 px-3 flex items-center gap-1">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Advanced */}
          <div>
            <button
              onClick={() => setAdvOpen(!advOpen)}
              className="flex items-center justify-between w-full text-sm font-semibold text-gray-500 uppercase tracking-wider"
            >
              Advanced Settings
              {advOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {advOpen && (
              <div className="mt-3 space-y-4 bg-gray-50 rounded-lg p-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <label className="font-medium text-gray-700">Temperature</label>
                    <span className="text-gray-500">{Math.round(temperature * 100)}%</span>
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-maroon-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Max Tokens</label>
                  <input
                    type="number" min={100} max={4000}
                    value={maxTokens}
                    onChange={e => setMaxTokens(parseInt(e.target.value))}
                    className="input-field"
                  />
                </div>
                <button onClick={handleSaveAdvanced} disabled={saving} className="btn-maroon text-sm w-full flex items-center justify-center gap-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Advanced
                </button>
              </div>
            )}
          </div>

          {/* Section 4: Recent Runs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Runs</h3>
            {recentRuns.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6 bg-gray-50 rounded-lg">No runs yet</p>
            ) : (
              <div className="space-y-2">
                {recentRuns.map(run => (
                  <div key={run.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                    <span className="text-gray-500">{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</span>
                    <span className="text-gray-600">{run.triggered_by}</span>
                    <span className={`badge ${run.status === 'success' ? 'bg-green-100 text-green-700' : run.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {run.status}
                    </span>
                    <span className="text-gray-400">{run.tokens_input + run.tokens_output}t</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
