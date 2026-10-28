import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Sparkles,
  FolderPlus,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { api, Project } from '../lib/api';

interface NewInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (conversationId: string) => void;
}

export default function NewInvestigationModal({
  isOpen,
  onClose,
  onCreated,
}: NewInvestigationModalProps) {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('new');
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [incidentTitle, setIncidentTitle] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [errorLogs, setErrorLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    async function fetchProjects() {
      try {
        const res = await api.getProjects();
        if (res && res.projects) {
          setProjects(res.projects);
          if (res.projects.length > 0) {
            setSelectedProjectId(res.projects[0].id);
            setProjectName(res.projects[0].name);
          } else {
            setSelectedProjectId('new');
            setProjectName('');
          }
        }
      } catch (err) {
        console.warn('Could not load user projects', err);
      }
    }
    fetchProjects();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProjectId === 'new' && !projectName.trim()) {
      setErrorMsg('Please specify a project name');
      return;
    }
    if (!incidentTitle.trim()) {
      setErrorMsg('Please specify an incident title or problem summary');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      let finalProjectId: string | undefined = undefined;
      let finalProjectName = projectName.trim();

      if (selectedProjectId === 'new') {
        const newProj = await api.createProject(
          projectName.trim(),
          projectDesc.trim() || 'Custom incident investigation workspace'
        );
        finalProjectId = newProj.id;
        finalProjectName = newProj.name;
      } else {
        finalProjectId = selectedProjectId;
        const existing = projects.find((p) => p.id === selectedProjectId);
        if (existing) finalProjectName = existing.name;
      }

      // Initial message content combining title and optional error logs
      const promptContent = errorLogs.trim()
        ? `${incidentTitle.trim()}\n\n\`\`\`\n${errorLogs.trim()}\n\`\`\``
        : incidentTitle.trim();

      const conv = await api.createConversation(
        finalProjectId,
        incidentTitle.trim(),
        promptContent,
        finalProjectName
      );

      onClose();
      window.dispatchEvent(new CustomEvent('devresolve:conversation-updated'));
      if (onCreated) {
        onCreated(conv.id);
      }

      const targetProjectId = finalProjectId || conv.project_id || '';
      // Route directly into the investigation chat
      navigate(
        `/app/chat?id=${conv.id}&project=${targetProjectId}&projectName=${encodeURIComponent(
          finalProjectName
        )}`
      );
    } catch (err: any) {
      console.error('Failed to create investigation', err);
      setErrorMsg(err.message || 'Failed to start investigation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-dark-850 border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-dark-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-accent flex items-center justify-center shadow-lg">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Start New Investigation</h2>
              <p className="text-xs text-slate-400">
                Create a project workspace and launch AI root-cause analysis
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-status-danger/10 border border-status-danger/30 text-xs text-status-danger flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Project Selection / Creation */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Project / Repository Workspace
            </label>
            {projects.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSelectedProjectId('new')}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    selectedProjectId === 'new'
                      ? 'border-accent-blue bg-accent-blue/10 text-white font-medium'
                      : 'border-surface-border bg-dark-800/40 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderPlus size={14} className="text-accent-blue" />
                    <span>+ Create New Project</span>
                  </div>
                </button>
                <div className="relative">
                  <select
                    value={selectedProjectId === 'new' ? '' : selectedProjectId}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedProjectId(e.target.value);
                        const match = projects.find((p) => p.id === e.target.value);
                        if (match) setProjectName(match.name);
                      }
                    }}
                    className={`w-full p-2.5 rounded-lg border text-xs bg-dark-800 text-white focus:outline-none ${
                      selectedProjectId !== 'new'
                        ? 'border-accent-blue bg-accent-blue/10'
                        : 'border-surface-border'
                    }`}
                  >
                    <option value="" disabled>
                      Select Existing ({projects.length})
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedProjectId === 'new' && (
              <div className="space-y-3 p-3 rounded-xl bg-dark-800/40 border border-surface-border">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Auth & Billing Gateway, Mobile Client..."
                    className="input-field text-xs py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Project Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="e.g. FastAPI service with PostgreSQL subscription pipelines"
                    className="input-field text-xs py-2"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Incident Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Incident / Issue Title *
            </label>
            <input
              type="text"
              required
              value={incidentTitle}
              onChange={(e) => setIncidentTitle(e.target.value)}
              placeholder="e.g. 500 Internal Server Error in Checkout API"
              className="input-field text-sm py-2.5"
            />
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Incident Severity
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                    severity === sev
                      ? sev === 'critical'
                        ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                        : sev === 'high'
                        ? 'border-status-warning bg-status-warning/20 text-status-warning'
                        : sev === 'medium'
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                        : 'border-status-success bg-status-success/20 text-status-success'
                      : 'border-surface-border bg-dark-800/40 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Initial Error Logs / Trace (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Stack Trace or Symptoms (Optional)</span>
              <span className="text-[10px] text-slate-500 font-normal">Parsed by RAG engine</span>
            </label>
            <textarea
              rows={3}
              value={errorLogs}
              onChange={(e) => setErrorLogs(e.target.value)}
              placeholder="Paste exception trace, HTTP 500 log, or description of the failure..."
              className="input-field font-mono text-xs py-2 leading-relaxed"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-surface-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-gradient text-xs px-5 py-2.5 flex items-center gap-2 font-semibold shadow-lg"
            >
              {loading ? (
                <span>Launching...</span>
              ) : (
                <>
                  <span>Launch Investigation & Open Chat</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
