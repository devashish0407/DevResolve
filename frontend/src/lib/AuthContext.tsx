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
      if (isDemoMode || !supabase) {
        // Instant seamless login in local/demo mode
        const demo: AuthUser = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          displayName: email.split('@')[0] || 'Devashish Sharma',
        };
        setUser(demo);
        localStorage.setItem('devresolve_user', JSON.stringify(demo));
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password || 'defaultpassword123',
      });
      if (error) throw error;
      if (data.session) {
        api.setToken(data.session.access_token);
      }
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password?: string, name?: string) => {
    setLoading(true);
    try {
      if (isDemoMode || !supabase) {
        const demo: AuthUser = {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email,
          displayName: name || email.split('@')[0],
        };
        setUser(demo);
        localStorage.setItem('devresolve_user', JSON.stringify(demo));
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || 'defaultpassword123',
        options: {
          data: { display_name: name },
        },
      });
      if (error) throw error;
      if (data.session) {
        api.setToken(data.session.access_token);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (!isDemoMode && supabase) {
        await supabase.auth.signOut();
      }
      setUser(null);
      api.setToken(null);
      localStorage.removeItem('devresolve_user');
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
