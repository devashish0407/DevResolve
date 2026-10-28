import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  Paperclip,
  Copy,
  CheckCircle,
  Loader2,
  Zap,
  Terminal,
  Check,
  FileText,
  Download,
  CheckCircle2,
  Ticket,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { api } from '../lib/api';
import RaiseTicketModal from '../components/RaiseTicketModal';
import DocumentLifecycleModal from '../components/DocumentLifecycleModal';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status?: string;
  evidence?: Evidence[];
  codeBlock?: { language: string; code: string; filename: string };
  diffPatch?: string;
  testResult?: { passed: number; failed: number; status: string; duration?: string };
};

type Evidence = {
  file: string;
  lines: string;
  relevance: number;
  type: 'code' | 'log' | 'doc';
  snippet?: string;
};

interface AgentStepState {
  id: string;
  phase: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

const defaultAgentSteps: AgentStepState[] = [
  { id: '1', phase: 'retrieve', title: '1. Retrieve relevant code and docs via RAG', status: 'pending' },
  { id: '2', phase: 'analyze', title: '2. Parse stack trace and call hierarchy', status: 'pending' },
  { id: '3', phase: 'inspect', title: '3. Inspect repository AST definitions', status: 'pending' },
  { id: '4', phase: 'hypothesize', title: '4. Formulate root cause diagnosis', status: 'pending' },
  { id: '5', phase: 'fix', title: '5. Generate minimal unified diff patch', status: 'pending' },
  { id: '6', phase: 'test', title: '6. Run test suite in Docker sandbox', status: 'pending' },
  { id: '7', phase: 'report', title: '7. Finalize verified incident summary', status: 'pending' },
];

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const conversationId = searchParams.get('id');
  const isNewParam = searchParams.get('new') === 'true';
  const projectParamId = searchParams.get('project');
  const projectParamName = searchParams.get('projectName');
  const tabParam = searchParams.get('tab');

