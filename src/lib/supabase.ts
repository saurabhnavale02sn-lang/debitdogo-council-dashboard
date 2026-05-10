import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spglhsnskcchtqzgkmss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZ2xoc25za2NjaHRxemdrbXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDY5MDksImV4cCI6MjA5MjI4MjkwOX0.8YLHeZGpnZUBP9qkK4tUbXQ05R6a0ImkI9Jzdo_Leng';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Supabase Edge Functions (replaced n8n) ─────────────────────────────────
const EDGE_FN_BASE = `${supabaseUrl}/functions/v1`;

export const EDGE_FUNCTIONS = {
  councilDispatch: `${EDGE_FN_BASE}/council-dispatch`,
  parseSettlement: `${EDGE_FN_BASE}/parse-settlement`,
  runReconciliation: `${EDGE_FN_BASE}/run-reconciliation`,
  draftClaim: `${EDGE_FN_BASE}/draft-claim`,
  sendClaimEmail: `${EDGE_FN_BASE}/send-claim-email`,
  escalationCheck: `${EDGE_FN_BASE}/escalation-check`,
  disputeAlert: `${EDGE_FN_BASE}/dispute-alert`,
  createInvoice: `${EDGE_FN_BASE}/create-invoice`,
};

// Helper to call any Edge Function
export async function callEdgeFunction(name: keyof typeof EDGE_FUNCTIONS, payload: any) {
  const url = EDGE_FUNCTIONS[name];
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Legacy aliases for backward compatibility
export const N8N_DISPATCH_URL = EDGE_FUNCTIONS.councilDispatch;
