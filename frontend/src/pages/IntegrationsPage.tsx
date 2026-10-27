import { useState } from 'react';
import {
  Plug,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { GithubIcon } from '../components/icons';

interface Integration {
  id: string;
  name: string;
  category: 'vcs' | 'monitoring' | 'cicd' | 'chat';
  description: string;
  status: 'connected' | 'disconnected' | 'syncing';
  lastSync?: string;
  iconBg: string;
}

const integrationsList: Integration[] = [
  {
    id: 'github',
    name: 'GitHub Enterprise / Cloud',
    category: 'vcs',
    description: 'Sync repositories, branch diffs, pull request comments, and actions workflows.',
    status: 'connected',
    lastSync: '2 mins ago',
    iconBg: 'bg-slate-800 text-white',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'vcs',
    description: 'Index merge requests, CI pipelines, and repository commit histories.',
    status: 'disconnected',
    iconBg: 'bg-orange-500/10 text-orange-400',
  },
  {
    id: 'sentry',
    name: 'Sentry Crash Reporting',
    category: 'monitoring',
    description: 'Ingest stack traces, unhandled exceptions, and tag telemetry directly into investigations.',
    status: 'connected',
    lastSync: '10 mins ago',
    iconBg: 'bg-purple-500/10 text-purple-400',
  },
  {
    id: 'datadog',
    name: 'Datadog Logs & APM',
    category: 'monitoring',
    description: 'Query trace IDs, live server logs, and latency spikes during incident RCA.',
    status: 'disconnected',
    iconBg: 'bg-indigo-500/10 text-indigo-400',
  },
  {
    id: 'slack',
    name: 'Slack Alerts Bot',
    category: 'chat',
    description: 'Post automated root-cause summaries and test validation reports into incident channels.',
    status: 'connected',
    lastSync: '1 hour ago',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    category: 'monitoring',
    description: 'Auto-trigger DevResolve investigations as soon as high-severity alerts fire.',
    status: 'disconnected',
    iconBg: 'bg-green-500/10 text-green-400',
  },
  {
    id: 'jira',
    name: 'Atlassian Jira',
    category: 'cicd',
    description: 'Link diagnosed incidents with bug tickets and auto-generate mitigation plans.',
    status: 'disconnected',
    iconBg: 'bg-blue-500/10 text-blue-400',
  },
  {
    id: 'docker',
    name: 'Docker Sandbox Runner',
    category: 'cicd',
    description: 'Isolated container environment for testing patches with pytest and node test runner.',
    status: 'connected',
    lastSync: 'Live Sandbox Active',
    iconBg: 'bg-cyan-500/10 text-cyan-400',
  },
];

export default function IntegrationsPage() {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [integrations, setIntegrations] = useState(integrationsList);

  const toggleStatus = (id: string) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = item.status === 'connected' ? 'disconnected' : 'connected';
          return { ...item, status: next, lastSync: next === 'connected' ? 'Just now' : undefined };
        }
        return item;
      })
    );
  };

  const filtered = integrations.filter((item) => {
    const matchesCat = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-accent flex items-center justify-center">
              <Plug size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Integrations & Data Sources</h1>
          </div>
          <p className="text-sm text-slate-400">
            Connect code repositories, log pipelines, telemetry platforms, and test sandboxes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-ghost flex items-center gap-2 text-sm">
            <RefreshCw size={16} className="text-slate-400" />
            Sync All
          </button>
          <button className="btn-gradient flex items-center gap-2 text-sm">
            <ShieldCheck size={16} />
            MCP Protocol Config
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                filterCategory === cat.id
                  ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20'
                  : 'bg-dark-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((item) => {
          const isConnected = item.status === 'connected';

          return (
            <div
              key={item.id}
              className={`glass-card p-6 flex flex-col justify-between transition-all duration-300 hover:border-slate-600 ${
                isConnected ? 'border-accent-blue/30 shadow-lg shadow-accent-blue/5' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${item.iconBg}`}>
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
                        Not Connected
                      </>
                    )}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-white mb-1.5">{item.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{item.description}</p>
              </div>

              <div className="pt-4 border-t border-surface-border/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {item.lastSync ? `Synced: ${item.lastSync}` : 'Ready to authenticate'}
                </span>

                <div className="flex items-center gap-2">
                  {isConnected && (
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700 transition-colors"
                      title="Settings"
                    >
                      <Sliders size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleStatus(item.id)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                      isConnected
                        ? 'bg-dark-800 text-slate-300 hover:bg-status-danger/20 hover:text-status-danger'
                        : 'btn-gradient py-1.5 px-3'
                    }`}
                  >
                    {isConnected ? 'Disconnect' : 'Connect'}
                    {!isConnected && <ExternalLink size={12} />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
