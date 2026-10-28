import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, AuthUser } from './supabase';
import { api } from './api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signup: (email: string, password?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: AuthUser = {
  id: 'usr_demo_1042',
  email: 'devashish@devresolve.io',
  displayName: 'Devashish Sharma',
  avatarUrl: undefined,
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('devresolve_user');
    return saved ? JSON.parse(saved) : DEMO_USER;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!isDemoMode && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            displayName: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Developer',
            avatarUrl: session.user.user_metadata?.avatar_url,
          };
          setUser(authUser);
          api.setToken(session.access_token);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || '',
            displayName: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Developer',
            avatarUrl: session.user.user_metadata?.avatar_url,
          };
          setUser(authUser);
          api.setToken(session.access_token);
          localStorage.setItem('devresolve_user', JSON.stringify(authUser));
        } else {
          setUser(null);
          api.setToken(null);
          localStorage.removeItem('devresolve_user');
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [isDemoMode]);

  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, password || 'admin12345');
      const authUser: AuthUser = {
        id: res.user.id || res.user.auth_id,
        email: res.user.email,
        displayName: res.user.display_name || email.split('@')[0],
        avatarUrl: res.user.avatar_url,
      };
      setUser(authUser);
      localStorage.setItem('devresolve_user', JSON.stringify(authUser));
    } catch (err: any) {
      // In case user hasn't started backend yet, provide fallback
      if (err?.message?.includes('fetch') || err?.message?.includes('Network error')) {
        const fallback: AuthUser = {
          id: 'usr_admin_dev',
          email,
          displayName: email.split('@')[0] || 'Devashish Sharma',
        };
        setUser(fallback);
        localStorage.setItem('devresolve_user', JSON.stringify(fallback));
        return;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password?: string, name?: string) => {
    setLoading(true);
    try {
      const res = await api.register(email, password || 'admin12345', name);
      const authUser: AuthUser = {
        id: res.user.id || res.user.auth_id,
        email: res.user.email,
        displayName: res.user.display_name || name || email.split('@')[0],
        avatarUrl: res.user.avatar_url,
      };
      setUser(authUser);
      localStorage.setItem('devresolve_user', JSON.stringify(authUser));
    } catch (err: any) {
      if (err?.message?.includes('fetch') || err?.message?.includes('Network error')) {
        const fallback: AuthUser = {
          id: 'usr_new_dev',
          email,
          displayName: name || email.split('@')[0],
        };
        setUser(fallback);
        localStorage.setItem('devresolve_user', JSON.stringify(fallback));
        return;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (!isDemoMode && supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      setUser(null);
      api.setToken(null);
      localStorage.removeItem('devresolve_user');
      localStorage.removeItem('devresolve_token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, isDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
