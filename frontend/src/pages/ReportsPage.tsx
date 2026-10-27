import { useState } from 'react';
import {
  FileBarChart,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitCommit,
  TestTube,
  FileCode,
  Search,
  ChevronRight,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';

interface Report {
  id: string;
  title: string;
  project: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolvedAt: string;
  mttr: string;
  testsPassed: number;
  totalTests: number;
  filesModified: number;
  rootCause: string;
  fixStatus: 'verified' | 'pending_approval' | 'needs_review';
}

const mockReports: Report[] = [
  {
    id: 'RPT-1042',
    title: 'PostgreSQL Connection Exhaustion in Checkout Service',
    project: 'E-Commerce Backend API',
    severity: 'critical',
    resolvedAt: 'Today, 11:20 AM',
    mttr: '14 mins',
    testsPassed: 18,
    totalTests: 18,
    filesModified: 2,
    rootCause: 'Missing connection pool release in async background order dispatch task under burst loads.',
    fixStatus: 'verified',
  },
  {
    id: 'RPT-1039',
    title: 'JWT Token Expiration Race Condition on Mobile Refresh',
    project: 'Auth Microservice',
    severity: 'high',
    resolvedAt: 'Yesterday, 4:45 PM',
    mttr: '22 mins',
    testsPassed: 12,
    totalTests: 12,
    filesModified: 3,
    rootCause: 'Clock skew between auth servers and mobile client caused 500ms validation window mismatch.',
    fixStatus: 'verified',
  },
  {
    id: 'RPT-1031',
    title: 'Null Pointer Dereference during Stripe Webhook Signature Check',
    project: 'Billing Gateway',
    severity: 'medium',
    resolvedAt: 'Oct 24, 2026',
    mttr: '8 mins',
    testsPassed: 9,
    totalTests: 9,
    filesModified: 1,
    rootCause: 'Raw payload buffer consumed prior to HMAC validation in Express middleware chain.',
    fixStatus: 'verified',
  },
  {
    id: 'RPT-1025',
    title: 'Memory Leak in PyTorch Inference Worker Thread Pool',
    project: 'Recommendation Engine',
    severity: 'high',
    resolvedAt: 'Oct 21, 2026',
    mttr: '35 mins',
    testsPassed: 14,
    totalTests: 15,
    filesModified: 4,
    rootCause: 'Tensors retained in computation graph due to missing torch.no_grad() context manager.',
    fixStatus: 'needs_review',
  },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<Report>(mockReports[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReports = mockReports.filter(
    (r) =>
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center">
              <FileBarChart size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Incident & RCA Reports</h1>
          </div>
          <p className="text-sm text-slate-400">
            Automated technical investigation logs, test validations, and root-cause summaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-ghost flex items-center gap-2 text-sm">
            <Share2 size={16} />
            Share Report
          </button>
          <button className="btn-gradient flex items-center gap-2 text-sm">
            <Download size={16} />
            Export Executive PDF
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Avg Resolution Time</span>
            <Clock size={16} className="text-accent-blue" />
          </div>
          <p className="text-2xl font-bold text-white">14.8 min</p>
          <span className="text-xs text-status-success flex items-center gap-1 mt-1">
            <TrendingUp size={12} /> -62% vs manual RCA
          </span>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Auto-Validated Fixes</span>
            <CheckCircle2 size={16} className="text-status-success" />
          </div>
          <p className="text-2xl font-bold text-white">94.2%</p>
          <span className="text-xs text-slate-400 mt-1 block">53 passed in sandbox</span>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Incidents Investigated</span>
            <ShieldAlert size={16} className="text-status-warning" />
          </div>
          <p className="text-2xl font-bold text-white">48</p>
          <span className="text-xs text-slate-400 mt-1 block">This month</span>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Unit Tests Executed</span>
            <TestTube size={16} className="text-accent-purple" />
          </div>
          <p className="text-2xl font-bold text-white">218</p>
          <span className="text-xs text-status-success mt-1 block">100% isolation in Docker</span>
        </div>
      </div>

      {/* Main Split Layout: Report List on Left, Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Report List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-card p-4">
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reports..."
                className="input-field pl-10 text-sm py-2"
              />
            </div>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredReports.map((report) => {
                const isSelected = selectedReport.id === report.id;

                return (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border ${
                      isSelected
                        ? 'bg-accent-blue/10 border-accent-blue/50 shadow-md'
                        : 'bg-dark-800/60 border-surface-border hover:bg-dark-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-mono font-medium text-slate-400">{report.id}</span>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          report.severity === 'critical'
                            ? 'bg-status-danger/15 text-status-danger'
                            : report.severity === 'high'
                            ? 'bg-status-warning/15 text-status-warning'
                            : 'bg-accent-blue/15 text-accent-blue'
                        }`}
                      >
                        {report.severity}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white mb-1 line-clamp-1">{report.title}</h4>
                    <p className="text-xs text-slate-400 mb-3">{report.project}</p>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-surface-border/50">
                      <span>MTTR: {report.mttr}</span>
                      <div className="flex items-center gap-1 text-status-success font-medium">
                        <CheckCircle2 size={12} />
                        {report.testsPassed}/{report.totalTests} tests
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Detailed Report View */}
        <div className="lg:col-span-7">
          <div className="glass-card p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-surface-border">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-medium text-accent-blue bg-accent-blue/10 px-2.5 py-1 rounded-md">
                    {selectedReport.id}
                  </span>
                  <span className="text-xs text-slate-400">{selectedReport.resolvedAt}</span>
                </div>
                <h2 className="text-xl font-bold text-white">{selectedReport.title}</h2>
                <p className="text-xs text-slate-400 mt-1">Repository: {selectedReport.project}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-status-success/15 text-status-success border border-status-success/30 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Fix Verified
                </span>
              </div>
            </div>

            {/* Root Cause Analysis section */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle size={15} className="text-status-warning" />
                Root Cause Identification
              </h3>
              <div className="bg-dark-900 border border-surface-border rounded-xl p-4 text-sm text-slate-300 leading-relaxed font-mono">
                {selectedReport.rootCause}
              </div>
            </div>

            {/* Validation & Test Results */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TestTube size={15} className="text-accent-blue" />
                Docker Sandbox Validation Suite
              </h3>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-dark-800 p-3 rounded-lg border border-surface-border text-center">
                  <span className="text-xs text-slate-400 block">Tests Passed</span>
                  <span className="text-lg font-bold text-status-success">
                    {selectedReport.testsPassed} / {selectedReport.totalTests}
                  </span>
                </div>
                <div className="bg-dark-800 p-3 rounded-lg border border-surface-border text-center">
                  <span className="text-xs text-slate-400 block">Files Modified</span>
                  <span className="text-lg font-bold text-accent-purple">{selectedReport.filesModified}</span>
                </div>
                <div className="bg-dark-800 p-3 rounded-lg border border-surface-border text-center">
                  <span className="text-xs text-slate-400 block">Regression Risk</span>
                  <span className="text-lg font-bold text-status-success">Low (0.02)</span>
                </div>
              </div>

              {/* Code Patch Diff Preview */}
              <div className="bg-dark-950 border border-surface-border rounded-xl p-4 font-mono text-xs overflow-x-auto space-y-1">
                <div className="text-slate-400 font-semibold mb-2 flex items-center gap-2">
                  <FileCode size={14} className="text-accent-blue" />
                  diff --git a/src/db/pool.py b/src/db/pool.py
                </div>
                <div className="text-slate-500">@@ -42,7 +42,9 @@ async def execute_query(sql, params):</div>
                <div className="text-status-danger bg-status-danger/10 px-2 py-0.5 rounded">- conn = await engine.acquire()</div>
                <div className="text-status-success bg-status-success/10 px-2 py-0.5 rounded">+ async with engine.acquire() as conn:</div>
                <div className="text-status-success bg-status-success/10 px-2 py-0.5 rounded">+     return await conn.fetch(sql, *params)</div>
                <div className="text-slate-400 pl-4"># Safely releases connection back to pool automatically</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-surface-border">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <GitCommit size={14} /> Commit SHA: 8f9b2a1c
              </div>

              <button className="btn-gradient text-xs py-2 px-4 flex items-center gap-1.5">
                Generate Pull Request
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
