import { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Clock,
  ShieldCheck,
  Trash2,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  Sparkles,
  Database,
} from 'lucide-react';
import { api } from '../lib/api';

interface DocumentLifecycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onDocumentAttached?: (fileName: string, content: string) => void;
}

export default function DocumentLifecycleModal({
  isOpen,
  onClose,
  projectId,
  onDocumentAttached,
}: DocumentLifecycleModalProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [retentionMode] = useState<'persistent'>('persistent');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.getDocuments(projectId);
      if (res && res.documents) {
        setDocuments(res.documents);
      }
    } catch (err: any) {
      console.warn('Failed to load documents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      setActionSuccess(null);
      setErrorMessage(null);
      setSelectedFile(null);
      setFileContent('');
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text || '');
    };
    reader.readAsText(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileContent) return;

    setUploading(true);
    setErrorMessage(null);
    try {
      const res = await api.ingestDocument({
        name: selectedFile.name,
        content: fileContent,
        retention_mode: retentionMode,
        project_id: projectId,
        source_type: selectedFile.name.endsWith('.log') ? 'log' : 'code',
      });

      if (res && res.document) {
        setActionSuccess(
          `Document '${selectedFile.name}' indexed permanently in Persistent Workspace.`
        );
        if (onDocumentAttached) {
          onDocumentAttached(selectedFile.name, fileContent);
        }
        setSelectedFile(null);
        setFileContent('');
        await loadDocuments();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload and index document.');
    } finally {
      setUploading(false);
    }
  };

  const handleConvertToPersistent = async (docId: string, docName: string) => {
    try {
      await api.convertDocumentToPersistent(docId);
      setActionSuccess(`Upgraded '${docName}' to Persistent Workspace (kept until deleted).`);
      await loadDocuments();
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not upgrade document.');
    }
  };

  const handleDelete = async (docId: string, docName: string) => {
    try {
      await api.deleteDocument(docId);
      setActionSuccess(`Document '${docName}' deleted and immediately invalidated from AI retrieval.`);
      await loadDocuments();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete document.');
    }
  };

  const handleTriggerCleanup = async () => {
    try {
      const res = await api.triggerDocumentCleanup();
      setActionSuccess(
        `Cleanup queue ran: Purged ${res.purged_count} expired documents (${res.freed_chunks} chunks, ${res.freed_bytes.toLocaleString()} bytes freed).`
      );
      await loadDocuments();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to run cleanup worker.');
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-dark-850 border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-dark-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-accent-blue to-indigo-500 flex items-center justify-center shadow-lg">
              <Database size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Workspace Knowledge & Documents</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-semibold">
                  Persistent Storage
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Uploaded files and semantic embeddings are permanently stored in this workspace
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Notifications */}
          {actionSuccess && (
            <div className="p-3 rounded-xl bg-status-success/15 border border-status-success/30 text-xs text-status-success font-medium flex items-center gap-2">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-medium flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Upload & Ingestion Section */}
          <div className="p-4 rounded-xl border border-surface-border bg-dark-900/90 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <UploadCloud size={16} className="text-accent-blue" />
                Upload New Document / Code File
              </span>
              <span className="text-[11px] text-slate-400 font-mono">AST Chunking & Vector Ingestion</span>
            </div>

            {/* Permanent Workspace Storage Badge */}
            <div className="p-3.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 flex items-start gap-3">
              <ShieldCheck size={18} className="text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Persistent Workspace (Permanent Storage)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    Default
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Indexed files, AST chunks, and vector embeddings are stored permanently in your project workspace.
                </p>
              </div>
            </div>

            {/* File Drop / Select Area */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".txt,.log,.py,.ts,.tsx,.json,.md,.csv,.js,.jsx,.yaml,.yml,.sql,.html,.css"
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-surface-border hover:border-accent-blue/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-dark-850/50 hover:bg-dark-800/50"
              >
                <FileText size={28} className="mx-auto text-slate-500 mb-2" />
                <div className="text-xs font-semibold text-slate-200">
                  Click to select a file (Logs, Python, TS, MD, JSON, etc.)
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Files are chunked via AST and indexed for semantic incident response
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-accent-blue/30 bg-accent-blue/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={18} className="text-accent-blue shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{selectedFile.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {formatSize(selectedFile.size)} • Mode:{' '}
                      <span className="font-semibold text-accent-blue">
                        Persistent Workspace
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileContent('');
                    }}
                    className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Remove file"
                  >
                    <X size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading}
                    className="btn-gradient text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>{uploading ? 'Chunking...' : 'Index & Ingest'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active Documents List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <HardDrive size={15} className="text-cyan-400" />
                Active Knowledge Documents ({documents.length})
              </span>
              <button
                type="button"
                onClick={handleTriggerCleanup}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                title="Run automatic queue cleanup of expired temporary records"
              >
                <span>Run Cleanup Worker</span>
                <Clock size={11} className="text-amber-400" />
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-accent-blue" />
                <span>Loading document registry...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-surface-border bg-dark-900/50 text-xs text-slate-500">
                No documents indexed yet. Upload logs or source files above for semantic RAG diagnosis.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl border border-surface-border bg-dark-900/80 flex items-center justify-between gap-3 hover:border-slate-600 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-dark-800 border border-surface-border flex items-center justify-center text-slate-300 shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{doc.name}</span>
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                              doc.retention_mode === 'temporary'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            {doc.retention_mode === 'temporary'
                              ? `⚡ Expires in ${doc.time_remaining_label}`
                              : '📁 Persistent'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{formatSize(doc.file_size_bytes)}</span>
                          <span>•</span>
                          <span>{doc.chunk_count} RAG chunks</span>
                          {doc.retention_mode === 'temporary' && doc.expires_at && (
                            <>
                              <span>•</span>
                              <span className="text-amber-400/90 font-mono">
                                Auto-purge: {new Date(doc.expires_at).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {doc.retention_mode === 'temporary' && (
                        <button
                          type="button"
                          onClick={() => handleConvertToPersistent(doc.id, doc.name)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1 transition-colors"
                          title="Keep this document permanently in your workspace"
                        >
                          <ShieldCheck size={12} />
                          <span>Keep Persistently</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id, doc.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Delete document and immediately purge from AI search"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-surface-border bg-dark-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-success" />
            <span>Search Invalidation: Deleted documents immediately exit AI answers</span>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost text-xs py-1.5 px-4">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
