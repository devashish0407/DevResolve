import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Copy,
  ThumbsUp,
  ThumbsDown,
  FileCode,
  FileText,
  TestTube,
  AlertTriangle,
  CheckCircle,
  Search,
  ExternalLink,
  Clock,
  Loader2,
} from 'lucide-react';

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

// Demo messages matching the mockup
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

const agentSteps = [
  { icon: Search, label: 'Understanding the error', done: true },
  { icon: Search, label: 'Searching relevant logs', done: true },
  { icon: FileCode, label: 'Analyzing codebase', done: true },
  { icon: AlertTriangle, label: 'Found similar past incident', done: true },
  { icon: Search, label: 'Identifying root cause', done: true },
  { icon: FileCode, label: 'Suggesting fix', done: true },
  { icon: TestTube, label: 'Running tests in sandbox', done: true },
];

const similarIncidents = [
  { title: 'DB connection pool exhausted', date: '2 months ago', status: 'resolved', relevance: 0.82 },
  { title: 'Login API 500 error', date: '3 months ago', status: 'resolved', relevance: 0.67 },
];

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(demoMessages);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [activeTab, setActiveTab] = useState<'evidence' | 'files' | 'tests' | 'details'>('evidence');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...messages, newMsg]);
    setInput('');
    setIsInvestigating(true);

    // Simulate agent response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'I\'ve analyzed the error and found the root cause. The database connection pool in `database.py` is not properly releasing connections after use, which leads to pool exhaustion under load.\n\n**Root Cause:** The `get_db()` function creates sessions but the `finally` block doesn\'t call `session.close()`, causing connection leaks.\n\n**Proposed Fix:**\n```python\nasync def get_db():\n    session = async_session_factory()\n    try:\n        yield session\n        await session.commit()\n    except Exception:\n        await session.rollback()\n        raise\n    finally:\n        await session.close()  # This was missing!\n```\n\n✅ Tests passed after applying this fix.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'complete',
          testResult: { passed: 12, failed: 0, status: 'passed' },
        },
      ]);
      setIsInvestigating(false);
    }, 3000);
  };

  return (
    <div className="flex h-full">
      {/* ── Chat Panel ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="px-6 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">500 error on login API</h2>
            <span className="badge-warning">
              <Loader2 size={10} className={isInvestigating ? 'animate-spin' : 'hidden'} />
              {isInvestigating ? 'Investigating' : 'Resolved'}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
                {/* Sender */}
                <div className={`flex items-center gap-2 mb-1.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-gradient-accent flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">DR</span>
                    </div>
                  )}
                  <span className="text-xs text-slate-500">
                    {msg.role === 'user' ? 'You' : 'DevResolve'} · {msg.timestamp}
                  </span>
                </div>

                {/* Bubble */}
                <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
                  {/* Render content with basic markdown-like formatting */}
                  <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {msg.content.split('```').map((part, i) => {
                      if (i % 2 === 1) {
                        // Code block
                        const lines = part.split('\n');
                        const lang = lines[0] || '';
                        const code = lines.slice(1).join('\n');
                        return (
                          <div key={i} className="my-3 code-block">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-slate-500">{lang}</span>
                              <button className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
                                <Copy size={12} /> Copy
                              </button>
                            </div>
                            <pre className="text-xs">{code}</pre>
                          </div>
                        );
                      }
                      // Regular text with bold support
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

                  {/* Test Result Badge */}
                  {msg.testResult && (
                    <div className={`mt-3 flex items-center gap-2 text-xs font-medium ${
                      msg.testResult.status === 'passed' ? 'text-status-success' : 'text-status-danger'
                    }`}>
                      <CheckCircle size={14} />
                      {msg.testResult.passed} tests passed · {msg.testResult.failed} failed
                    </div>
                  )}
                </div>

                {/* Agent Steps (for assistant messages) */}
                {msg.role === 'assistant' && msg.id === '2' && (
                  <div className="mt-3 space-y-1.5">
                    {agentSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                        <step.icon size={12} className="text-status-success" />
                        <span>{step.label}</span>
                        <CheckCircle size={10} className="text-status-success ml-auto" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions (for assistant messages) */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button className="p-1.5 rounded-md hover:bg-surface-hover text-slate-500 hover:text-white transition-colors">
                      <Copy size={14} />
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-surface-hover text-slate-500 hover:text-status-success transition-colors">
                      <ThumbsUp size={14} />
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-surface-hover text-slate-500 hover:text-status-danger transition-colors">
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Investigating indicator */}
          {isInvestigating && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div className="w-6 h-6 rounded-full bg-gradient-accent flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white">DR</span>
              </div>
              <div className="chat-bubble-assistant">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span>DevResolve is investigating</span>
                  <div className="typing-dots flex gap-1">
                    <span /><span /><span />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {agentSteps.slice(0, 3).map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-500 animate-fade-in" style={{ animationDelay: `${i * 0.5}s` }}>
                      <Loader2 size={12} className="animate-spin text-accent-blue" />
                      <span>{step.label}...</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-surface-border shrink-0">
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
              placeholder="Ask anything about the incident..."
              rows={1}
              className="input-field pr-24 resize-none min-h-[48px] max-h-[120px]"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button className="p-2 rounded-lg hover:bg-surface-hover text-slate-500 hover:text-white transition-colors">
                <Paperclip size={18} />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 rounded-lg bg-gradient-accent text-white hover:shadow-glow-blue transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Evidence Side Panel ───────────────────────────── */}
      <aside className="w-[380px] border-l border-surface-border bg-dark-850 hidden lg:flex flex-col shrink-0">
        {/* Tabs */}
        <div className="flex border-b border-surface-border">
          {['evidence', 'files', 'tests', 'details'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
              className={`flex-1 py-3 text-xs font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-accent-blue border-b-2 border-accent-blue'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'evidence' && (
            <>
              {/* Relevant Files */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Relevant Files
                </h3>
                <div className="space-y-2">
                  {demoMessages[1]?.evidence?.map((ev, i) => (
                    <div key={i} className="glass-card p-3 group cursor-pointer">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {ev.type === 'code' ? (
                            <FileCode size={14} className="text-accent-blue" />
                          ) : ev.type === 'log' ? (
                            <FileText size={14} className="text-status-warning" />
                          ) : (
                            <FileText size={14} className="text-slate-400" />
                          )}
                          <span className="text-sm font-medium text-white truncate">
                            {ev.file}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-slate-500">
                          {(ev.relevance * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Lines {ev.lines}</span>
                        <ExternalLink size={12} className="text-slate-600 group-hover:text-accent-blue transition-colors" />
                      </div>
                      {/* Relevance bar */}
                      <div className="mt-2 h-1 rounded-full bg-dark-600 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-accent transition-all"
                          style={{ width: `${ev.relevance * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Relevant Logs */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Relevant Logs
                </h3>
                <div className="code-block text-xs space-y-1">
                  <p className="text-status-danger">
                    2026-10-27 10:12:03 [ERROR] (app.py:45) Database connection failed
                  </p>
                  <p className="text-slate-400">
                    psycopg2.OperationalError: connection to server at "db"
                  </p>
                  <p className="text-status-warning">
                    2026-10-27 10:12:01 [WARN] Connection pool at 95% capacity
                  </p>
                </div>
              </div>

              {/* Similar Incidents */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Similar Incidents
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
                        <span className="text-xs font-mono text-slate-500">
                          {(incident.relevance * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'files' && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Files Involved
              </h3>
              {['app/db/database.py', 'app/api/auth.py', 'app/core/config.py', 'requirements.txt'].map((file) => (
                <div key={file} className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors">
                  <FileCode size={14} className="text-accent-blue" />
                  <span className="text-sm text-slate-300">{file}</span>
                  <ExternalLink size={12} className="text-slate-600 ml-auto" />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-status-success/10 border border-status-success/20">
                <CheckCircle size={20} className="text-status-success" />
                <div>
                  <p className="text-sm font-medium text-white">All Tests Passed</p>
                  <p className="text-xs text-slate-400">12 passed · 0 failed · 2.3s</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  'test_db_connection',
                  'test_session_cleanup',
                  'test_pool_exhaustion',
                  'test_auth_login',
                  'test_auth_logout',
                ].map((test) => (
                  <div key={test} className="flex items-center gap-2 p-2 rounded-lg">
                    <CheckCircle size={14} className="text-status-success" />
                    <span className="text-sm text-slate-300 font-mono">{test}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Investigation Summary
                </h3>
                <div className="glass-card p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Status</span>
                    <span className="badge-success">Resolved</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Confidence</span>
                    <span className="text-white font-medium">High (92%)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Duration</span>
                    <span className="text-white">1m 23s</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Model</span>
                    <span className="text-white">GPT-4o</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tokens used</span>
                    <span className="text-white">4,821</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
