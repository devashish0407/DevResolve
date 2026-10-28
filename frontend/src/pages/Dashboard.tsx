import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreVertical,
  Bug,
  Clock,
  AlertTriangle,
  Server,
  Shield,
  Database,
  FolderOpen,
} from 'lucide-react';
import { api, Project } from '../lib/api';
import NewInvestigationModal from '../components/NewInvestigationModal';
import Footer from '../components/Footer';

interface ProjectItem {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  incidents: number;
  openIncidents: number;
  lastUpdated: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isInvestigationModalOpen, setIsInvestigationModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true);
      try {
        const res = await api.getProjects();
        if (res && res.projects) {
          const mapped: ProjectItem[] = res.projects.map((p: Project, idx: number) => ({
            id: p.id,
            name: p.name,
            description: p.description || 'Workspace repository for incident root-cause analysis.',
            icon: idx % 3 === 0 ? Server : idx % 3 === 1 ? Shield : Database,
            color:
              idx % 3 === 0
                ? 'from-accent-blue to-accent-purple'
                : idx % 3 === 1
                ? 'from-emerald-500 to-teal-500'
                : 'from-indigo-500 to-purple-500',
            incidents: p.incident_count,
            openIncidents: p.open_incident_count,
            lastUpdated: p.last_activity_at
              ? new Date(p.last_activity_at).toLocaleDateString()
              : 'Active',
          }));
          setProjects(mapped);
        } else {
          setProjects([]);
        }
      } catch (err) {
        console.warn('Could not load remote projects', err);
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadProjects();
  }, []);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in relative space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Projects & Workspaces</h1>
          <p className="text-sm text-slate-400">
            {projects.length} connected repositories •{' '}
            {projects.reduce((a, p) => a + p.openIncidents, 0)} open investigations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsInvestigationModalOpen(true)}
            className="btn-gradient flex items-center gap-2 text-sm shadow-md"
          >
            <Plus size={16} />
            <span>New Investigation</span>
          </button>
        </div>
      </div>

      {/* Search Bar (Only shown if projects exist) */}
      {projects.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects by name or technology..."
            className="input-field pl-10 max-w-md py-2.5 text-sm"
          />
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-center">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500">Loading user repositories...</p>
        </div>
      ) : projects.length === 0 ? (
        /* Empty State when no mock projects */
        <div className="glass-card p-12 text-center rounded-2xl border border-dashed border-surface-border max-w-2xl mx-auto space-y-5 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-accent/20 border border-accent-blue/30 flex items-center justify-center mx-auto text-accent-blue shadow-inner">
            <FolderOpen size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">No Projects Configured</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              You haven't created any project workspaces yet. When you launch an investigation,
              a dedicated project workspace is created to scope your incident's root-cause analysis,
              code diffs, and incident reports.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => setIsInvestigationModalOpen(true)}
              className="btn-gradient px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2 shadow-lg"
            >
              <Plus size={18} />
              <span>Launch First Incident Investigation</span>
            </button>
          </div>
        </div>
      ) : (
        /* Project Grid */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((project, i) => (
            <div
              key={project.id}
              onClick={() =>
                navigate(
                  `/app/chat?project=${project.id}&projectName=${encodeURIComponent(project.name)}`
                )
              }
              className="glass-card p-5 cursor-pointer group animate-slide-up hover:border-slate-600 transition-all duration-300"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {/* Top */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${project.color} flex items-center justify-center group-hover:scale-105 transition-transform shadow-md`}
                >
                  <project.icon size={20} className="text-white" />
                </div>

                <div className="flex items-center gap-1.5">
                  {project.openIncidents > 0 ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-status-warning/15 text-status-warning border border-status-warning/30 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      {project.openIncidents} active
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/30">
                      Clean
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 rounded-md hover:bg-surface-hover text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>

              {/* Title & Info */}
              <h3 className="text-base font-semibold text-white mb-1 group-hover:text-accent-blue transition-colors">
                {project.name}
              </h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed line-clamp-2">
                {project.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-surface-border/60">
                <div className="flex items-center gap-1.5">
                  <Bug size={13} className="text-slate-400" />
                  <span>{project.incidents} total incidents</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>{project.lastUpdated}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Create Card Trigger */}
          <div
            onClick={() => setIsInvestigationModalOpen(true)}
            className="glass-card p-5 cursor-pointer border-dashed border-2 flex flex-col items-center justify-center gap-3 min-h-[190px] hover:border-accent-blue/40 group transition-all"
          >
            <div className="w-12 h-12 rounded-xl border border-dashed border-slate-600 flex items-center justify-center group-hover:border-accent-blue transition-colors">
              <Plus
                size={22}
                className="text-slate-400 group-hover:text-accent-blue transition-colors"
              />
            </div>
            <span className="text-xs font-medium text-slate-400 group-hover:text-white transition-colors">
              + Launch New Investigation
            </span>
          </div>
        </div>
      )}

      {/* Reusable New Investigation Modal */}
      <NewInvestigationModal
        isOpen={isInvestigationModalOpen}
        onClose={() => setIsInvestigationModalOpen(false)}
        onCreated={async () => {
          const res = await api.getProjects();
          if (res && res.projects) {
            setProjects(
              res.projects.map((p: Project, idx: number) => ({
                id: p.id,
                name: p.name,
                description: p.description || 'Workspace repository for incident RCA.',
                icon: idx % 3 === 0 ? Server : idx % 3 === 1 ? Shield : Database,
                color: 'from-accent-blue to-accent-purple',
                incidents: p.incident_count,
                openIncidents: p.open_incident_count,
                lastUpdated: 'Just now',
              }))
            );
          }
        }}
      />

      {/* Footer */}
      <Footer variant="dashboard" />
    </div>
  );
}
