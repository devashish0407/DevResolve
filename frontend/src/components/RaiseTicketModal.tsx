import { useState, useEffect } from 'react';
import {
  X,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { api, Ticket as TicketType } from '../lib/api';

interface RaiseTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSubject?: string;
  initialDescription?: string;
  initialCategory?: string;
  initialPriority?: string;
  projectName?: string;
  conversationId?: string;
  onTicketCreated?: (ticket: TicketType) => void;
}

export default function RaiseTicketModal({
  isOpen,
  onClose,
  initialSubject = '',
  initialDescription = '',
  initialCategory = 'ai_service',
  initialPriority = 'high',
  projectName,
  conversationId,
  onTicketCreated,
}: RaiseTicketModalProps) {
  const [title, setTitle] = useState(initialSubject);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState(initialCategory);
  const [priority, setPriority] = useState(initialPriority);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<TicketType | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialSubject || (projectName ? `Service Disruption in ${projectName}` : 'AI Investigation Service Issue'));
      setDescription(
        initialDescription ||
          (conversationId
            ? `An issue occurred during active investigation.\n• Project: ${projectName || 'Active Workspace'}\n• Conversation ID: ${conversationId}\n• Timestamp: ${new Date().toISOString()}`
            : '')
      );
      setCategory(initialCategory || 'ai_service');
      setPriority(initialPriority || 'high');
      setCreatedTicket(null);
      setError(null);
    }
  }, [isOpen, initialSubject, initialDescription, initialCategory, initialPriority, projectName, conversationId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please provide both a ticket subject and a detailed description.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ticket = await api.createTicket({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        metadata: {
          project_name: projectName,
          conversation_id: conversationId,
          source: 'chat_investigation_alert',
        },
      });

      setCreatedTicket(ticket);
      if (onTicketCreated) {
        onTicketCreated(ticket);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit support ticket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'medium':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-xl overflow-hidden shadow-2xl border border-slate-700 rounded-2xl animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between bg-dark-850/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Ticket size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Raise Support Ticket
              </h3>
              <p className="text-xs text-slate-400">
                Log an incident report or request engineering intervention
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        {createdTicket ? (
          /* Success Screen */
          <div className="p-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-glow-emerald">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
                Ticket Created #{createdTicket.id}
              </span>
              <h4 className="text-lg font-bold text-white mt-2">
                Issue Reported Successfully
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                Your incident has been dispatched directly to our on-call engineering team. Your session and codebase context remain completely safe.
              </p>
            </div>

            {/* Ticket details summary card */}
            <div className="p-4 rounded-xl bg-dark-900 border border-surface-border text-left space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                <span className="text-slate-400">Ticket Subject</span>
                <span className="font-semibold text-white truncate max-w-xs">{createdTicket.title}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                <span className="text-slate-400">Status</span>
                <span className="text-status-warning font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-pulse" />
                  Investigating (Assigned)
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-surface-border/60">
                <span className="text-slate-400">Priority Level</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityBadge(createdTicket.priority)}`}>
                  {createdTicket.priority.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock size={12} className="text-cyan-400" />
                  Estimated Response SLA
                </span>
                <span className="text-cyan-300 font-medium">{createdTicket.estimated_resolution}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2.5 text-left text-xs text-emerald-300">
              <ShieldCheck size={18} className="shrink-0 text-emerald-400" />
              <span>You will receive live notification updates in your top bar notification bell as work proceeds.</span>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="btn-gradient w-full py-2.5 rounded-xl font-medium text-xs shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Ticket Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Peace of mind banner */}
            <div className="p-3 rounded-xl bg-accent-blue/10 border border-accent-blue/20 flex items-start gap-2.5 text-xs text-slate-300">
              <ShieldCheck size={17} className="shrink-0 text-accent-blue mt-0.5" />
              <div>
                <p className="font-semibold text-white">Encapsulated Incident Logging</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Submitting a ticket automatically logs your session state with zero exposure of your private source code.
                </p>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ticket Subject <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Investigation engine offline or unexpected response"
                className="input-field w-full py-2 text-xs"
                required
              />
            </div>

            {/* Category & Priority Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field w-full py-2 text-xs bg-dark-850"
                >
                  <option value="ai_service">AI Investigation Engine</option>
                  <option value="diagnostics">Root Cause Diagnosis</option>
                  <option value="connectivity">Server & Network Status</option>
                  <option value="sandbox">Sandbox Test Runner</option>
                  <option value="other">General Support</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="input-field w-full py-2 text-xs bg-dark-850"
                >
                  <option value="low">Low (General Query)</option>
                  <option value="medium">Medium (Non-blocking)</option>
                  <option value="high">High (Service Disrupted)</option>
                  <option value="critical">Critical (Blocking Production)</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Incident Description & Details <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what occurred, any unexpected response, or what needs assistance..."
                rows={4}
                className="input-field w-full py-2 text-xs resize-none"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost text-xs px-4 py-2 border border-surface-border text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim() || !description.trim()}
                className="btn-gradient text-xs px-5 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-white" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} className="text-white" />
                    <span>Submit Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

