import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, AuthUser } from './supabase';
import { api, API_BASE_URL } from './api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signup: (email: string, password?: string, name?: string) => Promise<void>;
  verifySignupOtp: (email: string, otp: string) => Promise<void>;
  loginWithOAuth: (provider: 'github' | 'google') => Promise<void>;
  logout: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('devresolve_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const isDemoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

  useEffect(() => {
    // Check if returning from real Google or GitHub OAuth redirect with token
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      api.setToken(token);
      // Remove token from address bar cleanly
      window.history.replaceState({}, document.title, window.location.pathname);
      api.getProfile().then((profile) => {
        if (profile) {
          const authUser: AuthUser = {
            id: profile.id || profile.auth_id,
            email: profile.email,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
          };
          setUser(authUser);
          localStorage.setItem('devresolve_user', JSON.stringify(authUser));
        }
      }).catch((err) => {
        console.warn('Could not load profile from OAuth token:', err);
      });
    }

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
        api.setToken(fallback.id);
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
        api.setToken(fallback.id);
        setUser(fallback);
        localStorage.setItem('devresolve_user', JSON.stringify(fallback));
        return;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifySignupOtp = async (email: string, otp: string) => {
    setLoading(true);
    try {
      const res = await api.verifySignupOtp(email, otp);
      const authUser: AuthUser = {
        id: res.user.id || res.user.auth_id,
        email: res.user.email,
        displayName: res.user.display_name || email.split('@')[0],
        avatarUrl: res.user.avatar_url,
      };
      setUser(authUser);
      localStorage.setItem('devresolve_user', JSON.stringify(authUser));
    } finally {
      setLoading(false);
    }
  };

  const loginWithOAuth = async (provider: 'github' | 'google') => {
    setLoading(true);
    try {
      // 1. Check if Supabase client is configured with live credentials
      if (!isDemoMode && supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/app`,
          },
        });
        if (!error) return; // Browser redirected to Google / GitHub
        console.warn('Supabase OAuth error, falling back to direct OAuth:', error);
      }

      // 2. Check if backend has direct Google / GitHub OAuth credentials configured
      const statusRes = await fetch(`${API_BASE_URL}/auth/oauth/providers`).catch(() => null);
      if (statusRes && statusRes.ok) {
        const providers = await statusRes.json().catch(() => ({}));
        if (providers[provider]) {
          // Redirect browser directly to Google Accounts or GitHub OAuth consent screen
          window.location.href = `${API_BASE_URL}/auth/oauth/${provider}`;
          return;
        }
      }

      // 3. Credentials are not configured yet
      throw new Error(
        `Real ${provider === 'google' ? 'Google' : 'GitHub'} OAuth is not configured on the server yet. ` +
        `To authenticate with real ${provider === 'google' ? 'Gmail' : 'GitHub'} accounts, ` +
        `please set ${provider === 'google' ? 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET' : 'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET'} ` +
        `in backend .env (or configure Supabase Auth providers). Direct bypass is disabled to preserve authentication security.`
      );
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
    <AuthContext.Provider value={{ user, loading, login, signup, verifySignupOtp, loginWithOAuth, logout, isDemoMode }}>
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
