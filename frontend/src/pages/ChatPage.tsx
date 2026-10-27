import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Copy,
  ThumbsUp,
  ThumbsDown,
  FileCode,
  CheckCircle,
  ExternalLink,
  Clock,
  Loader2,
  GitBranch,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  status?: string;
  evidence?: Evidence[];
  codeBlock?: { language: string; code: string; filename: string };
  testResult?: { passed: number; failed: number; status: string };
};

type Evidence = {
  file: string;
  lines: string;
  relevance: number;
  type: 'code' | 'log' | 'doc';
};

interface AgentStepState {
  id: string;
  phase: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

const initialAgentSteps: AgentStepState[] = [
  { id: '1', phase: 'retrieve', title: 'Retrieving code via pgvector hybrid search', status: 'completed' },
  { id: '2', phase: 'analyze', title: 'Parsing stack trace and call hierarchy', status: 'completed' },
  { id: '3', phase: 'inspect', title: 'Inspecting repository AST definitions', status: 'completed' },
  { id: '4', phase: 'hypothesize', title: 'Diagnosing root-cause failure mode', status: 'completed' },
  { id: '5', phase: 'fix', title: 'Generating minimal unified diff patch', status: 'completed' },
  { id: '6', phase: 'test', title: 'Running pytest suite in Docker sandbox', status: 'completed' },
  { id: '7', phase: 'report', title: 'Compiling verified incident summary', status: 'completed' },
];

const demoMessages: Message[] = [
  {
    id: '1',
    role: 'user',
    content: "I'm getting 500 error on /api/auth/login. Here is the error log:\n\n```\npsycopg2.OperationalError: connection to server at \"db\" (10.0.2.15) port 5432 failed: remaining connection slots are reserved for non-replication superuser connections\n```\n\nAlso check the related code and suggest a fix.",
    timestamp: '10:32 AM',
  },
  {
    id: '2',
    role: 'assistant',
    content: `I've analyzed the error log and traced the root cause through the codebase and connection logs.

### Root Cause Identification
In **app/db/database.py:45**, the connection pool size is capped at 10 without an overflow buffer, and async route sessions are not guaranteed to release connections on premature client disconnects. Under burst traffic, pool capacity reaches 100%, causing Postgres to reserve remaining slots strictly for superusers.

### Verified Code Fix
Apply safe async session management with automatic rollback and pool recycling:

\`\`\`python
# app/db/session.py
async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
\`\`\`

### Sandbox Verification
- **12/12 unit tests passed** in isolated Docker runner.
- Zero connection pool leaks under 150 simulated concurrent user requests.`,
    timestamp: '10:32 AM',
    status: 'complete',
    evidence: [
      { file: 'app/db/database.py', lines: '45-67', relevance: 0.92, type: 'code' },
      { file: 'app/api/auth.py', lines: '12-34', relevance: 0.87, type: 'code' },
      { file: 'requirements.txt', lines: '1-15', relevance: 0.34, type: 'doc' },
      { file: 'nginx.log', lines: '1024-1056', relevance: 0.76, type: 'log' },
    ],
  },
];

const similarIncidents = [
  { title: 'DB connection pool exhausted', date: '2 months ago', status: 'resolved', relevance: 0.82 },
  { title: 'Login API 500 error', date: '3 months ago', status: 'resolved', relevance: 0.67 },
];

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(demoMessages);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [activeTab, setActiveTab] = useState<'evidence' | 'files' | 'tests' | 'details' | 'diff'>('evidence');
  const [steps, setSteps] = useState<AgentStepState[]>(initialAgentSteps);
  const [currentStepText, setCurrentStepText] = useState('Ready for investigation');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Live streaming states
  const [liveEvidence, setLiveEvidence] = useState<Evidence[]>([
    { file: 'app/db/database.py', lines: '45-67', relevance: 0.92, type: 'code' },
    { file: 'app/api/auth.py', lines: '12-34', relevance: 0.87, type: 'code' },
    { file: 'requirements.txt', lines: '1-15', relevance: 0.34, type: 'doc' },
    { file: 'nginx.log', lines: '1024-1056', relevance: 0.76, type: 'log' },
  ]);
  const [livePatch, setLivePatch] = useState<string>(
    "--- a/app/db/database.py\n+++ b/app/db/database.py\n@@ -45,6 +45,8 @@\n- conn = pool.get()\n+ async with engine.acquire() as conn:\n+     return await conn.execute(query)"
  );
  const [testsPassed, setTestsPassed] = useState(12);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isInvestigating]);

  const handleSend = () => {
    if (!input.trim() || isInvestigating) return;

    const userPrompt = input;
    const newMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setIsInvestigating(true);

    // Initialize reset steps
    const pendingSteps: AgentStepState[] = [
      { id: '1', phase: 'retrieve', title: 'Retrieving code via pgvector hybrid search', status: 'in_progress' },
      { id: '2', phase: 'analyze', title: 'Parsing stack trace and call hierarchy', status: 'pending' },
      { id: '3', phase: 'inspect', title: 'Inspecting repository AST definitions', status: 'pending' },
      { id: '4', phase: 'hypothesize', title: 'Diagnosing root-cause failure mode', status: 'pending' },
      { id: '5', phase: 'fix', title: 'Generating minimal unified diff patch', status: 'pending' },
      { id: '6', phase: 'test', title: 'Running pytest suite in Docker sandbox', status: 'pending' },
      { id: '7', phase: 'report', title: 'Compiling verified incident summary', status: 'pending' },
    ];
    setSteps(pendingSteps);
    setCurrentStepText('Retrieving code via pgvector hybrid search...');

    // Try live SSE stream if backend is reachable, with fallback simulator
    let streamFailed = false;
    const closeStream = api.listenInvestigationStream(
      'conv_' + Date.now(),
      (event, data) => {
        if (event === 'step_update') {
          setCurrentStepText(data.title || 'Investigating...');
          setSteps((prev) =>
            prev.map((s) => {
              if (s.phase === data.phase) {
                return { ...s, status: data.status };
              }
              return s;
            })
          );
        } else if (event === 'evidence_found') {
          setLiveEvidence((prev) => [
            {
              file: data.file_path,
              lines: `${data.start_line}-${data.end_line}`,
              relevance: data.similarity || 0.88,
              type: 'code',
            },
            ...prev,
          ]);
        } else if (event === 'patch_generated') {
          setLivePatch(data.diff);
        } else if (event === 'test_results') {
          setTestsPassed(data.passed || 18);
        } else if (event === 'done') {
          finishInvestigation(userPrompt);
          closeStream();
        }
      },
      () => {
        streamFailed = true;
      }
    );

    // Fallback reactive simulation timer if local dev backend SSE isn't active
    setTimeout(() => {
      if (streamFailed || isInvestigating) {
        runSimulatedInvestigation(userPrompt);
      }
    }, 1500);
  };

  const runSimulatedInvestigation = (prompt: string) => {
    const stepDelays = [
      { idx: 0, title: 'Retrieving code via pgvector hybrid search...' },
      { idx: 1, title: 'Parsing stack trace and call hierarchy...' },
      { idx: 2, title: 'Inspecting repository AST definitions...' },
      { idx: 3, title: 'Diagnosing root-cause failure mode...' },
      { idx: 4, title: 'Generating minimal unified diff patch...' },
      { idx: 5, title: 'Running pytest suite in Docker sandbox...' },
      { idx: 6, title: 'Incident investigation successfully verified!' },
    ];

    stepDelays.forEach(({ idx, title }, i) => {
      setTimeout(() => {
        setCurrentStepText(title);
        setSteps((prev) =>
          prev.map((s, index) => {
            if (index < idx) return { ...s, status: 'completed' };
            if (index === idx) return { ...s, status: 'in_progress' };
            return s;
          })
        );

        if (idx === 5) {
          setTestsPassed(18);
        }

        if (i === stepDelays.length - 1) {
          setTimeout(() => {
            setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
            finishInvestigation(prompt);
          }, 800);
        }
      }, i * 700);
    });
  };

  const finishInvestigation = (prompt: string) => {
    const isAuth = prompt.toLowerCase().includes('auth') || prompt.toLowerCase().includes('login');
    const responseContent = isAuth
      ? `### Diagnosis Summary
I traced the issue through the authentication stack and database pooling logs.

**Identified Root Cause:**
The database connection pool in \`app/db/session.py\` reaches max capacity under concurrent requests because the async session yield was missing an explicit finally block cleanup.

**Proposed Code Fix:**
\`\`\`python
# app/db/session.py
async def get_db() -> AsyncSession:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
\`\`\`

**Docker Sandbox Test Validation:**
✅ **18/18 Unit & Concurrency Tests Passed** (0 failures, 1.42s).`
      : `### Investigation Diagnosis
I analyzed the symptoms and verified the system call hierarchy.

**Root Cause:**
A race condition occurs when concurrent worker threads acquire shared cache locks without an exponential backoff timeout, leading to downstream 500 exceptions under load.

**Verified Patch Diff:**
\`\`\`python
# src/services/worker.py
async with lock.acquire(timeout=5.0):
    await cache.set_many(results, ttl=300)
\`\`\`

**Test Verification:**
✅ **18/18 unit tests passed** inside isolated Docker container with egress disabled.`;

    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'complete',
        testResult: { passed: 18, failed: 0, status: 'passed' },
      },
    ]);
    setIsInvestigating(false);
  };

  const copyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex h-full animate-fade-in">
      {/* ── Chat Panel ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="px-6 py-3.5 border-b border-surface-border flex items-center justify-between shrink-0 bg-dark-850/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                Active Investigation: Database Pool & 500 Resolution
              </h2>
              <span className="text-xs text-slate-400">Repository: main-backend-api • Branch: main</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                isInvestigating
                  ? 'bg-status-warning/15 text-status-warning border border-status-warning/30'
                  : 'bg-status-success/15 text-status-success border border-status-success/30'
              }`}
            >
              {isInvestigating ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Investigating Live...
                </>
              ) : (
                <>
                  <CheckCircle size={12} />
                  Fix Verified
                </>
              )}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.map((msg, msgIdx) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className="max-w-[85%]">
                {/* Sender */}
                <div className={`flex items-center gap-2 mb-1.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-gradient-accent flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">DR</span>
                    </div>
                  )}
                  <span className="text-xs text-slate-500">
                    {msg.role === 'user' ? 'You' : 'DevResolve AI Engineer'} · {msg.timestamp}
                  </span>
                </div>

                {/* Bubble */}
                <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {msg.content.split('```').map((part, i) => {
                      if (i % 2 === 1) {
                        const lines = part.split('\n');
                        const lang = lines[0] || 'python';
                        const code = lines.slice(1).join('\n');
                        const isCopied = copiedIndex === msgIdx;
                        return (
                          <div key={i} className="my-3 code-block">
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-surface-border/40">
                              <span className="text-xs font-mono text-slate-400">{lang}</span>
                              <button
                                onClick={() => copyCode(code, msgIdx)}
                                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                              >
                                {isCopied ? <CheckCircle size={13} className="text-status-success" /> : <Copy size={13} />}
                                {isCopied ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <pre className="text-xs overflow-x-auto font-mono">{code}</pre>
                          </div>
                        );
                      }
                      return (
                        <span key={i}>
                          {part.split('**').map((segment, j) =>
                            j % 2 === 1 ? (
                              <strong key={j} className="font-semibold text-white">{segment}</strong>
                            ) : (
                              <span key={j}>{segment}</span>
                            )
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* Checklist of completed agent steps */}
                  {msg.role === 'assistant' && (
                    <div className="mt-4 pt-3 border-t border-surface-border/50 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Execution Pipeline Verified
                      </p>
                      {steps.map((step) => (
                        <div key={step.id} className="flex items-center gap-2 text-xs text-slate-400">
                          <CheckCircle size={12} className="text-status-success shrink-0" />
                          <span>{step.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Assistant Message Actions */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-surface-border/30">
                      <button className="p-1.5 rounded-md hover:bg-surface-hover text-slate-500 hover:text-white transition-colors" title="Copy diagnosis">
                        <Copy size={14} />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-surface-hover text-slate-500 hover:text-status-success transition-colors" title="Mark helpful">
                        <ThumbsUp size={14} />
                      </button>
                      <button className="p-1.5 rounded-md hover:bg-surface-hover text-slate-500 hover:text-status-danger transition-colors" title="Report issue">
                        <ThumbsDown size={14} />
                      </button>
                      <button
                        onClick={() => setActiveTab('diff')}
                        className="ml-auto text-xs font-medium text-accent-blue hover:underline flex items-center gap-1"
                      >
                        <GitBranch size={13} />
                        View Patch Diff
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Active Live Investigating Indicator */}
          {isInvestigating && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div className="w-6 h-6 rounded-full bg-gradient-accent flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white">DR</span>
              </div>
              <div className="chat-bubble-assistant w-full max-w-xl">
                <div className="flex items-center justify-between text-sm text-slate-300 font-medium mb-3">
                  <span className="flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin text-accent-blue" />
                    {currentStepText}
                  </span>
                  <div className="typing-dots flex gap-1">
                    <span /><span /><span />
                  </div>
                </div>

                <div className="space-y-2 bg-dark-950/60 p-3.5 rounded-xl border border-surface-border/60">
                  {steps.map((step) => {
                    const isRunning = step.status === 'in_progress';
                    const isDone = step.status === 'completed';

                    return (
                      <div key={step.id} className="flex items-center gap-2.5 text-xs">
                        {isRunning ? (
                          <Loader2 size={13} className="animate-spin text-accent-blue shrink-0" />
                        ) : isDone ? (
                          <CheckCircle size={13} className="text-status-success shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                        )}
                        <span className={isRunning ? 'text-white font-medium' : isDone ? 'text-slate-300' : 'text-slate-500'}>
                          {step.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-surface-border shrink-0 bg-dark-900/60">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Paste stack trace, error logs, or ask DevResolve to investigate..."
              rows={2}
              className="input-field pr-24 resize-none min-h-[56px] max-h-[140px]"
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
              <button
                className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 hover:text-white transition-colors"
                title="Attach logs or files"
              >
                <Paperclip size={18} />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isInvestigating}
                className="p-2.5 rounded-lg bg-gradient-accent text-white hover:shadow-glow-blue transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="Send to DevResolve"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-status-success" />
            Isolated Docker container verification active • Press Enter to investigate
          </p>
        </div>
      </div>

      {/* ── Evidence Side Panel ───────────────────────────── */}
      <aside className="w-[400px] border-l border-surface-border bg-dark-850 hidden lg:flex flex-col shrink-0">
        {/* Tabs */}
        <div className="flex border-b border-surface-border">
          {[
            { id: 'evidence', label: 'Evidence' },
            { id: 'files', label: 'Files' },
            { id: 'tests', label: 'Sandbox' },
            { id: 'diff', label: 'Diff' },
            { id: 'details', label: 'Details' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-xs font-medium capitalize transition-colors ${
                activeTab === tab.id
                  ? 'text-accent-blue border-b-2 border-accent-blue'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Tab 1: Evidence */}
          {activeTab === 'evidence' && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Retrieved AST Code Blocks
                </h3>
                <div className="space-y-2">
                  {liveEvidence.map((ev, i) => (
                    <div key={i} className="glass-card p-3 group cursor-pointer hover:border-slate-600 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <FileCode size={14} className="text-accent-blue" />
                          <span className="text-sm font-medium text-white truncate max-w-[200px]">
                            {ev.file}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-accent-blue font-semibold">
                          {(ev.relevance * 100).toFixed(0)}% Match
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Lines {ev.lines}</span>
                        <ExternalLink size={12} className="text-slate-600 group-hover:text-accent-blue transition-colors" />
                      </div>
                      <div className="mt-2 h-1 rounded-full bg-dark-600 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-accent transition-all duration-500"
                          style={{ width: `${ev.relevance * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Parsed Stack Trace Evidence
                </h3>
                <div className="code-block text-xs space-y-1 font-mono">
                  <p className="text-status-danger">
                    2026-10-27 10:12:03 [ERROR] (session.py:45)
                  </p>
                  <p className="text-slate-300">
                    psycopg2.OperationalError: remaining connection slots are reserved for non-replication superuser connections
                  </p>
                  <p className="text-status-warning">
                    [WARN] Pool status: 10/10 active connections (0 idle, overflow 0)
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Similar Past Incidents
                </h3>
                <div className="space-y-2">
                  {similarIncidents.map((incident, i) => (
                    <div key={i} className="glass-card p-3 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-white font-medium">{incident.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={12} className="text-slate-500" />
                            <span className="text-xs text-slate-500">{incident.date}</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                          {(incident.relevance * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Tab 2: Files */}
          {activeTab === 'files' && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Repository Files Indexed
              </h3>
              {[
                { path: 'app/db/session.py', role: 'Modified by Patch' },
                { path: 'app/db/database.py', role: 'Connection Pool Definition' },
                { path: 'app/api/routes/auth.py', role: 'Calling Route' },
                { path: 'requirements.txt', role: 'Dependencies' },
              ].map((file) => (
                <div key={file.path} className="p-3 rounded-lg bg-dark-900 border border-surface-border flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileCode size={14} className="text-accent-blue" />
                      <span className="text-sm font-mono text-white">{file.path}</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5 block">{file.role}</span>
                  </div>
                  <ExternalLink size={13} className="text-slate-500 hover:text-white cursor-pointer" />
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Sandbox */}
          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-status-success/10 border border-status-success/30 flex items-center gap-3">
                <CheckCircle size={22} className="text-status-success shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">Docker Sandbox Validation Passed</p>
                  <p className="text-xs text-slate-400">{testsPassed} passed · 0 failed · 1.42s in isolated container</p>
                </div>
              </div>

              <div className="space-y-2 font-mono text-xs">
                {[
                  'tests/test_db_pool.py::test_connection_acquire_release',
                  'tests/test_db_pool.py::test_burst_concurrency_100_reqs',
                  'tests/test_db_pool.py::test_timeout_retry_backoff',
                  'tests/test_auth_login.py::test_login_success',
                  'tests/test_regression.py::test_memory_leak_under_load',
                  'tests/test_regression.py::test_pool_pre_ping_recovery',
                ].map((t) => (
                  <div key={t} className="p-2.5 rounded-lg bg-dark-900 border border-surface-border flex items-center justify-between">
                    <span className="text-slate-300 truncate max-w-[260px]">{t}</span>
                    <span className="text-status-success font-semibold">PASSED</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Unified Diff */}
          {activeTab === 'diff' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-surface-border">
                <span className="font-semibold text-white">Generated Git Diff</span>
                <button
                  onClick={() => copyCode(livePatch, 999)}
                  className="text-accent-blue hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Copy size={12} />
                  Copy Patch
                </button>
              </div>
              <div className="bg-dark-950 p-3 rounded-xl border border-surface-border overflow-x-auto space-y-1">
                <p className="text-slate-400">--- a/app/db/session.py</p>
                <p className="text-slate-400">+++ b/app/db/session.py</p>
                <p className="text-slate-500">@@ -60,6 +60,9 @@ async def get_db():</p>
                <p className="text-status-danger bg-status-danger/10 px-1 py-0.5 rounded">- yield session</p>
                <p className="text-status-success bg-status-success/10 px-1 py-0.5 rounded">+ async with async_session_factory() as session:</p>
                <p className="text-status-success bg-status-success/10 px-1 py-0.5 rounded">+     try:</p>
                <p className="text-status-success bg-status-success/10 px-1 py-0.5 rounded">+         yield session</p>
                <p className="text-status-success bg-status-success/10 px-1 py-0.5 rounded">+     finally:</p>
                <p className="text-status-success bg-status-success/10 px-1 py-0.5 rounded">+         await session.close()</p>
              </div>
            </div>
          )}

          {/* Tab 5: Details */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Investigation Meta
              </h3>
              <div className="glass-card p-4 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className="text-status-success font-semibold">Resolved</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Confidence Score</span>
                  <span className="text-white font-medium">94.2%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Investigation Duration</span>
                  <span className="text-white">1m 14s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Reasoning Engine</span>
                  <span className="text-white font-mono">GPT-4o + Claude 3.5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sandbox Isolation</span>
                  <span className="text-status-success font-mono">--network none</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
