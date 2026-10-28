import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Search,
  GitBranch,
  FolderGit2,
  Lock,
  Globe,
  Loader2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Key,
} from 'lucide-react';
import { api } from '../lib/api';

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: (projectId: string, repo: string) => void;
}

export default function GitHubImportModal({
  isOpen,
  onClose,
  onImported,
}: GitHubImportModalProps) {
  const navigate = useNavigate();

  const [connected, setConnected] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // PAT Connect fallback state
  const [patToken, setPatToken] = useState('');
  const [connectingPat, setConnectingPat] = useState(false);

  // Selected Repo state
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [branches, setBranches] = useState<string[]>(['main']);
  const [projectName, setProjectName] = useState('');

  // Import execution state
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState<string>('');
  const [importResult, setImportResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setImportResult(null);
    loadGitHubState();
  }, [isOpen]);

  async function loadGitHubState() {
    setLoading(true);
    try {
      const res = await api.getGitHubRepos();
      if (res && res.repos) {
        setConnected(true);
        setUserInfo(res.user);
        setRepos(res.repos);
        if (res.repos.length > 0) {
          const first = res.repos[0];
          setSelectedRepo(first.full_name);
          setSelectedBranch(first.default_branch || 'main');
          setProjectName(first.name.replace(/-/g, ' ').replace(/_/g, ' '));
          fetchBranches(first.full_name);
        }
      }
    } catch (err: any) {
      // GitHub not connected yet
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBranches(repoFullName: string) {
    try {
      const res = await api.getGitHubBranches(repoFullName);
      if (res && res.branches && res.branches.length > 0) {
        setBranches(res.branches);
        setSelectedBranch(res.branches[0]);
      } else {
        setBranches(['main', 'master']);
      }
    } catch (err) {
      setBranches(['main', 'master']);
    }
  }

  const handleSelectRepo = (repo: any) => {
    setSelectedRepo(repo.full_name);
    setSelectedBranch(repo.default_branch || 'main');
    setProjectName(repo.name.replace(/-/g, ' ').replace(/_/g, ' '));
    fetchBranches(repo.full_name);
  };

  const handleConnectWithPat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patToken.trim()) return;

    setConnectingPat(true);
    setErrorMsg(null);
    try {
      await api.connectIntegration('github', {
        token: patToken.trim(),
        repo: 'workspace/repo',
        branch: 'main',
      });
      await loadGitHubState();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate GitHub token');
    } finally {
      setConnectingPat(false);
    }
  };

  const handleImportProject = async () => {
    if (!selectedRepo) return;

    setImporting(true);
    setErrorMsg(null);
    setImportStep('1/3: Recursively fetching Git tree & code files from GitHub MCP...');

    try {
      const result = await api.importGitHubProject(
        selectedRepo,
        selectedBranch,
        projectName.trim() || undefined
      );

      setImportStep('3/3: Project Workspace created and AST index synchronized!');
      setImportResult(result);

      if (onImported) {
        onImported(result.project_id, selectedRepo);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to import and index repository');
    } finally {
      setImporting(false);
    }
  };

  const filteredRepos = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-dark-850 border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-dark-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent-blue to-cyan-500 flex items-center justify-center shadow-lg">
              <FolderGit2 size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Import GitHub Repository (MCP)</h2>
                {connected && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-success/15 text-status-success border border-status-success/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={10} /> Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Autonomous whole-project ingestion: AST symbol resolution and RAG indexing
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-center gap-2">
              <span>{errorMsg}</span>
            </div>
          )}

          {!connected ? (
            /* Connect GitHub PAT Form */
            <form onSubmit={handleConnectWithPat} className="space-y-4">
              <div className="glass-card p-5 border border-slate-700/80 space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Key size={16} className="text-accent-blue" />
                  Connect GitHub with Personal Access Token (PAT)
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  To allow DevResolve MCP to fetch your repositories, list trees, and index code, provide a GitHub PAT with <code>repo</code> and <code>read:org</code> scopes.
                </p>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    GitHub Personal Access Token (classic or fine-grained)
                  </label>
                  <input
                    type="password"
                    value={patToken}
                    onChange={(e) => setPatToken(e.target.value)}
                    placeholder="ghp_••••••••••••••••••••••••••••••••"
                    className="input-field text-xs py-2.5 font-mono w-full"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=DevResolve-Incident-Engineer"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent-blue hover:underline flex items-center gap-1"
                  >
                    <span>Generate token on GitHub</span>
                    <ExternalLink size={12} />
                  </a>

                  <button
                    type="submit"
                    disabled={connectingPat || !patToken.trim()}
                    className="btn-gradient text-xs py-2 px-4 flex items-center gap-2 disabled:opacity-50"
                  >
                    {connectingPat ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>{connectingPat ? 'Verifying Token...' : 'Authenticate & Connect'}</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Repository Browser & Importer */
            <div className="space-y-4">
              {/* Authenticated user badge */}
              {userInfo && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-dark-900 border border-surface-border">
                  <div className="flex items-center gap-2.5">
                    {userInfo.avatar_url ? (
                      <img src={userInfo.avatar_url} alt="avatar" className="w-7 h-7 rounded-full border border-slate-700" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center font-bold text-xs">
                        {userInfo.login?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{userInfo.name || userInfo.login}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-normal">@{userInfo.login}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {repos.length} repositories available
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                    MCP Ready
                  </span>
                </div>
              )}

              {/* Repo Search & List */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Select Repository to Ingest
                </label>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your GitHub repositories..."
                    className="input-field text-xs pl-9 py-2 w-full"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-surface-border bg-dark-900/60 p-1.5">
                  {loading ? (
                    <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-accent-blue" />
                      Loading repositories from GitHub...
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching repositories found.
                    </div>
                  ) : (
                    filteredRepos.map((r) => {
                      const isSelected = selectedRepo === r.full_name;
                      return (
                        <button
                          key={r.id || r.full_name}
                          type="button"
                          onClick={() => handleSelectRepo(r)}
                          className={`w-full p-2.5 rounded-lg text-left text-xs transition-colors flex items-center justify-between ${
                            isSelected
                              ? 'bg-accent-blue/15 border border-accent-blue/40 text-white'
                              : 'hover:bg-surface-hover text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {r.private ? (
                              <Lock size={12} className="text-amber-400 shrink-0" />
                            ) : (
                              <Globe size={12} className="text-slate-400 shrink-0" />
                            )}
                            <span className="font-semibold truncate">{r.full_name}</span>
                            {r.language && (
                              <span className="text-[10px] text-slate-500 px-1.5 py-0.2 rounded bg-dark-800">
                                {r.language}
                              </span>
                            )}
                          </div>
                          {isSelected && <CheckCircle2 size={14} className="text-accent-blue shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Branch & Project Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                    <GitBranch size={12} className="text-accent-blue" />
                    Target Branch
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="input-field text-xs py-2 w-full bg-dark-900"
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Workspace Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Service Workspace"
                    className="input-field text-xs py-2 w-full"
                  />
                </div>
              </div>

              {/* Live import feedback */}
              {importStep && (
                <div className="p-3 rounded-xl bg-accent-blue/10 border border-accent-blue/30 text-xs text-accent-blue flex items-center gap-2 animate-fade-in">
                  <Loader2 size={14} className="animate-spin shrink-0" />
                  <span>{importStep}</span>
                </div>
              )}

              {importResult && (
                <div className="p-4 rounded-xl bg-status-success/15 border border-status-success/30 text-xs text-status-success space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 size={16} />
                    Project Ingested & Synchronized!
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-slate-300">
                    <div className="p-2 rounded bg-dark-900/60 border border-surface-border">
                      <div className="text-slate-400 text-[10px]">Files Fetched</div>
                      <div className="font-bold text-white text-sm">{importResult.files_downloaded}</div>
                    </div>
                    <div className="p-2 rounded bg-dark-900/60 border border-surface-border">
                      <div className="text-slate-400 text-[10px]">AST Chunks</div>
                      <div className="font-bold text-white text-sm">{importResult.ast_chunks_indexed}</div>
                    </div>
                    <div className="p-2 rounded bg-dark-900/60 border border-surface-border">
                      <div className="text-slate-400 text-[10px]">RAG Total</div>
                      <div className="font-bold text-white text-sm">{importResult.total_rag_chunks}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border bg-dark-800/80 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost text-xs py-2 px-4"
          >
            Close
          </button>

          {connected && !importResult && (
            <button
              type="button"
              onClick={handleImportProject}
              disabled={importing || !selectedRepo}
              className="btn-gradient text-xs py-2.5 px-5 flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{importing ? 'Ingesting Project...' : '⚡ Fetch & Index Whole Project'}</span>
            </button>
          )}

          {importResult && (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/app/chat?project=${importResult.project_id}&projectName=${encodeURIComponent(importResult.project_name)}`);
              }}
              className="btn-gradient text-xs py-2.5 px-5 flex items-center gap-2 shadow-md"
            >
              <span>Open in Investigation Chat</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
