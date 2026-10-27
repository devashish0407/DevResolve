import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Code2,
  GitBranch,
  Search,
  Bug,
  PlayCircle,
  CheckCircle,
  Terminal,
  FileCode,
  TestTube,
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dark-950 overflow-x-hidden">
      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-surface-border bg-dark-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg text-white">DevResolve</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-slate-400 hover:text-white transition-colors">How it Works</a>
            <a href="#integrations" className="text-sm text-slate-400 hover:text-white transition-colors">Integrations</a>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/login')} className="btn-ghost">
              Sign in
            </button>
            <button onClick={() => navigate('/signup')} className="btn-gradient">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background gradient orbs */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-accent-blue/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full bg-accent-purple/5 blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-sm text-accent-blue mb-8">
            <Sparkles size={14} />
            <span>AI-powered</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">Built for developers</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            <span className="text-white">Resolve production</span>
            <br />
            <span className="text-white">issues faster with </span>
            <span className="text-gradient">AI.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            DevResolve investigates errors, searches your code, logs and docs,
            finds the root cause and suggests verified fixes using your actual codebase.
          </p>

          <div className="flex items-center justify-center gap-4 mb-16">
            <button onClick={() => navigate('/signup')} className="btn-gradient text-base px-8 py-3 flex items-center gap-2">
              Get Started Free
              <ArrowRight size={18} />
            </button>
            <button className="btn-ghost text-base px-6 py-3 flex items-center gap-2">
              <PlayCircle size={18} />
              Watch Demo
            </button>
          </div>

          {/* Hero Terminal Preview */}
          <div className="glass-card p-1 max-w-4xl mx-auto animate-fade-in">
            <div className="bg-dark-950 rounded-lg overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-dark-900 border-b border-surface-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-status-danger/60" />
                  <div className="w-3 h-3 rounded-full bg-status-warning/60" />
                  <div className="w-3 h-3 rounded-full bg-status-success/60" />
                </div>
                <span className="text-xs text-slate-500 ml-2">DevResolve Investigation</span>
              </div>
              {/* Terminal content */}
              <div className="p-5 space-y-3 font-mono text-sm text-left">
                <div className="flex items-start gap-2">
                  <span className="text-status-danger font-semibold">ERROR</span>
                  <span className="text-slate-300">500 Internal Server Error at /api/auth/login</span>
                </div>
                <div className="text-slate-500 text-xs pl-14">
                  psycopg2.OperationalError: connection to server at "db" (10.0.2.15) port 5432 failed: remaining connection slots are reserved
                </div>
                <div className="h-px bg-surface-border my-3" />
                <div className="space-y-2.5">
                  {[
                    { icon: '🔍', text: 'Analyzing logs...', done: true },
                    { icon: '📂', text: 'Searching relevant codebase...', done: true },
                    { icon: '🔎', text: 'Identifying root cause...', done: true },
                    { icon: '💡', text: 'Found: DB connection pool exhausted in database.py', done: true },
                    { icon: '🔧', text: 'Suggesting fix...', done: true },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-300 animate-fade-in" style={{ animationDelay: `${i * 0.15}s` }}>
                      <span>{step.icon}</span>
                      <span>{step.text}</span>
                      {step.done && <CheckCircle size={14} className="text-status-success ml-auto" />}
                    </div>
                  ))}
                </div>
                <div className="h-px bg-surface-border my-3" />
                <div className="bg-dark-900/50 rounded-lg p-3 border border-status-success/20">
                  <p className="text-status-success text-xs font-semibold mb-2">Suggested Fix</p>
                  <div className="text-xs space-y-1">
                    <p className="text-slate-400">
                      <span className="text-accent-purple">session</span> = <span className="text-accent-blue">Session</span>(pool)
                    </p>
                    <p className="text-slate-400">
                      <span className="text-accent-purple">try</span>:
                    </p>
                    <p className="text-status-success pl-4">+ session.close()  <span className="text-slate-500"># Properly release connection</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-status-success text-xs font-semibold pt-1">
                  <CheckCircle size={14} />
                  Tests Passed ✓
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integration Logos ─────────────────────────────── */}
      <section className="py-12 border-y border-surface-border bg-dark-900/30">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-sm text-slate-500 mb-8">Works with your existing tools</p>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {[
              { name: 'GitHub', icon: GitBranch },
              { name: 'Sentry', icon: Bug },
              { name: 'Datadog', icon: Terminal },
              { name: 'Notion', icon: FileCode },
              { name: 'Confluence', icon: FileCode },
            ].map((tool) => (
              <div key={tool.name} className="flex items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors">
                <tool.icon size={20} />
                <span className="text-sm font-medium">{tool.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything you need to resolve incidents
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              From error detection to verified fix — all powered by AI that understands your codebase.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Search,
                title: 'Smart Code Search',
                description: 'RAG-powered search finds relevant code, logs and past incidents using semantic understanding.',
                color: 'from-accent-blue to-accent-cyan',
              },
              {
                icon: Zap,
                title: 'AI Investigation',
                description: 'LangGraph agent autonomously analyzes evidence, forms hypotheses and suggests next steps.',
                color: 'from-accent-purple to-pink-500',
              },
              {
                icon: TestTube,
                title: 'Verified Fixes',
                description: 'Proposed patches run in Docker sandboxes with your test suite to validate correctness.',
                color: 'from-status-success to-emerald-400',
              },
              {
                icon: Code2,
                title: 'Code-Aware Chunking',
                description: 'AST-based parsing understands functions, classes and modules — not just raw text.',
                color: 'from-orange-500 to-amber-400',
              },
              {
                icon: Shield,
                title: 'Secure by Default',
                description: 'Encrypted credentials, sandboxed execution, RLS policies and audit logs throughout.',
                color: 'from-accent-blue to-accent-indigo',
              },
              {
                icon: GitBranch,
                title: 'GitHub Integration',
                description: 'Connect repositories, sync code, and get context from issues, PRs and commit history.',
                color: 'from-slate-400 to-slate-300',
              },
            ].map((feature) => (
              <div key={feature.title} className="glass-card p-6 group">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ─────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-dark-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How DevResolve works
            </h2>
            <p className="text-slate-400 text-lg">Six steps from error to verified resolution.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { step: 1, title: 'Report an Issue', desc: 'Paste an error, logs, or describe the problem in natural language.' },
              { step: 2, title: 'Retrieve Context', desc: 'RAG pipeline searches code, logs, docs and past incidents using hybrid search.' },
              { step: 3, title: 'Analyze & Diagnose', desc: 'LLM + Agent analyzes evidence, identifies root cause, cites sources.' },
              { step: 4, title: 'Suggest Fix & Tests', desc: 'Generates code patches and identifies relevant regression tests.' },
              { step: 5, title: 'Execute & Validate', desc: 'Runs tests in Docker sandbox to verify the fix resolves the issue.' },
              { step: 6, title: 'Final Report', desc: 'Returns structured report with root cause, evidence, diff and test results.' },
            ].map((item) => (
              <div key={item.step} className="glass-card p-6 relative overflow-hidden group">
                <div className="absolute -top-2 -right-2 text-6xl font-black text-dark-600/50 group-hover:text-accent-blue/10 transition-colors">
                  {item.step}
                </div>
                <div className="relative z-10">
                  <div className="w-8 h-8 rounded-full bg-gradient-accent flex items-center justify-center text-sm font-bold text-white mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to resolve faster?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Start investigating production issues with AI that actually understands your code.
          </p>
          <button onClick={() => navigate('/signup')} className="btn-gradient text-base px-10 py-3.5 inline-flex items-center gap-2">
            Get Started Free
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-surface-border py-12 px-6 bg-dark-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-accent flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="font-semibold text-white">DevResolve</span>
          </div>
          <p className="text-sm text-slate-500">© 2026 DevResolve. Built for developers who ship.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">Terms</a>
            <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">Privacy</a>
            <a href="#" className="text-sm text-slate-500 hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
