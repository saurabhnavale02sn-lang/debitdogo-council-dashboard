import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { CouncilUser } from '../types';

interface AuthState {
  user: User | null;
  session: Session | null;
  councilUser: CouncilUser | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [councilUser, setCouncilUser] = useState<CouncilUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCouncilUser = async (userId: string) => {
    const { data, error } = await supabase
      .from('council_users')
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .single();
    if (error || !data) {
      setCouncilUser(null);
      return null;
    }
    setCouncilUser(data as CouncilUser);
    // Update last_login
    supabase.from('council_users').update({ last_login: new Date().toISOString() }).eq('id', userId).then();
    return data;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchCouncilUser(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchCouncilUser(s.user.id);
      } else {
        setCouncilUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const cu = await fetchCouncilUser(data.user.id);
      if (!cu) {
        await supabase.auth.signOut();
        return { error: 'Access denied. Contact Saurabh.' };
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCouncilUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, session, councilUser, loading,
      isSuperAdmin: councilUser?.role === 'super_admin',
      signIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