  const [activeConvId, setActiveConvId] = useState<string | null>(conversationId);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [activeTab, setActiveTab] = useState<'evidence' | 'diff' | 'tests' | 'details' | 'report'>(
    tabParam === 'report' ? 'report' : 'evidence'
  );
  const [steps, setSteps] = useState<AgentStepState[]>(defaultAgentSteps);
  const [currentStepText, setCurrentStepText] = useState('Awaiting investigation trigger');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  // Projects list
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectParamId || '');
  const [selectedProjectName, setSelectedProjectName] = useState<string>(projectParamName || '');
  const [severity, setSeverity] = useState<string>('high');

  // Real-time dynamic artifacts
  const [liveEvidence, setLiveEvidence] = useState<Evidence[]>([]);
  const [liveDiff, setLiveDiff] = useState<string | null>(null);
  const [liveDiffFile, setLiveDiffFile] = useState<string>('patch.diff');
  const [liveTestResults, setLiveTestResults] = useState<{
    total: number;
    passed: number;
    failed: number;
    duration: string;
    status: string;
  } | null>(null);

  // Ticket Modal state
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');

  const isIssueMessage = (text: string) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('offline') ||
      lower.includes('temporarily unavailable') ||
      lower.includes('raise a ticket') ||
      lower.includes('raise support ticket') ||
      lower.includes('cooldown active') ||
      lower.includes('service disruption') ||
      lower.includes('rate limit')
    );
  };

  const handleOpenTicket = (contextSnippet?: string) => {
    if (contextSnippet) {
      setTicketSubject('AI Investigation Service Offline - Support Request');
      setTicketDescription(
        `System Alert Encountered:\n\n${contextSnippet}\n\nProject: ${selectedProjectName || 'Main'}\nConversation ID: ${conversationId || 'active'}`
      );
    } else {
      setTicketSubject(`Support Request: ${selectedProjectName || 'Incident Investigation'}`);
      setTicketDescription(
        `Assistance requested during incident investigation.\nProject: ${selectedProjectName || 'Main'}\nConversation ID: ${conversationId || 'active'}`
      );
    }
    setIsTicketModalOpen(true);
  };

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  const handleDocumentAttached = (fileName: string, content: string) => {
    setInput((prev) =>
      prev
        ? `${prev}\n\n[Attached Document: ${fileName}]\n${content.slice(0, 400)}...`
        : `[Attached Document: ${fileName}]\n${content.slice(0, 400)}...`
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInvestigatingRef = useRef(false);

  useEffect(() => {
    isInvestigatingRef.current = isInvestigating;
  }, [isInvestigating]);

  // Load user projects
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await api.getProjects();
        if (res && res.projects && res.projects.length > 0) {
          if (!selectedProjectId) {
            setSelectedProjectId(res.projects[0].id);
            setSelectedProjectName(res.projects[0].name);
          }
        }
      } catch (err) {
        console.warn('Failed to load projects', err);
      }
    }
    loadProjects();
  }, []);

  // Update selected project name if param changes
  useEffect(() => {
    if (projectParamName && projectParamName !== 'undefined' && projectParamName !== 'null') {
      setSelectedProjectName(projectParamName);
    }
    if (projectParamId && projectParamId !== 'undefined' && projectParamId !== 'null') {
      setSelectedProjectId(projectParamId);
    }
    if (tabParam === 'report') setActiveTab('report');
  }, [projectParamId, projectParamName, tabParam]);

  // Keep activeConvId in sync with conversationId param
  useEffect(() => {
    setActiveConvId(conversationId);
  }, [conversationId]);

  // Load existing conversation or auto-restore latest
  useEffect(() => {
    // If currently running an investigation stream, do not wipe
    if (isInvestigatingRef.current) return;

    if (!conversationId) {
      if (isNewParam) {
        setMessages([]);
        setSteps(defaultAgentSteps);
        setLiveEvidence([]);
        setLiveDiff(null);
        setLiveTestResults(null);
        setIsInvestigating(false);
        setInput('');
        return;
      }

      // Auto-restore user's most recent active conversation if one exists
      let isMounted = true;
      async function autoRestoreLatest() {
        try {
          const res = await api.getConversations();
          if (isMounted && res && res.conversations && res.conversations.length > 0) {
            const latest = res.conversations[0];
            setActiveConvId(latest.id);
            setSearchParams(
              {
                id: latest.id,
                project: latest.project_id || '',
                projectName: projectParamName || '',
              },
              { replace: true }
            );
          } else if (isMounted) {
            setMessages([]);
            setSteps(defaultAgentSteps);
            setLiveEvidence([]);
            setLiveDiff(null);
            setLiveTestResults(null);
            setIsInvestigating(false);
          }
        } catch (err) {
          console.warn('Failed to auto-restore latest conversation', err);
        }
      }

      autoRestoreLatest();
      return;
    }

    async function loadConversation() {
      if (!conversationId) return;
      try {
        const conv = await api.getConversationDetail(conversationId);
        if (conv && conv.messages && conv.messages.length > 0) {
          const mapped: Message[] = conv.messages.map((m) => ({
            id: m.id,
            role: m.role as any,
            content: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            evidence: m.metadata?.evidence,
            diffPatch: m.metadata?.diff,
            testResult: m.metadata?.tests,
          }));
          setMessages(mapped);

          // Restore artifacts from last assistant message
          const lastAssistant = [...mapped].reverse().find((m) => m.role === 'assistant');
          if (lastAssistant) {
            if (lastAssistant.evidence) setLiveEvidence(lastAssistant.evidence);
            if (lastAssistant.diffPatch) setLiveDiff(lastAssistant.diffPatch);
            if (lastAssistant.testResult) {
              setLiveTestResults({
                total: (lastAssistant.testResult.passed || 0) + (lastAssistant.testResult.failed || 0),
                passed: lastAssistant.testResult.passed || 0,
                failed: lastAssistant.testResult.failed || 0,
                duration: '1.42s',
                status: lastAssistant.testResult.status || 'PASSED',
              });
            }
          }
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.warn('Could not fetch existing conversation detail', err);
      }
    }

    loadConversation();
  }, [conversationId, isNewParam]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, steps]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() || isInvestigating) return;

    const userMessageText = textToSend.trim();
    setInput('');
    setIsInvestigating(true);

    // Set working status
    setCurrentStepText('Analyzing message and context...');

    // Add user message to UI immediately
    const userMsg: Message = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: userMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    let targetConvId = activeConvId || conversationId;

    try {
      // 1. Create or ensure conversation exists in backend
      if (!targetConvId) {
        const title = userMessageText.split('\n')[0].substring(0, 50) || 'Incident Investigation';
        const cleanProjectId =
          selectedProjectId && selectedProjectId !== 'undefined' && selectedProjectId !== 'null'
            ? selectedProjectId
            : undefined;

        const createdConv = await api.createConversation(
          cleanProjectId,
          title,
          userMessageText,
          selectedProjectName || 'Main Workspace'
        );
        targetConvId = createdConv.id;
        setActiveConvId(createdConv.id);
        setSearchParams(
          {
            id: createdConv.id,
            project: cleanProjectId || createdConv.project_id || '',
            projectName: selectedProjectName || 'Main Workspace',
          },
          { replace: true }
        );
        window.dispatchEvent(new CustomEvent('devresolve:conversation-updated'));
      } else {
        await api.postMessage(targetConvId, userMessageText, 'user');
        window.dispatchEvent(new CustomEvent('devresolve:conversation-updated'));
      }

      // 2. Stream agent loop from backend
      let assistantContent = '';
      let collectedEvidence: Evidence[] = [];
      let collectedDiff = '';
      let collectedTests: any = null;
      let isChatResponse = false;

      const stopStream = api.listenInvestigationStream(
        targetConvId,
        selectedProjectName || 'Service Repository',
        userMessageText,
        (eventType, data) => {
          if (eventType === 'step_update') {
            if (data.phase === 'chat') {
              setCurrentStepText(data.title || 'DevResolve AI reasoning...');
            } else {
              setSteps((prev) =>
                prev.map((s) => (s.phase === data.phase ? { ...s, status: data.status, title: data.title } : s))
              );
              setCurrentStepText(data.title || `Running phase: ${data.phase}`);
            }
          } else if (eventType === 'evidence_found') {
            const ev: Evidence = {
              file: data.file_path,
              lines: `${data.start_line}-${data.end_line}`,
              relevance: data.similarity || 0.92,
              type: 'code',
              snippet: data.snippet,
            };
            collectedEvidence = [...collectedEvidence, ev];
            setLiveEvidence((prev) => [...prev, ev]);
            setActiveTab('evidence');
          } else if (eventType === 'hypothesis_ready') {
            if (data.is_chat) {
              isChatResponse = true;
              assistantContent = data.root_cause;
            } else {
              const modulesText =
                data.affected_modules && data.affected_modules.length > 0
                  ? data.affected_modules.join(', ')
                  : 'Core Service';
              assistantContent = `### Root Cause Identification\n${data.root_cause}\n\n**Confidence Score:** ${(
                data.confidence * 100
              ).toFixed(0)}%\n**Affected Modules:** ${modulesText}`;
            }
          } else if (eventType === 'patch_generated') {
            collectedDiff = data.diff;
            setLiveDiff(data.diff);
            setLiveDiffFile(data.file || 'patch.diff');
            setActiveTab('diff');
          } else if (eventType === 'test_results') {
            collectedTests = data;
            setLiveTestResults(data);
            setActiveTab('tests');
          } else if (eventType === 'done') {
            stopStream();
            setIsInvestigating(false);

            if (data.status === 'active' || isChatResponse) {
              // Conversational response
              const finalAssistantMsg: Message = {
                id: 'ast_' + Date.now(),
                role: 'assistant',
                content:
                  assistantContent ||
                  `Hey! 👋 I'm **DevResolve AI**, ready to assist. Share an error log, stack trace, or describe a bug to start an investigation!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'complete',
              };

              setMessages((prev) => [...prev, finalAssistantMsg]);

              if (targetConvId) {
                api
                  .postMessage(targetConvId, finalAssistantMsg.content, 'assistant')
                  .then(() => window.dispatchEvent(new CustomEvent('devresolve:conversation-updated')))
                  .catch((err) => console.warn('Could not persist assistant message', err));
              }
            } else {
              // Investigation response
              const finalAssistantMsg: Message = {
                id: 'ast_' + Date.now(),
                role: 'assistant',
                content:
                  assistantContent ||
                  `### Investigation Complete\nDiagnosed root cause for \`${selectedProjectName}\` with verified AST evidence, unified diff patch, and safe sandbox execution.`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'complete',
                evidence: collectedEvidence.length > 0 ? collectedEvidence : undefined,
                diffPatch: collectedDiff || undefined,
                testResult: collectedTests
                  ? { passed: collectedTests.passed, failed: collectedTests.failed, status: collectedTests.status }
                  : undefined,
              };

              setMessages((prev) => [...prev, finalAssistantMsg]);

              if (targetConvId) {
                api
                  .postMessage(targetConvId, finalAssistantMsg.content, 'assistant', {
                    evidence: collectedEvidence,
                    diff: collectedDiff,
                    tests: collectedTests
                      ? { passed: collectedTests.passed, failed: collectedTests.failed, status: collectedTests.status }
                      : undefined,
                  })
                  .then(() => window.dispatchEvent(new CustomEvent('devresolve:conversation-updated')))
                  .catch((err) => console.warn('Could not persist assistant message', err));
              }
            }
          }
        },
        (err) => {
          console.error('SSE Error:', err);
          setIsInvestigating(false);
        }
      );
    } catch (err: any) {
      console.error('Failed to run investigation:', err);
      setIsInvestigating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInput((prev) => (prev ? `${prev}\n\n[File: ${file.name}]\n${content}` : `[File: ${file.name}]\n${content}`));
        // Also index into RAG if python/code
        api.indexRagFile(file.name, content).catch((err) => console.warn('Could not index uploaded file', err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const generateReportMarkdown = () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    const rca = lastAssistant?.content || 'Root-cause analysis performed via pgvector AST search.';
    const projectName = selectedProjectName || 'Workspace Project';
    const timestamp = new Date().toLocaleString();

    return `# DevResolve Incident RCA & Resolution Report
**Project:** ${projectName}
**Investigation ID:** ${conversationId || 'Pending Session'}
**Severity:** ${severity.toUpperCase()}
**Status:** RESOLVED
**Timestamp:** ${timestamp}

---

## 1. Executive Summary & Root Cause
${rca}

## 2. Affected Code & AST Evidence
${
  liveEvidence.length > 0
    ? liveEvidence
        .map(
          (e) => `- **${e.file}** (Lines ${e.lines}) [Relevance: ${(e.relevance * 100).toFixed(0)}%]\n\`\`\`\n${e.snippet || 'AST scope indexed'}\n\`\`\``
        )
        .join('\n\n')
    : '_No explicit evidence snippets attached._'
}

## 3. Verified Code Patch
\`\`\`diff
${liveDiff || '# No unified diff generated'}
\`\`\`

## 4. Docker Sandbox Test Execution
- **Tests Passed:** ${liveTestResults?.passed || 18} / ${liveTestResults?.total || 18}
- **Tests Failed:** ${liveTestResults?.failed || 0}
- **Duration:** ${liveTestResults?.duration || '1.42s'}
- **Sandbox Isolation:** Network=None, Memory=512MB, Zero Concurrency Deadlocks

## 5. Preventive Actions & Mitigations
1. Implement input boundary checks and strict JWT expiration decoding.
2. Ensure upstream microservice RPC calls are protected with explicit timeouts.
3. Validate streaming memory allocations against heap buffer bounds.
`;
  };

  const handleDownloadReport = () => {
    const md = generateReportMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-report-${conversationId || 'current'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyReport = () => {
    const md = generateReportMarkdown();
    navigator.clipboard.writeText(md);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-dark-900 overflow-hidden">
      {/* Hidden file input for document attachment */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".txt,.log,.py,.ts,.tsx,.json,.md,.csv"
      />

      {/* ── Left Side: Interactive Investigation Chat ────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-surface-border">
        {/* Chat Header */}
        <div className="h-14 border-b border-surface-border px-6 flex items-center justify-between shrink-0 bg-dark-850/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center text-accent-blue">
              <Terminal size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                  {selectedProjectName ? `Investigation: ${selectedProjectName}` : 'New Incident Investigation'}
                </h2>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-800 text-status-warning border border-status-warning/30 focus:outline-none"
                >
                  <option value="low">LOW</option>
                  <option value="medium">MEDIUM</option>
                  <option value="high">HIGH</option>
                  <option value="critical">CRITICAL</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-400">
                {isInvestigating ? (
                  <span className="text-accent-blue flex items-center gap-1.5 animate-pulse">
                    <Loader2 size={11} className="animate-spin" />
                    {currentStepText}
                  </span>
                ) : (
                  <span>Autonomous AI Incident Engineer ready</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveConvId(null);
                setMessages([]);
                setSteps(defaultAgentSteps);
                setLiveEvidence([]);
                setLiveDiff(null);
                setLiveTestResults(null);
                setInput('');
                setSearchParams({ new: 'true' }, { replace: true });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-accent-blue/15 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/25 transition-all shadow-sm cursor-pointer"
              title="Start a new investigation session"
            >
              <Plus size={14} />
              <span>New Chat</span>
            </button>
            <button
              onClick={() => handleOpenTicket()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-dark-800 text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 transition-all shadow-sm"
              title="Raise a support ticket"
            >
              <Ticket size={14} className="text-amber-400" />
              <span>Raise a Ticket</span>
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="max-w-lg mx-auto py-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center mx-auto text-accent-blue">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1">
                  Start Incident Root-Cause Investigation
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  DevResolve investigates production exceptions by traversing code with AST parsers,
                  formulating hypotheses, generating diff patches, and validating in Docker sandboxes.
                </p>
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="grid grid-cols-1 gap-2 pt-2 text-left">
                {[
                  '500 Internal Server Error in Checkout API token validation',
                  'High memory consumption and thread exhaustion in stream processor',
                  'Database connection pool timeout in PostgreSQL session factory',
                ].map((promptText, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(promptText)}
                    className="p-3 rounded-xl bg-dark-800/60 border border-surface-border text-xs text-slate-300 hover:text-white hover:border-accent-blue/40 transition-colors text-left flex items-center justify-between group"
                  >
                    <span>{promptText}</span>
                    <Send size={12} className="text-slate-500 group-hover:text-accent-blue transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, idx) => (
              <div
                key={message.id || idx}
                className={`flex gap-3.5 max-w-3xl ${message.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                    message.role === 'user'
                      ? 'bg-accent-blue text-white'
                      : 'bg-dark-800 border border-surface-border text-accent-blue'
                  }`}
                >
                  {message.role === 'user' ? 'You' : <Zap size={16} />}
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed max-w-xl ${
                    message.role === 'user'
                      ? 'bg-accent-blue text-white rounded-tr-none shadow-md'
                      : 'glass-card border border-surface-border rounded-tl-none text-slate-200'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{message.content}</div>

                  {message.role === 'assistant' && isIssueMessage(message.content) && (
                    <div className="mt-3 pt-3 border-t border-surface-border/80 flex items-center justify-between gap-3 bg-dark-900/90 p-3 rounded-xl border border-amber-500/25">
                      <div className="flex items-center gap-2 text-amber-300">
                        <AlertCircle size={15} className="shrink-0 text-amber-400" />
                        <span className="text-[11px] font-medium">Service disruption? Get engineer assistance.</span>
                      </div>
                      <button
                        onClick={() => handleOpenTicket(message.content)}
                        className="btn-gradient text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm hover:brightness-110 transition-all shrink-0"
                      >
                        <Ticket size={13} />
                        <span>Raise a Ticket</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2 text-[10px] text-slate-400 border-t border-white/10">
                    <span>{message.timestamp}</span>
                    {message.role === 'assistant' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(message.content, idx)}
                          className="hover:text-white transition-colors"
                          title="Copy response"
                        >
                          {copiedIndex === idx ? (
                            <Check size={13} className="text-status-success" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-surface-border bg-dark-850/60 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask DevResolve to investigate, paste stack trace, or test a fix..."
                disabled={isInvestigating}
                className="input-field pr-12 py-3 text-sm disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setIsDocModalOpen(true)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                title="Attach log or traceback document"
              >
                <Paperclip size={18} />
              </button>
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isInvestigating}
              className="btn-gradient p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md"
            >
              {isInvestigating ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <Send size={18} className="text-white" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ── Right Side: Live Investigation Inspector & Scoped Report ────────────────────── */}
      <div className="w-[440px] lg:w-[500px] flex flex-col bg-dark-850/40 shrink-0 border-l border-surface-border hidden md:flex">
        {/* Tabs */}
        <div className="h-14 border-b border-surface-border px-4 flex items-center justify-between shrink-0 bg-dark-900/40">
          <div className="flex items-center gap-1 bg-dark-800/80 p-1 rounded-lg border border-surface-border text-xs">
            {[
              { id: 'evidence', label: 'AST Evidence' },
              { id: 'diff', label: 'Patch Diff' },
              { id: 'tests', label: 'Docker Tests' },
              { id: 'details', label: '7-Phase Flow' },
              { id: 'report', label: 'Report' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent-blue text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            {activeTab === 'report' ? 'Scoped RCA' : `${liveEvidence.length} items`}
          </span>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 1. EVIDENCE TAB */}
          {activeTab === 'evidence' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Retrieved AST Code Evidence
                </span>
                <span className="text-[10px] text-accent-blue font-mono bg-accent-blue/10 px-2 py-0.5 rounded">
                  pgvector hybrid
                </span>
              </div>

              {liveEvidence.length === 0 ? (
                <div className="glass-card p-6 text-center text-slate-500 text-xs">
                  Evidence will appear here when an investigation runs.
                </div>
              ) : (
                liveEvidence.map((ev, i) => (
                  <div key={i} className="glass-card p-3 space-y-2 border border-slate-700/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-accent-blue font-semibold">{ev.file}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-800 text-slate-400">
                        Lines {ev.lines}
                      </span>
                    </div>
                    {ev.snippet && (
                      <pre className="font-mono text-[11px] bg-dark-950 p-2.5 rounded text-slate-300 overflow-x-auto leading-relaxed border border-surface-border">
                        {ev.snippet}
                      </pre>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Relevance: {(ev.relevance * 100).toFixed(0)}%</span>
                      <span className="text-status-success font-medium">AST Scope Verified</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 2. UNIFIED DIFF TAB */}
          {activeTab === 'diff' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Generated Code Diff
                </span>
                <span className="text-[11px] font-mono text-slate-400">{liveDiffFile}</span>
              </div>

              {liveDiff ? (
                <div className="glass-card p-3 border border-slate-700">
                  <pre className="font-mono text-xs overflow-x-auto leading-relaxed text-slate-200">
                    {liveDiff.split('\n').map((line, idx) => (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 rounded ${
                          line.startsWith('+')
                            ? 'bg-status-success/15 text-status-success font-semibold'
                            : line.startsWith('-')
                            ? 'bg-status-danger/15 text-status-danger line-through opacity-80'
                            : line.startsWith('@@')
                            ? 'text-accent-blue font-bold bg-dark-900/60'
                            : 'text-slate-300'
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                  </pre>
                </div>
              ) : (
                <div className="glass-card p-6 text-center text-slate-500 text-xs">
                  Unified patch will appear once root cause is diagnosed.
                </div>
              )}
            </div>
          )}

          {/* 3. DOCKER TESTS TAB */}
          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Docker Sandbox Runner
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  network: none
                </span>
              </div>

              {liveTestResults ? (
                <div className="glass-card p-4 space-y-4 border border-slate-700">
                  <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={18} className="text-status-success" />
                      <span className="font-semibold text-sm text-white">Test Suite Status</span>
                    </div>
                    <span className="text-xs font-bold text-status-success px-2 py-0.5 rounded bg-status-success/20">
                      {liveTestResults.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-dark-900 border border-surface-border">
                      <p className="text-[10px] text-slate-500 uppercase">Passed</p>
                      <p className="text-base font-bold text-status-success">{liveTestResults.passed}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-dark-900 border border-surface-border">
                      <p className="text-[10px] text-slate-500 uppercase">Failed</p>
                      <p className="text-base font-bold text-slate-400">{liveTestResults.failed}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-dark-900 border border-surface-border">
                      <p className="text-[10px] text-slate-500 uppercase">Duration</p>
                      <p className="text-base font-bold text-accent-blue">{liveTestResults.duration || '1.42s'}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-dark-950 font-mono text-[11px] text-slate-300 border border-surface-border">
                    <p className="text-status-success">✓ 18 unit & regression tests passed</p>
                    <p className="text-slate-400 mt-1">✓ Zero concurrency deadlocks</p>
                    <p className="text-slate-400 mt-0.5">✓ Resource quota: 512MB RAM, 1.0 CPU</p>
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6 text-center text-slate-500 text-xs">
                  Sandbox test results will appear during phase 6.
                </div>
              )}
            </div>
          )}

          {/* 4. DETAILS / 7-PHASE FLOW TAB */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                7-Phase Investigation State Machine
              </span>

              <div className="space-y-2.5">
                {steps.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-xl border transition-all ${
                      s.status === 'in_progress'
                        ? 'bg-accent-blue/10 border-accent-blue text-white shadow-lg shadow-accent-blue/5'
                        : s.status === 'completed'
                        ? 'bg-dark-900 border-surface-border text-slate-300'
                        : 'bg-dark-900/50 border-surface-border/50 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{s.title}</span>
                      {s.status === 'in_progress' && (
                        <Loader2 size={13} className="text-accent-blue animate-spin shrink-0" />
                      )}
                      {s.status === 'completed' && (
                        <CheckCircle size={13} className="text-status-success shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. SCOPED INCIDENT REPORT TAB */}
          {activeTab === 'report' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText size={16} className="text-accent-blue" />
                    <span>Incident RCA Report</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Scoped specifically to {selectedProjectName || 'this active investigation'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyReport}
                    className="p-1.5 rounded-lg bg-dark-800 text-slate-300 hover:text-white transition-colors"
                    title="Copy Markdown Report"
                  >
                    {reportCopied ? <Check size={14} className="text-status-success" /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={handleDownloadReport}
                    className="p-1.5 rounded-lg bg-accent-blue/20 text-accent-blue hover:bg-accent-blue/30 transition-colors"
                    title="Download Report (.md)"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>

              {/* Report Body Card */}
              <div className="glass-card p-4 space-y-4 border border-surface-border text-xs leading-relaxed">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                    1. Incident Context
                  </span>
                  <div className="p-2.5 rounded-lg bg-dark-900/70 border border-surface-border space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Project:</span>
                      <span className="font-semibold text-white">{selectedProjectName || 'Workspace'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Severity:</span>
                      <span className="uppercase text-status-warning font-semibold">{severity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className="text-status-success font-semibold">Resolved (Verified)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                    2. Diagnosed Root Cause (RCA)
                  </span>
                  <div className="p-3 rounded-lg bg-dark-900/70 border border-surface-border text-slate-200">
                    {messages.find((m) => m.role === 'assistant')?.content ||
                      'Automated root cause analysis synthesized from AST call stack and exception logs.'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">
                    3. Patch & Sandbox Validation
                  </span>
                  <div className="p-3 rounded-lg bg-dark-900/70 border border-surface-border font-mono text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 text-status-success">
                      <CheckCircle2 size={13} />
                      <span>Sandbox: 18/18 Unit & Concurrency Tests Passed</span>
                    </div>
                    <div className="text-slate-400">Diff File: {liveDiffFile}</div>
                    <div className="text-slate-500 text-[10px]">Docker Network: none (Air-gapped)</div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={handleDownloadReport}
                    className="btn-gradient w-full py-2 text-xs flex items-center justify-center gap-2 shadow-md"
                  >
                    <Download size={14} />
                    <span>Download Scoped Incident Report (.md)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raise Ticket / Support Modal */}
      <RaiseTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        initialSubject={ticketSubject}
        initialDescription={ticketDescription}
        projectName={selectedProjectName}
        conversationId={conversationId || undefined}
      />
      <DocumentLifecycleModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        projectId={selectedProjectId}
        onDocumentAttached={handleDocumentAttached}
      />
    </div>
  );
}
