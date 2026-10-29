import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck, AlertCircle, Mail, ArrowLeft, RotateCcw, Edit2 } from 'lucide-react';
import { GithubIcon } from '../components/icons';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { verifySignupOtp, loginWithOAuth } = useAuth();
  
  // Step: 'form' for credentials input, 'otp' for email verification
  const [step, setStep] = useState<'form' | 'otp'>('form');

  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'github' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // OTP Verification State
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Dynamic Password Rule Validation
  const hasMinLength = password.length >= 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[$#@&*!%^~+=_.\-?]/.test(password);
  const allRulesPassed = hasMinLength && hasUpperCase && hasNumber && hasSymbol;
  const strengthCount = [hasMinLength, hasUpperCase, hasNumber, hasSymbol].filter(Boolean).length;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(decodeURIComponent(err));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Cooldown countdown timer for resending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendSuccess(null);

    // Enforce Password Rules with clear dynamic guidance
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

    setLoading(true);
    try {
      await api.requestSignupOtp(email, password, name);
      setStep('otp');
      setResendCooldown(60);
      setOtpValues(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch verification code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpValues];
    newOtp[index] = digit;
    setOtpValues(newOtp);
    setError(null);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newOtp = ['', '', '', '', '', ''];
      pasted.split('').forEach((char, idx) => {
        newOtp[idx] = char;
      });
      setOtpValues(newOtp);
      const nextIdx = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpValues.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifySignupOtp(email, fullOtp);
      navigate('/app');
    } catch (err: any) {
      setError(err?.message || 'Invalid verification code. Please check your Gmail or resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    setResendSuccess(null);
    try {
      await api.resendSignupOtp(email);
      setResendCooldown(60);
      setResendSuccess(`A fresh verification code has been dispatched to ${email}`);
      setOtpValues(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSocialAuth = async (provider: 'github' | 'google') => {
    setSocialLoading(provider);
    setError(null);
    try {
      await loginWithOAuth(provider);
    } catch (err: any) {
      setError(err?.message || `${provider.toUpperCase()} signup failed.`);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6 relative">
      {/* Background effects */}
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-accent-purple/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-[350px] h-[350px] rounded-full bg-accent-blue/5 blur-[100px] pointer-events-none" />

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
          {step === 'form' ? (
            <>
              <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
              <p className="text-sm text-slate-400 mb-8">Start investigating incidents with AI</p>

              {error && (
                <div className="mb-4 p-3.5 rounded-xl bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-start gap-2.5 animate-fade-in shadow-lg shadow-status-danger/5">
                  <AlertCircle size={16} className="text-status-danger shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{error}</div>
                </div>
              )}

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Your name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="input-field pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Dynamic Password Strength & Rules Checklist */}
                  {password.length > 0 && (
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
                        {[1, 2, 3, 4].map((stepNumber) => (
                          <div
                            key={stepNumber}
                            className={`h-full flex-1 rounded-full transition-all duration-300 ${
                              stepNumber <= strengthCount
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

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gradient w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-white" />
                      Sending verification code...
                    </span>
                  ) : (
                    'Continue with Email Verification'
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
            </>
          ) : (
            /* OTP Verification Screen */
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center mx-auto text-accent-blue shadow-lg shadow-accent-blue/10">
                  <Mail size={26} />
                </div>
                <h2 className="text-2xl font-bold text-white">Check your Gmail</h2>
                <p className="text-xs text-slate-400">
                  We've sent a 6-digit verification code to
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-900 border border-surface-border text-xs text-slate-200">
                  <span className="font-mono font-medium text-accent-blue">{email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setError(null);
                      setResendSuccess(null);
                    }}
                    className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                    title="Change email address"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-start gap-2.5 animate-fade-in shadow-lg shadow-status-danger/5">
                  <AlertCircle size={16} className="text-status-danger shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{error}</div>
                </div>
              )}

              {resendSuccess && (
                <div className="p-3.5 rounded-xl bg-status-success/10 border border-status-success/30 text-xs text-status-success flex items-start gap-2.5 animate-fade-in">
                  <CheckCircle2 size={16} className="text-status-success shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{resendSuccess}</div>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* 6 Digit Inputs */}
                <div>
                  <label className="block text-center text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">
                    Enter 6-Digit Code
                  </label>
                  <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                    {otpValues.map((val, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={val}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className="w-11 h-13 text-center text-xl font-bold font-mono rounded-xl bg-dark-900/90 border border-surface-border text-white focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:outline-none transition-all shadow-inner"
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpValues.join('').length !== 6}
                  className="btn-gradient w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-white" />
                      <span>Verifying & Creating Account...</span>
                    </>
                  ) : (
                    <span>Verify & Go to Dashboard</span>
                  )}
                </button>
              </form>

              {/* Resend & Back actions */}
              <div className="flex flex-col items-center gap-3 pt-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span>Didn't receive the code?</span>
                  {resendCooldown > 0 ? (
                    <span className="font-mono text-slate-500 font-medium">
                      Resend in {resendCooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resending}
                      className="text-accent-blue hover:text-accent-blue/80 font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {resending ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw size={12} />
                          <span>Resend Code</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('form');
                    setError(null);
                    setResendSuccess(null);
                  }}
                  className="text-slate-400 hover:text-slate-200 inline-flex items-center gap-1.5 transition-colors pt-1"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Edit Registration</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-blue hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
