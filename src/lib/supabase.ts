import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://spglhsnskcchtqzgkmss.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwZ2xoc25za2NjaHRxemdrbXNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDY5MDksImV4cCI6MjA5MjI4MjkwOX0.8YLHeZGpnZUBP9qkK4tUbXQ05R6a0ImkI9Jzdo_Leng';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const N8N_DISPATCH_URL = import.meta.env.VITE_N8N_DISPATCH_URL || '/webhook/council-dispatch';
