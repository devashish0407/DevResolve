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
} from 'lucide-react';

const projects = [
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
    description: 'React Native application',
    icon: Smartphone,
    color: 'from-accent-purple to-pink-500',
    incidents: 3,
    openIncidents: 1,
    lastUpdated: 'Last updated 1 week ago',
  },
  {
    id: '3',
    name: 'ML Pipeline',
    description: 'Model training and inference',
    icon: Brain,
    color: 'from-status-success to-emerald-400',
    incidents: 2,
    openIncidents: 0,
    lastUpdated: 'Last updated 3 days ago',
  },
  {
    id: '4',
    name: 'Portfolio Website',
    description: 'Personal website and blog',
    icon: Globe,
    color: 'from-amber-500 to-orange-500',
    incidents: 1,
    openIncidents: 0,
    lastUpdated: 'Last updated 1 month ago',
  },
  {
    id: '5',
    name: 'Traffic Sign Recognition',
    description: 'YOLO5s + PaddleOCR pipeline',
    icon: Camera,
    color: 'from-rose-500 to-red-500',
    incidents: 1,
    openIncidents: 1,
    lastUpdated: 'Last updated 4 days ago',
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Projects</h1>
          <p className="text-sm text-slate-400">{projects.length} projects · {projects.reduce((a, p) => a + p.openIncidents, 0)} open incidents</p>
        </div>
        <button
          onClick={() => navigate('/onboarding')}
          className="btn-gradient flex items-center gap-2"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search projects..."
          className="input-field pl-10 max-w-md"
        />
      </div>

      {/* Project Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((project, i) => (
          <div
            key={project.id}
            onClick={() => navigate('/app/chat')}
            className="glass-card p-5 cursor-pointer group animate-slide-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {/* Top */}
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${project.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <project.icon size={22} className="text-white" />
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); }}
                className="p-1 rounded-md hover:bg-surface-hover transition-colors text-slate-500 hover:text-slate-300"
              >
                <MoreVertical size={16} />
              </button>
            </div>

            {/* Info */}
            <h3 className="text-base font-semibold text-white mb-1 group-hover:text-accent-blue transition-colors">
              {project.name}
            </h3>
            <p className="text-sm text-slate-500 mb-4">{project.description}</p>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Bug size={14} className="text-slate-400" />
                <span className="text-slate-300">{project.incidents}</span>
              </div>
              {project.openIncidents > 0 && (
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-status-warning" />
                  <span className="text-sm text-status-warning">{project.openIncidents}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={12} />
              <span>{project.lastUpdated}</span>
            </div>
          </div>
        ))}

        {/* Create New Card */}
        <div
          onClick={() => navigate('/onboarding')}
          className="glass-card p-5 cursor-pointer border-dashed flex flex-col items-center justify-center gap-3 min-h-[200px] hover:border-accent-blue/30 group"
        >
          <div className="w-12 h-12 rounded-xl border-2 border-dashed border-dark-400 flex items-center justify-center group-hover:border-accent-blue/50 transition-colors">
            <Plus size={24} className="text-slate-500 group-hover:text-accent-blue transition-colors" />
          </div>
          <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300 transition-colors">
            Create New Project
          </span>
        </div>
      </div>
    </div>
  );
}
