import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, X, Key } from 'lucide-react';
import { GithubIcon } from '../components/icons';

import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithOAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'github' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(decodeURIComponent(err));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/app');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: 'github' | 'google') => {
    setSocialLoading(provider);
    setError(null);
    try {
      await loginWithOAuth(provider);
    } catch (err: any) {
      setError(err?.message || `${provider.toUpperCase()} authentication failed.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotError(null);
    try {
      await api.forgotPassword(forgotEmail);
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to dispatch reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6 relative">
      {/* Background effects */}
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-accent-blue/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-accent-purple/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center">
            <Sparkles size={22} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-white">DevResolve</span>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-slate-400 mb-6">Sign in to continue to DevResolve</p>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-start gap-2.5 shadow-lg shadow-status-danger/5 animate-fade-in">
              <AlertCircle size={16} className="text-status-danger shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">
                <div>{error}</div>
                {error.toLowerCase().includes('no account found') && (
                  <div className="mt-2 pt-2 border-t border-status-danger/20">
                    <Link
                      to="/signup"
                      className="text-white hover:text-accent-blue font-semibold underline inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Create an account now →</span>
                    </Link>
                  </div>
                )}
                {error.toLowerCase().includes('incorrect password') && (
                  <div className="mt-2 pt-2 border-t border-status-danger/20">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setShowForgotModal(true);
                        setError(null);
                      }}
                      className="text-white hover:text-accent-blue font-semibold underline inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Forgot password? Reset it here →</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                className="input-field"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-surface-border bg-dark-800 text-accent-blue focus:ring-accent-blue/40"
                />
                <span className="text-sm text-slate-400">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email || '');
                  setForgotError(null);
                  setForgotSuccess(false);
                  setShowForgotModal(true);
                }}
                className="text-sm text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-gradient w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-xs text-slate-500">or continue with</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          {/* Social Auth */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSocialAuth('github')}
              disabled={socialLoading !== null || loading}
              className="btn-ghost flex items-center justify-center gap-2 py-2.5 hover:bg-dark-800 transition-all cursor-pointer disabled:opacity-50"
            >
              {socialLoading === 'github' ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <GithubIcon className="w-4 h-4" />
              )}
              <span>GitHub</span>
            </button>
            <button
              type="button"
              onClick={() => handleSocialAuth('google')}
              disabled={socialLoading !== null || loading}
              className="btn-ghost flex items-center justify-center gap-2 py-2.5 hover:bg-dark-800 transition-all cursor-pointer disabled:opacity-50"
            >
              {socialLoading === 'google' ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              <span>Google</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-accent-blue hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>

      {/* Forgot Password Modal Window */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md glass-card p-6 border border-slate-700/80 shadow-2xl relative">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-800 transition-colors"
            >
              <X size={18} />
            </button>

            {forgotSuccess ? (
              <div className="text-center py-4 space-y-4 animate-fade-in">
                <div className="w-12 h-12 rounded-2xl bg-status-success/15 border border-status-success/30 flex items-center justify-center mx-auto text-status-success">
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1.5">Check Your Email</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    If an account is registered with <span className="font-mono text-white font-medium">{forgotEmail}</span>, we have dispatched a password reset link to your inbox.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2.5">
                    ⏱️ The link will expire in <strong>1 hour</strong>. Please check your inbox and spam folder.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="btn-gradient w-full py-2.5 text-xs font-semibold"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Key size={18} className="text-accent-blue" />
                  <h3 className="text-lg font-bold text-white">Reset Your Password</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  Enter your registered email address below. We'll send you an email containing a secure link to choose a new password.
                </p>

                {forgotError && (
                  <div className="mb-4 p-3 rounded-lg bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@gmail.com"
                      className="input-field text-sm"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="btn-ghost text-xs py-2 px-3 border border-surface-border"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotEmail}
                      className="btn-gradient text-xs py-2 px-4 flex items-center gap-2 disabled:opacity-50"
                    >
                      {forgotLoading && <Loader2 size={13} className="animate-spin" />}
                      <span>{forgotLoading ? 'Sending link...' : 'Send Reset Link'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
