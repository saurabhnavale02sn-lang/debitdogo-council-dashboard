export interface CouncilUser {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin';
  is_active: boolean;
  avatar_color: string;
  last_login: string | null;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  display_name: string;
  department: string;
  description: string | null;
  icon: string;
  color: string;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  is_enabled: boolean;
  run_count: number;
  last_run_at: string | null;
  last_run_status: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  agent_id: string;
  agent_name: string;
  department: string;
  triggered_by: string;
  input_summary: string | null;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  output_text: string | null;
  status: 'running' | 'success' | 'error';
  tokens_input: number;
  tokens_output: number;
  duration_ms: number | null;
  error_message: string | null;
  brand_id: string | null;
  related_id: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  council_user_id: string;
  user_email: string;
  user_role: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export const MODEL_OPTIONS = [
  { value: 'claude-opus-4-7', label: 'Opus 4.7', desc: 'Most Capable', color: 'bg-purple-100 text-purple-700' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'Balanced (Recommended)', color: 'bg-blue-100 text-blue-700' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Fast & Cheap', color: 'bg-green-100 text-green-700' },
] as const;

export function getModelDisplay(model: string) {
  return MODEL_OPTIONS.find(m => m.value === model) || MODEL_OPTIONS[1];
}
