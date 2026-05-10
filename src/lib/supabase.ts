import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spglhsnskcchtqzgkmss.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZ2xoc25za2NjaHRxemdrbXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDY5MDksImV4cCI6MjA5MjI4MjkwOX0.8YLHeZGpnZUBP9qkK4tUbXQ05R6a0ImkI9Jzdo_Leng';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For local n8n: http://localhost:5678/webhook/council-dispatch
// For cloud n8n: https://YOUR-INSTANCE.app.n8n.cloud/webhook/council-dispatch
// Update VITE_N8N_DISPATCH_URL in Vercel env vars when you deploy n8n to cloud
export const N8N_DISPATCH_URL = import.meta.env.VITE_N8N_DISPATCH_URL || 'http://localhost:5678/webhook/parse-settlement';

export const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkM2Q5M2QwMC01Y2Y5LTRkMGUtYmZjMi1hMjBmZmE1Y2VhYzIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMzdjZGQ4MWItZTY0Yy00ZGNmLWI0NTAtMmU4ZTIzZjFhYmI5IiwiaWF0IjoxNzc4MzkyNDYxLCJleHAiOjE3ODYwNzUyMDB9.dAOGW5-d5KhuoMtoKKtyjP2sJy77sK_t7kIZkf98uBw';
