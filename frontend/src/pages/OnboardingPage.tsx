import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderPlus,
  GitBranch,
  Plug,
  Rocket,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Upload,
  Globe,
} from 'lucide-react';
import { GithubIcon } from '../components/icons';

const steps = [
  { id: 1, label: 'Create Project', icon: FolderPlus },
  { id: 2, label: 'Connect Repository', icon: GitBranch },
  { id: 3, label: 'Add Integrations', icon: Plug },
  { id: 4, label: 'Start Investigating', icon: Rocket },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const handleFinish = () => {
    navigate('/app/chat');
  };

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-accent-blue/3 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Let's set up your workspace</h1>
          <p className="text-slate-400">
            Create a project and connect your data sources to start investigating.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    step.id < currentStep
                      ? 'bg-status-success text-white'
                      : step.id === currentStep
                      ? 'bg-gradient-accent text-white shadow-glow-blue'
                      : 'bg-dark-700 text-slate-500'
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle size={18} />
                  ) : (
                    step.id
                  )}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  step.id <= currentStep ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-16 h-0.5 mx-2 mb-6 transition-colors ${
                  step.id < currentStep ? 'bg-status-success' : 'bg-dark-600'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="glass-card p-8 animate-fade-in">
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Create your project</h2>
              <p className="text-sm text-slate-400">
                A project groups your repositories, investigations and integrations together.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Project name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="E-Commerce API"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="A short description of your project"
                  className="input-field resize-none h-24"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Connect a repository</h2>
              <p className="text-sm text-slate-400">
                Import your codebase to enable code search and analysis.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'GitHub', icon: GithubIcon, active: true },
                  { name: 'GitLab', icon: Globe, active: false },
                  { name: 'Upload ZIP', icon: Upload, active: false },
                ].map((option) => (
                  <button
                    key={option.name}
                    className={`p-4 rounded-lg border text-center transition-all ${
                      option.active
                        ? 'border-accent-blue bg-accent-blue/10 text-white'
                        : 'border-surface-border bg-dark-800 text-slate-500 cursor-not-allowed'
                    }`}
                    disabled={!option.active}
                  >
                    <option.icon size={24} className="mx-auto mb-2" />
                    <span className="text-sm font-medium">{option.name}</span>
                    {!option.active && (
                      <span className="block text-xs text-slate-600 mt-1">Coming soon</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="glass-card p-4">
                <p className="text-sm font-medium text-white mb-3">Select repositories</p>
                {[
                  { name: 'devashish/backend-api', private: true },
                  { name: 'devashish/mobile-app', private: true },
                  { name: 'devashish/ml-pipeline', private: false },
                ].map((repo) => (
                  <label key={repo.name} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-surface-border bg-dark-800 text-accent-blue" />
                    <GitBranch size={16} className="text-slate-400" />
                    <span className="text-sm text-slate-300 flex-1">{repo.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      repo.private ? 'bg-status-warning/10 text-status-warning' : 'bg-dark-600 text-slate-400'
                    }`}>
                      {repo.private ? 'Private' : 'Public'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">Connect integrations</h2>
              <p className="text-sm text-slate-400">
                Connect your tools to give DevResolve more context about your incidents.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: 'Sentry', desc: 'Error tracking', color: 'from-purple-600 to-pink-500', connected: false },
                  { name: 'Datadog', desc: 'Monitoring & logs', color: 'from-violet-600 to-purple-500', connected: false },
                  { name: 'Notion', desc: 'Documentation', color: 'from-slate-500 to-slate-400', connected: false },
                  { name: 'Confluence', desc: 'Knowledge base', color: 'from-blue-600 to-blue-400', connected: false },
                ].map((integration) => (
                  <div key={integration.name} className="glass-card p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${integration.color} flex items-center justify-center shrink-0`}>
                      <Plug size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{integration.name}</p>
                      <p className="text-xs text-slate-500">{integration.desc}</p>
                    </div>
                    <button className="btn-ghost text-xs px-3 py-1.5">
                      Connect
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 text-center">
                You can add more integrations later from Settings.
              </p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="text-center space-y-6 py-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-accent flex items-center justify-center mx-auto shadow-glow-blue">
                <Rocket size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">You're all set!</h2>
              <p className="text-slate-400 max-w-md mx-auto">
                Your workspace is ready. DevResolve will index your connected repositories
                and you can start investigating incidents right away.
              </p>
              <div className="glass-card p-4 max-w-sm mx-auto text-left">
                <p className="text-sm font-medium text-white mb-3">What's next:</p>
                <ul className="space-y-2">
                  {[
                    'Paste an error or stack trace to investigate',
                    'DevResolve searches your code and logs',
                    'Get a diagnosis with evidence and suggested fixes',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <CheckCircle size={16} className="text-status-success shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-surface-border">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              className={`btn-ghost flex items-center gap-2 ${currentStep === 1 ? 'invisible' : ''}`}
            >
              <ArrowLeft size={16} />
              Back
            </button>
            {currentStep < 4 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="btn-gradient flex items-center gap-2"
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={handleFinish} className="btn-gradient flex items-center gap-2">
                Start Investigating
                <Rocket size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
