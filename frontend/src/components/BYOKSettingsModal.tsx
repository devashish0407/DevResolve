import { useState, useEffect } from 'react';
import {
  X,
  Key,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';

interface BYOKSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const DEFAULT_MODELS: Record<string, Array<{ id: string; name: string; context: string }>> = {
  groq: [
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Default & Recommended)', context: '128k tokens' },
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Deep Reasoning)', context: '128k tokens' },
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Ultra-Fast)', context: '64k tokens' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', context: '128k tokens' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (500+ tok/s)', context: '128k tokens' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Ultra-Fast 1M Context)', context: '1M tokens' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Code Reasoning 2M Context)', context: '2M tokens' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen Multimodal Preview)', context: '1M tokens' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Omni Reasoning)', context: '128k tokens' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Efficient)', context: '128k tokens' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State-of-the-Art Code)', context: '200k tokens' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast & Lightweight)', context: '200k tokens' },
  ],
};

export default function BYOKSettingsModal({ isOpen, onClose, onSaved }: BYOKSettingsModalProps) {
  const [engineMode, setEngineMode] = useState<'free' | 'byok'>('free');
  const [provider, setProvider] = useState<'groq' | 'gemini' | 'openai' | 'anthropic'>('groq');
  const [model, setModel] = useState('qwen/qwen3.8-27b');
  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [supportedModels, setSupportedModels] = useState<Record<string, Array<{ id: string; name: string; context: string }>>>(DEFAULT_MODELS);

  const [freeTierUsed, setFreeTierUsed] = useState(0);
  const [freeTierLimit, setFreeTierLimit] = useState(5000);
  const [providerStatus, setProviderStatus] = useState<any>(null);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);
  const [fallbackProvider, setFallbackProvider] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; message: string; latency_ms?: number } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [rateLimitFlags, setRateLimitFlags] = useState<Array<{ provider: string; error_message: string; retry_after_seconds: number }>>([]);

  useEffect(() => {
    if (!isOpen) return;

    setTestResult(null);
    setSaveSuccess(false);

    async function fetchConfig() {
      try {
        const config = await api.getAISettings();
        if (config) {
          const prov = (config.provider as any) || 'groq';
          const isCustomByok = Boolean(config.has_key && !config.is_free_tier);
          
          // Free Mode is default unless user explicitly had custom BYOK key active
          if (isCustomByok) {
            setEngineMode('byok');
            setProvider(prov === 'ollama' ? 'groq' : prov);
          } else {
            setEngineMode('free');
            setProvider('groq');
          }

          if (config.supported_models) {
            setSupportedModels(config.supported_models);
          }
          const activeProv = isCustomByok ? (prov === 'ollama' ? 'groq' : prov) : 'groq';
          const availableModels = config.supported_models?.[activeProv] || DEFAULT_MODELS[activeProv] || [];
          if (config.model && availableModels.some((m: any) => m.id === config.model)) {
            setModel(config.model);
          } else if (availableModels.length > 0) {
            setModel(availableModels[0].id);
          }
          setHasKey(config.has_key);
          setMaskedKey(config.masked_key || '');
          setFreeTierUsed(config.free_tier_tokens_used || 0);
          setFreeTierLimit(config.free_tier_limit || 5000);
          setProviderStatus(config.provider_status || null);
          setFallbackAvailable(Boolean(config.fallback_available));
          setFallbackProvider(config.fallback_provider || null);
          if (config.active_rate_limit_flags) {
            setRateLimitFlags(config.active_rate_limit_flags);
          }
        }
      } catch (err) {
        console.warn('Could not load AI settings', err);
      }
    }

    fetchConfig();
  }, [isOpen]);

  if (!isOpen) return null;

  const currentModels = supportedModels[provider] || DEFAULT_MODELS[provider] || [
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Default & Recommended)', context: '128k tokens' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', context: '128k tokens' },
  ];

  const handleProviderChange = (newProvider: 'groq' | 'gemini' | 'openai' | 'anthropic') => {
    setProvider(newProvider);
    setTestResult(null);
    const models = supportedModels[newProvider] || DEFAULT_MODELS[newProvider];
    if (models && models.length > 0) {
      setModel(models[0].id);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (engineMode === 'free') {
        const res = await api.testAISettings('groq', model);
        setTestResult(res);
      } else {
        const res = await api.testAISettings(provider, model, apiKey.trim() || undefined);
        setTestResult(res);
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTestResult(null);
    try {
      if (engineMode === 'free') {
        // Free Mode uses platform Groq master key (empty api_key resets to platform key)
        await api.saveAISettings('groq', model, '');
        setHasKey(false);
        setMaskedKey('');
        setProvider('groq');
      } else {
        await api.saveAISettings(
          provider,
          model,
          apiKey.trim() || undefined
        );
        if (apiKey.trim()) {
          setHasKey(true);
          setMaskedKey(apiKey.slice(0, 4) + '••••••••' + apiKey.slice(-4));
          setApiKey('');
        }
      }
      setSaveSuccess(true);
      setTimeout(() => {
        if (onSaved) onSaved();
        onClose();
      }, 900);
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: err.message || 'Failed to save settings',
      });
    } finally {
      setLoading(false);
    }
  };

  const isLimitReached = freeTierUsed >= freeTierLimit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-dark-850 border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-dark-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent-blue via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">AI Engine & BYOK Settings</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent-blue/15 text-accent-blue border border-accent-blue/30 font-semibold">
                  Bring Your Own Key
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Configure your LLM provider for live code reasoning and incident diagnosis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Engine Mode Toggle (Free Mode vs BYOK Mode) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-dark-900 rounded-xl border border-surface-border">
            <button
              type="button"
              onClick={() => {
                setEngineMode('free');
                setProvider('groq');
                const groqModels = supportedModels['groq'] || DEFAULT_MODELS['groq'];
                if (groqModels && groqModels.length > 0) {
                  setModel(groqModels[0].id);
                }
                setApiKey('');
                setTestResult(null);
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                engineMode === 'free'
                  ? 'bg-gradient-to-r from-accent-blue to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap size={14} className={engineMode === 'free' ? 'text-amber-300' : 'text-slate-400'} />
              <span>Free Mode (Groq)</span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">
                Default
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEngineMode('byok');
                setTestResult(null);
              }}
              className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                engineMode === 'byok'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key size={14} className={engineMode === 'byok' ? 'text-cyan-300' : 'text-slate-400'} />
              <span>BYOK Mode (Custom Key)</span>
            </button>
          </div>

          {/* Status Message Card */}
          {engineMode === 'free' ? (
            <div className="p-3.5 rounded-xl border border-accent-blue/30 bg-accent-blue/10 flex items-start gap-3">
              <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">DevResolve Free Mode Active</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent-blue/20 text-accent-blue border border-accent-blue/30 font-bold">
                    Default Engine
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Powered by Groq Cloud hardware (500+ tokens/sec). Pre-configured and ready to use without entering any API key. If platform limits are ever reached, an automatic alert will guide you.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-start gap-3">
              <ShieldCheck size={18} className="text-status-success shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Personal BYOK Key Active</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                    Unlimited
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Using your personal API key ({maskedKey || 'Custom key configured'}). Platform limits are bypassed with unlimited reasoning tokens.
                </p>
              </div>
            </div>
          )}

          {/* Simple Alert Message if limit/exhaustion happens */}
          {isLimitReached && engineMode === 'free' && (
            <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-rose-300">Free Tier Usage Limit Reached</span>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Your free session quota has been reached. Please switch to BYOK Mode above to enter your own API key and continue investigating without limits.
                </p>
              </div>
            </div>
          )}

          {/* Real-Time Provider Health & Alert Status */}
          {providerStatus?.is_rate_limited && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                providerStatus.is_exhausted
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              }`}
            >
              <AlertCircle
                size={16}
                className={`shrink-0 mt-0.5 ${providerStatus.is_exhausted ? 'text-rose-400' : 'text-amber-400'}`}
              />
              <div className="space-y-1">
                <div className={`font-bold ${providerStatus.is_exhausted ? 'text-rose-300' : 'text-amber-300'}`}>
                  {providerStatus.is_exhausted
                    ? `Daily Quota Depleted on ${provider.toUpperCase()}`
                    : `Temporary Traffic Surge (~${providerStatus.retry_after_seconds}s Cooldown)`}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  {providerStatus.is_exhausted
                    ? 'The platform master key has reached its 24-hour token allowance. An automated alert has been dispatched to devashish0716@gmail.com. Enter your own API key below to continue without wait.'
                    : `Groq is experiencing momentary high traffic (RPM/TPM limit). This is a temporary burst and will clear automatically in seconds.`}
                </p>
                {fallbackAvailable && (
                  <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5 pt-0.5">
                    <Zap size={12} className="text-cyan-400" />
                    <span>Graceful Failover Ready: Inquiries will route through {fallbackProvider?.toUpperCase()}.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Provider Selection (Shown in BYOK mode) */}
          {engineMode === 'byok' && (
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Select BYOK Provider
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'groq', label: 'Groq Cloud', sub: 'Custom API Key', highlight: false },
                  { id: 'gemini', label: 'Google Gemini', sub: '1.5 Flash / Pro', highlight: false },
                  { id: 'openai', label: 'OpenAI', sub: 'GPT-4o / o1', highlight: false },
                  { id: 'anthropic', label: 'Anthropic', sub: 'Claude 3.5', highlight: false },
                ].map((p) => {
                  const isRateLimited = rateLimitFlags.some((f) => f.provider === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderChange(p.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative ${
                        isRateLimited
                          ? 'border-rose-500/60 bg-rose-500/10'
                          : provider === p.id
                          ? 'bg-accent-blue/15 border-accent-blue shadow-sm ring-1 ring-accent-blue/40'
                          : 'bg-dark-900 border-surface-border hover:border-slate-600 text-slate-400'
                      }`}
                    >
                      {isRateLimited && (
                        <span className="absolute -top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold shadow animate-pulse">
                          429 Limit
                        </span>
                      )}
                      <div className={`text-xs font-bold ${provider === p.id ? 'text-white' : 'text-slate-300'}`}>
                        {p.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{p.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Model Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Reasoning Model {engineMode === 'free' ? '(Groq Cloud Accelerated)' : ''}
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="input-field text-xs py-2.5 w-full bg-dark-900"
            >
              {currentModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.context})
                </option>
              ))}
            </select>
            {provider === 'groq' && (
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                💡 <strong>Groq Cloud:</strong> <code>Qwen 3.8 27B</code> & <code>Llama 3.3 70B</code> deliver deep incident diagnosis at 500+ tokens/sec.
              </p>
            )}
            {provider === 'gemini' && (
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                💡 <strong>Google Gemini:</strong> Models include <code>gemini-1.5-flash</code> (ultra-fast), <code>gemini-1.5-pro</code> (deep reasoning), and <code>gemini-2.0-flash</code>. Requires an API key from <strong>Google AI Studio</strong>.
              </p>
            )}
          </div>

          {/* API Key Input (Shown in BYOK mode) */}
          {engineMode === 'byok' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key size={13} className="text-accent-blue" />
                  {provider === 'groq'
                    ? 'Groq Cloud API Key'
                    : provider === 'gemini'
                    ? 'Google Gemini API Key'
                    : provider === 'openai'
                    ? 'OpenAI API Key'
                    : 'Anthropic API Key'}
                </label>
                {provider === 'groq' && (
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-accent-blue hover:underline flex items-center gap-1"
                  >
                    <span>Get Groq key</span>
                    <ExternalLink size={10} />
                  </a>
                )}
                {provider === 'gemini' && (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-accent-blue hover:underline flex items-center gap-1"
                  >
                    <span>Get Gemini key</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>

              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    hasKey
                      ? `Configured: ${maskedKey}`
                      : 'Paste your API key here (e.g. gsk_... or AIza...)'
                  }
                  className="input-field text-xs py-2.5 pr-24 font-mono"
                />
                {hasKey && !apiKey && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-2 py-0.5 rounded bg-status-success/15 text-status-success border border-status-success/30 font-medium">
                    Configured
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Keys are stored securely in your user session and never sent to third parties.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-dark-900 border border-surface-border text-xs text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-status-success" />
                <span>Pre-configured Platform Master Groq Key Active</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-success/15 text-status-success border border-status-success/30 font-bold">
                Zero Setup
              </span>
            </div>
          )}

          {/* Test Status feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.status === 'success'
                  ? 'bg-status-success/10 border-status-success/30 text-status-success'
                  : 'bg-status-danger/10 border-status-danger/30 text-status-danger'
              }`}
            >
              {testResult.status === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-semibold">{testResult.message}</div>
                {testResult.latency_ms && (
                  <div className="text-[10px] opacity-80 mt-0.5 font-mono">
                    Round-trip latency: {testResult.latency_ms}ms
                  </div>
                )}
              </div>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-xl bg-status-success/15 border border-status-success/30 text-xs text-status-success font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} />
              AI settings saved successfully! Model is active.
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-border">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="btn-ghost text-xs py-2.5 px-4 flex items-center gap-2 border border-surface-border disabled:opacity-40"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-accent-blue" />}
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost text-xs py-2.5 px-4"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-gradient text-xs py-2.5 px-5 flex items-center gap-2 shadow-md"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
