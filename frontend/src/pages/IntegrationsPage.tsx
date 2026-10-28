import { useState, useEffect } from 'react';
import {
  Plug,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  X,
  Terminal,
  Key,
  FolderGit2,
  Lock,
  GitBranch,
} from 'lucide-react';
import { GithubIcon } from '../components/icons';
import { api, Integration } from '../lib/api';
import GitHubImportModal from '../components/GitHubImportModal';

const defaultIntegrations: Integration[] = [
  {
    id: 'github',
    name: 'GitHub Enterprise / Cloud',
    category: 'vcs',
    description: 'Sync repositories, branch diffs, pull request comments, and actions workflows.',
    status: 'disconnected',
    lastSync: undefined,
    iconBg: 'bg-slate-800 text-white',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'vcs',
    description: 'Index merge requests, CI pipelines, and repository commit histories.',
    status: 'disconnected',
    lastSync: undefined,
    iconBg: 'bg-orange-500/10 text-orange-400',
  },
  {
    id: 'sentry',
    name: 'Sentry Crash Reporting',
    category: 'monitoring',
    description: 'Ingest stack traces, unhandled exceptions, and tag telemetry directly into investigations.',
    status: 'disconnected',
    lastSync: undefined,
    iconBg: 'bg-purple-500/10 text-purple-400',
  },
  {
    id: 'datadog',
    name: 'Datadog Logs & APM',
    category: 'monitoring',
    description: 'Query trace IDs, live server logs, and latency spikes during incident RCA.',
    status: 'disconnected',
    lastSync: undefined,
    iconBg: 'bg-indigo-500/10 text-indigo-400',
  },
  {
    id: 'slack',
    name: 'Slack Alerts Bot',
    category: 'chat',
    description: 'Post automated root-cause summaries and test validation reports into incident channels.',
    status: 'disconnected',
    lastSync: undefined,
    iconBg: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    category: 'monitoring',
    description: 'Auto-trigger DevResolve investigations as soon as high-severity alerts fire.',
    status: 'disconnected',
    lastSync: undefined,
    iconBg: 'bg-green-500/10 text-green-400',
  },
  {
    id: 'jira',
    name: 'Atlassian Jira',
    category: 'cicd',
    description: 'Link diagnosed incidents with bug tickets and auto-generate mitigation plans.',
    status: 'disconnected',
    lastSync: undefined,
    iconBg: 'bg-blue-500/10 text-blue-400',
  },
  {
    id: 'docker',
    name: 'Docker Sandbox Runner',
    category: 'cicd',
    description: 'Isolated container environment for testing patches with pytest and node test runner.',
    status: 'disconnected',
    lastSync: undefined,
    iconBg: 'bg-cyan-500/10 text-cyan-400',
  },
];

