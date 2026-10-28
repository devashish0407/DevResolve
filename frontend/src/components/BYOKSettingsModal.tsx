import { useState, useEffect } from 'react';
import {
  X,
  Key,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Server,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';

interface BYOKSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const DEFAULT_MODELS: Record<string, Array<{ id: string; name: string; context: string }>> = {
  groq: [
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Active & Recommended)', context: '128k tokens' },
    { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (High Reasoning)', context: '128k tokens' },
    { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Ultra-Fast)', context: '64k tokens' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', context: '128k tokens' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', context: '128k tokens' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast & Free Tier)', context: '1M tokens' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Code Reasoning)', context: '2M tokens' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen)', context: '1M tokens' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Omni Reasoning)', context: '128k tokens' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Efficient)', context: '128k tokens' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State-of-the-Art Code)', context: '200k tokens' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)', context: '200k tokens' },
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2 (Local)', context: '8k tokens' },
    { id: 'deepseek-r1', name: 'DeepSeek R1 (Local Reasoning)', context: '32k tokens' },
    { id: 'mistral', name: 'Mistral 7B (Local)', context: '8k tokens' },
  ],
};

export default function BYOKSettingsModal({ isOpen, onClose, onSaved }: BYOKSettingsModalProps) {
  const [provider, setProvider] = useState<'groq' | 'gemini' | 'openai' | 'anthropic' | 'ollama'>('groq');
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [apiKey, setApiKey] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [supportedModels, setSupportedModels] = useState<Record<string, Array<{ id: string; name: string; context: string }>>>(DEFAULT_MODELS);

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
          setProvider(prov);
          if (config.supported_models) {
            setSupportedModels(config.supported_models);
          }
          const availableModels = config.supported_models?.[prov] || DEFAULT_MODELS[prov] || [];
          if (config.model && availableModels.some((m: any) => m.id === config.model)) {
            setModel(config.model);
          } else if (availableModels.length > 0) {
            setModel(availableModels[0].id);
          }
          setHasKey(config.has_key);
          setMaskedKey(config.masked_key || '');
          setCustomEndpoint(config.custom_endpoint || '');
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
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Free & Recommended)', context: '128k tokens' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Ultra-Fast 500+ tok/s)', context: '128k tokens' },
  ];

  const handleProviderChange = (newProvider: 'groq' | 'gemini' | 'openai' | 'anthropic' | 'ollama') => {
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
      const res = await api.testAISettings(provider, model, apiKey.trim() || undefined);
      setTestResult(res);
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
      await api.saveAISettings(
        provider,
        model,
        apiKey.trim() || undefined,
        customEndpoint.trim() || undefined
      );
      setSaveSuccess(true);
      if (apiKey.trim()) {
        setHasKey(true);
        setMaskedKey(apiKey.slice(0, 4) + '••••••••' + apiKey.slice(-4));
        setApiKey('');
      }
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
                Configure your preferred LLM provider for live code reasoning and incident diagnosis
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
          {/* Provider Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Select AI Reasoning Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {[
                { id: 'groq', label: 'Groq Cloud', sub: 'Ultra-Fast Free', highlight: true },
                { id: 'gemini', label: 'Google Gemini', sub: 'Free Tier (1M)', highlight: false },
                { id: 'openai', label: 'OpenAI', sub: 'GPT-4o / o1', highlight: false },
                { id: 'anthropic', label: 'Anthropic', sub: 'Claude 3.5', highlight: false },
                { id: 'ollama', label: 'Ollama', sub: '100% Local', highlight: false },
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

          {/* Model Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Reasoning Model
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
                💡 <strong>Your single free Groq API key works for all models above.</strong> No separate key or model setup is needed. <code>Llama 3.3 70B</code> is recommended for deep incident diagnosis.
              </p>
            )}
            {provider === 'gemini' && (
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                💡 <strong>Note:</strong> Gemini models require an API key from <strong>Google AI Studio</strong> (keys start with <code>AIza...</code>).
              </p>
            )}
          </div>

          {/* API Key Input */}
          {provider !== 'ollama' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key size={13} className="text-accent-blue" />
                  {provider === 'groq'
                    ? 'Groq Cloud API Key (Free)'
                    : provider === 'gemini'
                    ? 'Google Gemini API Key (Free)'
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
                    <span>Get free Groq key</span>
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
                    <span>Get free Gemini key</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>

              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasKey ? `Currently using ${maskedKey}` : 'Paste your API key here (e.g. AIzaSy...)'}
                  className="input-field text-xs py-2.5 pr-24 font-mono"
                />
                {hasKey && !apiKey && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-2 py-0.5 rounded bg-status-success/15 text-status-success border border-status-success/30 font-medium">
                    Configured
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Keys are stored locally or in session. Never transmitted to third parties except the chosen provider.
              </p>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Server size={13} className="text-accent-blue" />
                Ollama Endpoint URL
              </label>
              <input
                type="text"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="input-field text-xs py-2.5 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Ensure Ollama is running locally with <code>ollama run llama3.2</code>
              </p>
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
              disabled={testing || (!apiKey && !hasKey && provider !== 'ollama')}
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
