import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Sparkles, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Key, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Dynamic Password Rules & Strength Meter
  const hasMinLength = newPassword.length >= 6;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSymbol = /[$#@&*!%^~+=_.\-?]/.test(newPassword);
  const allRulesPassed = hasMinLength && hasUpperCase && hasNumber && hasSymbol;
  const strengthCount = [hasMinLength, hasUpperCase, hasNumber, hasSymbol].filter(Boolean).length;

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setError('No password reset token provided. Please request a new link from the login page.');
      return;
    }

    async function verify() {
      try {
        const res = await api.verifyResetToken(token!);
        if (res.valid) {
          setTokenValid(true);
          setAccountEmail(res.email || '');
        } else {
          setTokenValid(false);
          setError('This password reset link is invalid or has expired.');
        }
      } catch (err: any) {
        setTokenValid(false);
        setError(err.message || 'This password reset link is invalid or has expired.');
      } finally {
        setVerifying(false);
      }
    }

    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasMinLength) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (!hasUpperCase) {
      setError('Password must contain at least one capital letter (A-Z).');
      return;
    }
    if (!hasNumber) {
      setError('Password must contain at least one number (0-9).');
      return;
    }
    if (!hasSymbol) {
      setError('Password must contain at least one symbol like $#@&*!%^~+=_.-');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token!, newPassword);
      setResetSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please request a new link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6 relative">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-accent-blue/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] rounded-full bg-accent-purple/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center">
            <Sparkles size={22} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-white">DevResolve</span>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {verifying ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 size={32} className="animate-spin text-accent-blue mx-auto" />
              <p className="text-sm text-slate-300">Verifying your reset link...</p>
            </div>
          ) : resetSuccess ? (
            <div className="text-center space-y-5 animate-fade-in py-4">
              <div className="w-14 h-14 rounded-2xl bg-status-success/15 border border-status-success/30 flex items-center justify-center mx-auto text-status-success">
                <CheckCircle2 size={30} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-2">Password Reset Successfully!</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your new password has been securely updated in the database. You can now sign in to DevResolve with your new credentials.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn-gradient w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold shadow-lg shadow-accent-blue/20"
              >
                <span>Go to Sign In</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : !tokenValid ? (
            <div className="text-center space-y-5 py-4">
              <div className="w-14 h-14 rounded-2xl bg-status-danger/15 border border-status-danger/30 flex items-center justify-center mx-auto text-status-danger">
                <AlertCircle size={30} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-2">Link Expired or Invalid</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {error || 'This password reset link has either expired or already been used.'}
                </p>
              </div>

              <Link
                to="/login"
                className="btn-gradient w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <span>Back to Sign In</span>
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Key size={20} className="text-accent-blue" />
                <h1 className="text-2xl font-bold text-white">Set New Password</h1>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                Enter your new password below for account{' '}
                <span className="font-mono text-slate-200">{accountEmail}</span>.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters with $#@&*!"
                      className="input-field pr-10 text-sm"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Dynamic Password Strength & Rules Checklist */}
                  {newPassword.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-dark-900/90 border border-surface-border space-y-2.5 animate-fade-in">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                          <ShieldCheck size={14} className={allRulesPassed ? "text-status-success" : "text-amber-400"} />
                          <span>Password Strength:</span>
                        </span>
                        <span className={`font-bold font-mono text-[11px] ${
                          strengthCount === 4
                            ? 'text-status-success'
                            : strengthCount >= 2
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}>
                          {strengthCount === 4 ? 'STRONG' : strengthCount >= 2 ? 'FAIR' : 'WEAK'}
                        </span>
                      </div>

                      {/* Multi-segment strength bar */}
                      <div className="w-full h-1.5 bg-dark-950 rounded-full overflow-hidden flex gap-1">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`h-full flex-1 rounded-full transition-all duration-300 ${
                              step <= strengthCount
                                ? strengthCount === 4
                                  ? 'bg-status-success shadow-sm shadow-status-success/50'
                                  : strengthCount >= 2
                                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                  : 'bg-rose-500 shadow-sm shadow-rose-500/50'
                                : 'bg-slate-800'
                            }`}
                          />
                        ))}
                      </div>

                      {/* 4 Real-Time Rule Pills */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        {[
                          { label: '6+ characters', valid: hasMinLength },
                          { label: '1 uppercase (A-Z)', valid: hasUpperCase },
                          { label: '1 number (0-9)', valid: hasNumber },
                          { label: '1 symbol ($#@&*!)', valid: hasSymbol },
                        ].map((rule, idx) => (
                          <div
                            key={idx}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1.5 border transition-all ${
                              rule.valid
                                ? 'bg-status-success/15 border-status-success/35 text-status-success font-semibold'
                                : 'bg-dark-950/70 border-slate-800/80 text-slate-500'
                            }`}
                          >
                            {rule.valid ? (
                              <CheckCircle2 size={11} className="text-status-success shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                            )}
                            <span>{rule.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your new password"
                      className="input-field pr-10 text-sm"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !newPassword || !confirmPassword}
                    className="btn-gradient w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <span>Reset Password</span>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-xs text-slate-400 hover:text-accent-blue transition-colors">
                  ← Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