export default function IntegrationsPage() {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [integrations, setIntegrations] = useState<Integration[]>(defaultIntegrations);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Connect Credential Modal State
  const [connectingItem, setConnectingItem] = useState<Integration | null>(null);
  const [credentialToken, setCredentialToken] = useState('');
  const [targetRepo, setTargetRepo] = useState('devresolve-workspace/core-service');
  const [targetBranch, setTargetBranch] = useState('main');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // MCP Gateway Modal State
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [selectedMcpTool, setSelectedMcpTool] = useState('github_fetch_repo_tree');
  const [mcpToolOutput, setMcpToolOutput] = useState<any | null>(null);
  const [mcpTesting, setMcpTesting] = useState(false);
  const [isGitHubImportModalOpen, setIsGitHubImportModalOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getIntegrations();
        if (res && res.length > 0) {
          setIntegrations(res);
        }
      } catch (err) {
        console.warn('Using local integration cache', err);
      }
    }
    load();
  }, []);

  const openConnectModal = (item: Integration) => {
    setConnectingItem(item);
    setCredentialToken('');
    setConnectError(null);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectingItem) return;

    setIsConnecting(true);
    setConnectError(null);

    try {
      const payload: Record<string, any> = {
        token: credentialToken.trim(),
        repo: targetRepo.trim(),
        branch: targetBranch.trim(),
      };
      if (connectingItem.id === 'sentry') {
        payload.dsn = credentialToken.trim();
      } else if (connectingItem.id === 'slack') {
        payload.webhook_url = credentialToken.trim();
      }

      const updated = await api.connectIntegration(connectingItem.id, payload);
      setIntegrations((prev) =>
        prev.map((item) => (item.id === connectingItem.id ? updated : item))
      );
      setConnectingItem(null);
      setSyncToast(`Successfully connected and authenticated ${connectingItem.name}`);
      setTimeout(() => setSyncToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to connect integration', err);
      setConnectError(err.message || 'Connection failed: invalid credentials');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      const updated = await api.disconnectIntegration(id);
      setIntegrations((prev) =>
        prev.map((item) => (item.id === id ? updated : item))
      );
      setSyncToast(`Disconnected ${id}`);
      setTimeout(() => setSyncToast(null), 3000);
    } catch {
      setIntegrations((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'disconnected', lastSync: undefined }
            : item
        )
      );
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    setSyncToast(null);
    try {
      const res = await api.syncAllIntegrations();
      setSyncToast(res.message);
      const updated = await api.getIntegrations();
      if (updated && updated.length > 0) setIntegrations(updated);
    } catch (err: any) {
      setSyncToast(err.message || 'Error synchronizing integrations');
    } finally {
      setIsSyncingAll(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  const handleExecuteMcpTool = async (toolName: string) => {
    setMcpTesting(true);
    setMcpToolOutput(null);
    try {
      const res = await api.executeMcpTool(toolName, {
        file_path: 'backend/app/main.py',
        branch: 'main',
        query: 'connection pool timeout in session.py',
      });
      setMcpToolOutput(res);
    } catch (err: any) {
      setMcpToolOutput({
        error: true,
        tool: toolName,
        detail: err.message || 'Permission denied or execution error',
      });
    } finally {
      setMcpTesting(false);
    }
  };

  const filtered = integrations.filter((item) => {
    const matchesCat = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const githubConnected = integrations.find((i) => i.id === 'github')?.status === 'connected';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Toast */}
      {syncToast && (
        <div className="fixed top-6 right-6 z-50 glass-card px-4 py-3 border-accent-blue/40 text-white text-xs flex items-center gap-2 shadow-xl animate-slide-up">
          <CheckCircle2 size={16} className="text-accent-blue" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Plug className="text-accent-blue" size={24} />
            <h1 className="text-2xl font-bold text-white">Integrations & Data Sources</h1>
          </div>
          <p className="text-sm text-slate-400">
            Connect code repositories, log pipelines, telemetry platforms, and test sandboxes with genuine credentials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="btn-ghost flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={`text-slate-400 ${
                isSyncingAll ? 'animate-spin text-accent-blue' : ''
              }`}
            />
            {isSyncingAll ? 'Syncing...' : 'Sync Connected'}
          </button>
          <button
            onClick={() => setIsMcpModalOpen(true)}
            className="btn-gradient flex items-center gap-2 text-sm shadow-md"
          >
            <ShieldCheck size={16} />
            MCP Protocol Gateway
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search integrations..."
            className="input-field pl-10 text-sm py-2"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          <Filter size={16} className="text-slate-500 mr-1 shrink-0" />
          {[
            { id: 'all', label: 'All' },
            { id: 'vcs', label: 'Code & VCS' },
            { id: 'monitoring', label: 'Logs & APM' },
            { id: 'cicd', label: 'CI/CD & Sandbox' },
            { id: 'chat', label: 'Notifications' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterCategory === cat.id
                  ? 'bg-accent-blue text-white'
                  : 'text-slate-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => {
          const isConnected = item.status === 'connected';

          return (
            <div
              key={item.id}
              className={`glass-card p-6 flex flex-col justify-between transition-all duration-300 ${
                isConnected ? 'border-accent-blue/30 shadow-lg shadow-accent-blue/5' : 'border-surface-border/50 opacity-80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${item.iconBg}`}
                  >
                    {item.id === 'github' ? <GithubIcon size={24} /> : <Plug size={22} />}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                      isConnected
                        ? 'bg-status-success/15 text-status-success border border-status-success/30'
                        : 'bg-dark-700 text-slate-400 border border-surface-border'
                    }`}
                  >
                    {isConnected ? (
                      <>
                        <CheckCircle2 size={12} />
                        Connected
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} />
                        Disconnected
                      </>
                    )}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-white mb-1.5">{item.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{item.description}</p>
              </div>

              <div className="pt-4 border-t border-surface-border/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {item.lastSync ? `Synced: ${item.lastSync}` : 'Awaiting authentication'}
                </span>

                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      {item.id === 'github' && (
                        <button
                          onClick={() => setIsGitHubImportModalOpen(true)}
                          className="btn-gradient text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
                        >
                          <FolderGit2 size={13} />
                          <span>Import Repo</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDisconnect(item.id)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-dark-800 text-slate-300 hover:bg-status-danger/20 hover:text-status-danger transition-all"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openConnectModal(item)}
                      className="btn-gradient text-xs py-1.5 px-3 flex items-center gap-1 shadow-md"
                    >
                      <span>Connect</span>
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Credential Connection Modal ────────────────────────────── */}
      {connectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 space-y-4 border border-surface-border shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connectingItem.iconBg}`}>
                  {connectingItem.id === 'github' ? <GithubIcon size={18} /> : <Plug size={16} />}
                </div>
                <h3 className="text-base font-bold text-white">Connect {connectingItem.name}</h3>
              </div>
              <button
                onClick={() => setConnectingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Provide your authentication credentials to grant DevResolve MCP permissions to inspect code and telemetry.
            </p>

            {connectError && (
              <div className="p-3 rounded-lg bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{connectError}</span>
              </div>
            )}

            <form onSubmit={handleConnectSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Key size={13} className="text-accent-blue" />
                  <span>
                    {connectingItem.id === 'github'
                      ? 'Personal Access Token (PAT) *'
                      : connectingItem.id === 'sentry'
                      ? 'Sentry DSN or Auth Token *'
                      : 'Incoming Webhook URL / Token *'}
                  </span>
                </label>
                <input
                  type="password"
                  required
                  value={credentialToken}
                  onChange={(e) => setCredentialToken(e.target.value)}
                  placeholder={
                    connectingItem.id === 'github'
                      ? 'ghp_xxxxxxxxxxxxxxxxxxxx'
                      : connectingItem.id === 'sentry'
                      ? 'https://key@sentry.io/project'
                      : 'https://hooks.slack.com/services/...'
                  }
                  className="input-field font-mono text-xs py-2"
                />
                {connectingItem.id === 'github' && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Token requires <code>repo</code> and <code>read:org</code> scopes for MCP tool execution.
                  </p>
                )}
              </div>

              {connectingItem.id === 'github' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <FolderGit2 size={13} className="text-accent-blue" />
                      <span>Target Repository</span>
                    </label>
                    <input
                      type="text"
                      value={targetRepo}
                      onChange={(e) => setTargetRepo(e.target.value)}
                      placeholder="owner/repo-name"
                      className="input-field text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <GitBranch size={13} className="text-accent-blue" />
                      <span>Default Branch</span>
                    </label>
                    <input
                      type="text"
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      placeholder="main"
                      className="input-field text-xs py-2"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConnectingItem(null)}
                  disabled={isConnecting}
                  className="btn-ghost text-xs px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="btn-gradient text-xs px-4 py-2 flex items-center gap-1.5 shadow-md font-semibold"
                >
                  {isConnecting ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <Lock size={13} />
                      <span>Authenticate & Connect</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MCP Protocol Config Modal ────────────────────────────── */}
      {isMcpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-2xl w-full p-6 space-y-5 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-accent-blue" />
                <h3 className="text-lg font-bold text-white">Model Context Protocol (MCP) Gateway</h3>
              </div>
              <button
                onClick={() => setIsMcpModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-dark-900/50 p-3 rounded-lg border border-surface-border">
              <p>
                DevResolve implements the <strong>Model Context Protocol (MCP standard 2024-11-05)</strong>.
                AI agent investigation steps query repository trees, AST symbols, and test sandboxes strictly through permission-gated MCP tools.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[11px] text-slate-400">GitHub MCP Status:</span>
                {githubConnected ? (
                  <span className="text-[11px] font-semibold text-status-success bg-status-success/15 border border-status-success/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={11} />
                    Permissions Granted (Authenticated)
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-status-warning bg-status-warning/15 border border-status-warning/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle size={11} />
                    Disconnected (Permissions Denied)
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Registered MCP Tools & Capabilities
              </h4>
              <div className="space-y-2">
                {[
                  {
                    name: 'github_fetch_repo_tree',
                    desc: 'Fetch full repository tree & file paths via authenticated GitHub API credentials.',
                    requires: 'GitHub Connected',
                    status: githubConnected ? 'Ready' : 'Locked (Needs PAT)',
                  },
                  {
                    name: 'github_get_file_content',
                    desc: 'Fetch line-numbered source code for root-cause diagnosis using GitHub token.',
                    requires: 'GitHub Connected',
                    status: githubConnected ? 'Ready' : 'Locked (Needs PAT)',
                  },
                  {
                    name: 'rag_search_docs',
                    desc: 'Hybrid vector & keyword semantic search over repository codebase, issues, and docs.',
                    requires: 'Internal pgvector',
                    status: 'Ready',
                  },
                  {
                    name: 'inspect_ast_symbol',
                    desc: 'Inspect AST function, class, and call-hierarchy definitions in workspace files.',
                    requires: 'Local AST Engine',
                    status: 'Ready',
                  },
                  {
                    name: 'run_sandbox_test',
                    desc: 'Execute pytest or npm test suite in isolated ephemeral Docker sandbox runner.',
                    requires: 'Docker Sandbox',
                    status: 'Ready',
                  },
                ].map((t) => (
                  <div
                    key={t.name}
                    className="p-3 rounded-lg bg-dark-900 border border-surface-border flex items-start justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-accent-blue text-xs font-semibold">
                          {t.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">[{t.requires}]</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{t.desc}</p>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                        t.status.startsWith('Ready')
                          ? 'bg-status-success/15 text-status-success border border-status-success/30'
                          : 'bg-status-warning/15 text-status-warning border border-status-warning/30'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Action Controls */}
            <div className="pt-3 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedMcpTool}
                  onChange={(e) => setSelectedMcpTool(e.target.value)}
                  className="bg-dark-800 text-white text-xs px-2.5 py-1.5 rounded-lg border border-surface-border focus:outline-none"
                >
                  <option value="github_fetch_repo_tree">Tool: github_fetch_repo_tree</option>
                  <option value="rag_search_docs">Tool: rag_search_docs</option>
                  <option value="inspect_ast_symbol">Tool: inspect_ast_symbol</option>
                  <option value="run_sandbox_test">Tool: run_sandbox_test</option>
                </select>
                <button
                  onClick={() => handleExecuteMcpTool(selectedMcpTool)}
                  disabled={mcpTesting}
                  className="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-3"
                >
                  <Terminal size={13} />
                  <span>{mcpTesting ? 'Executing...' : 'Run Test'}</span>
                </button>
              </div>

              <button
                onClick={() => setIsMcpModalOpen(false)}
                className="btn-gradient text-xs py-1.5 px-4"
              >
                Done
              </button>
            </div>

            {mcpToolOutput && (
              <div className="mt-3 p-3 rounded-lg bg-dark-950 border border-surface-border text-xs">
                <p
                  className={`font-mono text-[11px] mb-1.5 flex items-center gap-1.5 ${
                    mcpToolOutput.error ? 'text-status-danger' : 'text-status-success'
                  }`}
                >
                  {mcpToolOutput.error ? (
                    <AlertCircle size={13} />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  <span>Live MCP Response from Backend ({mcpToolOutput.tool}):</span>
                </p>
                <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto p-2 bg-dark-900 rounded max-h-48">
                  {JSON.stringify(mcpToolOutput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GitHub Whole-Project Importer Modal ─────────────── */}
      <GitHubImportModal
        isOpen={isGitHubImportModalOpen}
        onClose={() => setIsGitHubImportModalOpen(false)}
        onImported={() => {
          // reload integrations state
          api.getIntegrations().then((res) => {
            if (res && res.length > 0) setIntegrations(res);
          });
        }}
      />
    </div>
  );
}
