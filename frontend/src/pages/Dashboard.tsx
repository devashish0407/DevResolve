import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreVertical,
  Bug,
  Clock,
  AlertTriangle,
  Server,
  Smartphone,
  Brain,
  Globe,
  Camera,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';

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

const initialProjects: ProjectItem[] = [
  {
    id: '1',
    name: 'Main Backend',
    description: 'Core API and authentication service',
    icon: Server,
    color: 'from-accent-blue to-accent-indigo',
    incidents: 6,
    openIncidents: 2,
    lastUpdated: 'Last updated 2 days ago',
  },
  {
    id: '2',
    name: 'Mobile App',
    description: 'React Native iOS & Android client',
    icon: Smartphone,
    color: 'from-accent-purple to-pink-500',
    incidents: 3,
    openIncidents: 1,
    lastUpdated: 'Last updated 1 week ago',
  },
  {
    id: '3',
    name: 'ML Pipeline',
    description: 'Model training and real-time inference worker',
    icon: Brain,
    color: 'from-status-success to-emerald-400',
    incidents: 2,
    openIncidents: 0,
    lastUpdated: 'Last updated 3 days ago',
  },
  {
    id: '4',
    name: 'Checkout & Billing Gateway',
    description: 'Stripe webhook ingestion and payment ledger',
    icon: Globe,
    color: 'from-amber-500 to-orange-500',
    incidents: 4,
    openIncidents: 1,
    lastUpdated: 'Last updated today',
  },
  {
    id: '5',
    name: 'Traffic Sign Recognition',
    description: 'YOLOv8s + PaddleOCR pipeline',
    icon: Camera,
    color: 'from-rose-500 to-red-500',
    incidents: 1,
    openIncidents: 0,
    lastUpdated: 'Last updated 4 days ago',
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[]>(initialProjects);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateQuickProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj: ProjectItem = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || 'Custom incident investigation workspace',
      icon: Server,
      color: 'from-accent-blue to-accent-purple',
      incidents: 0,
      openIncidents: 0,
      lastUpdated: 'Just created',
    };

    setProjects([newProj, ...projects]);
    setNewProjectName('');
    setNewProjectDesc('');
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Projects & Workspaces</h1>
          <p className="text-sm text-slate-400">
            {projects.length} connected repositories • {projects.reduce((a, p) => a + p.openIncidents, 0)} open investigations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/onboarding')}
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            Setup Wizard
            <ArrowRight size={15} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-gradient flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            Quick New Project
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search projects by name or technology..."
          className="input-field pl-10 max-w-md py-2.5 text-sm"
        />
      </div>

      {/* Project Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((project, i) => (
          <div
            key={project.id}
            onClick={() => navigate('/app/chat')}
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
          onClick={() => setIsModalOpen(true)}
          className="glass-card p-5 cursor-pointer border-dashed border-2 flex flex-col items-center justify-center gap-3 min-h-[190px] hover:border-accent-blue/40 group transition-all"
        >
          <div className="w-12 h-12 rounded-xl border border-dashed border-slate-600 flex items-center justify-center group-hover:border-accent-blue transition-colors">
            <Plus size={22} className="text-slate-400 group-hover:text-accent-blue transition-colors" />
          </div>
          <span className="text-xs font-medium text-slate-400 group-hover:text-white transition-colors">
            Add Another Project
          </span>
        </div>
      </div>

      {/* Quick Add Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 shadow-2xl relative border border-slate-700">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-bold text-white">Create New Project</h2>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Enter details for your new repository or microservice to enable autonomous incident diagnosis.
            </p>

            <form onSubmit={handleCreateQuickProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Payments Gateway Microservice"
                  className="input-field text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Brief description of the service and codebase"
                  rows={3}
                  className="input-field text-sm resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost text-xs py-2 px-3"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gradient text-xs py-2 px-4">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
