import { useState } from 'react';
import {
  Settings,
  Key,
  Cpu,
  Shield,
  Save,
  CheckCircle2,
  Server
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'models' | 'sandbox' | 'security'>('models');
  const [saved, setSaved] = useState(false);

  // Model settings state
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [rerankThreshold, setRerankThreshold] = useState(0.75);

  // API keys
  const [openaiKey, setOpenaiKey] = useState('sk-proj-••••••••••••••••••••••••••••••••');
  const [anthropicKey, setAnthropicKey] = useState('sk-ant-••••••••••••••••••••••••••••••••');
  const [geminiKey, setGeminiKey] = useState('');

  // Sandbox settings
  const [containerTimeout, setContainerTimeout] = useState(60);
  const [memoryLimit, setMemoryLimit] = useState('1024MB');
  const [networkIsolation, setNetworkIsolation] = useState(true);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center">
              <Settings size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
          </div>
          <p className="text-sm text-slate-400">
            Configure AI reasoning engines, RAG retrieval thresholds, Docker sandbox limits, and API keys.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-gradient flex items-center gap-2 text-sm self-start md:self-auto"
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? 'Settings Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-surface-border pb-3 overflow-x-auto">
        {[
          { id: 'models', label: 'AI & Inference Models', icon: Cpu },
          { id: 'sandbox', label: 'Docker Sandbox', icon: Server },
          { id: 'security', label: 'API Keys & Secrets', icon: Key },
          { id: 'general', label: 'Security & Access', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: AI Models */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu size={18} className="text-accent-blue" />
              Primary Investigation Reasoning Model
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'gpt-4o',
                  name: 'OpenAI GPT-4o',
                  provider: 'OpenAI',
                  desc: 'High speed, reliable structured AST parsing and code patch generation.',
                  tag: 'Default',
                },
                {
                  id: 'claude-3-5-sonnet',
                  name: 'Claude 3.5 Sonnet',
                  provider: 'Anthropic',
                  desc: 'Superior complex debugging capability, multi-file architectural reasoning.',
                  tag: 'Recommended',
                },
                {
                  id: 'gemini-1-5-pro',
                  name: 'Gemini 1.5 Pro',
                  provider: 'Google',
                  desc: '2M token context window, deep full-codebase repository RAG exploration.',
                  tag: 'Long Context',
                },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedModel === m.id
                      ? 'bg-accent-blue/10 border-accent-blue shadow-md'
                      : 'bg-dark-800/60 border-surface-border hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">{m.provider}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-blue/20 text-accent-blue">
                      {m.tag}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{m.name}</h4>
                  <p className="text-xs text-slate-400">{m.desc}</p>
                </div>
              ))}
            </div>

            {/* Hyperparameters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-surface-border">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Temperature</span>
                  <span className="text-accent-blue">{temperature}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-accent-blue"
                />
                <p className="text-[11px] text-slate-500 mt-1">Lower = more deterministic diagnostic answers</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Max Tokens</span>
                  <span className="text-accent-blue">{maxTokens}</span>
                </label>
                <input
                  type="range"
                  min="1024"
                  max="8192"
                  step="512"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full accent-accent-blue"
                />
                <p className="text-[11px] text-slate-500 mt-1">Maximum token output per patch investigation</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>pgvector Similarity Cutoff</span>
                  <span className="text-accent-blue">{rerankThreshold}</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={rerankThreshold}
                  onChange={(e) => setRerankThreshold(parseFloat(e.target.value))}
                  className="w-full accent-accent-blue"
                />
                <p className="text-[11px] text-slate-500 mt-1">Cosine similarity threshold for RAG code retrieval</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Docker Sandbox */}
      {activeTab === 'sandbox' && (
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Server size={18} className="text-cyan-400" />
            Isolated Docker Sandbox Configuration
          </h3>
          <p className="text-xs text-slate-400">
            DevResolve executes test runs inside isolated Linux micro-containers to validate bug fixes without executing arbitrary code on your infrastructure.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Container Test Timeout (seconds)
              </label>
              <input
                type="number"
                value={containerTimeout}
                onChange={(e) => setContainerTimeout(parseInt(e.target.value))}
                className="input-field"
              />
              <p className="text-xs text-slate-500 mt-1">Kills pytest / npm test processes exceeding this limit</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Memory Limit per Container
              </label>
              <select
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(e.target.value)}
                className="input-field"
              >
                <option value="512MB">512 MB (Fast microservices)</option>
                <option value="1024MB">1024 MB (Standard API)</option>
                <option value="2048MB">2048 MB (Large test suites)</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-dark-900 border border-surface-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Full Network Isolation (Egress Disabled)</p>
              <p className="text-xs text-slate-400">Blocks outward network connections during test validation to prevent data exfiltration.</p>
            </div>
            <input
              type="checkbox"
              checked={networkIsolation}
              onChange={(e) => setNetworkIsolation(e.target.checked)}
              className="w-5 h-5 rounded border-surface-border bg-dark-800 text-accent-blue cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Tab 3: API Keys */}
      {activeTab === 'security' && (
        <div className="glass-card p-6 space-y-5">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Key size={18} className="text-accent-purple" />
            AI Provider Credentials & Keys
          </h3>
          <p className="text-xs text-slate-400">
            Keys are encrypted using AES-256 before being stored in the database.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">OpenAI API Key</label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="input-field font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Anthropic Claude API Key</label>
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="input-field font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Google Gemini API Key</label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="input-field font-mono text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: General Security */}
      {activeTab === 'general' && (
        <div className="glass-card p-6 space-y-5">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Shield size={18} className="text-status-success" />
            Enterprise Security & Permissions
          </h3>

          <div className="space-y-4 text-sm text-slate-300">
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-dark-900 border border-surface-border">
              <div>
                <p className="font-medium text-white">Row-Level Security (RLS)</p>
                <p className="text-xs text-slate-400">Project data strictly segregated by organization ID</p>
              </div>
              <span className="text-xs text-status-success font-semibold px-2.5 py-1 rounded-full bg-status-success/10 border border-status-success/30">
                Active & Enforced
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-lg bg-dark-900 border border-surface-border">
              <div>
                <p className="font-medium text-white">JWT Validation Middleware</p>
                <p className="text-xs text-slate-400">FastAPI backend validates Supabase bearer tokens</p>
              </div>
              <span className="text-xs text-status-success font-semibold px-2.5 py-1 rounded-full bg-status-success/10 border border-status-success/30">
                Secured
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-lg bg-dark-900 border border-surface-border">
              <div>
                <p className="font-medium text-white">Audit Trail Logging</p>
                <p className="text-xs text-slate-400">All prompt queries, code inspections, and patches logged</p>
              </div>
              <span className="text-xs text-status-success font-semibold px-2.5 py-1 rounded-full bg-status-success/10 border border-status-success/30">
                Enabled
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
