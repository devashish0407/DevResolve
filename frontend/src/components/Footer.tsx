import { Link } from 'react-router-dom';
import { Sparkles, Mail } from 'lucide-react';
import { GithubIcon, LinkedinIcon } from './icons';

interface FooterProps {
  className?: string;
  variant?: 'landing' | 'dashboard';
}

export default function Footer({ className = '', variant = 'dashboard' }: FooterProps) {
  return (
    <footer
      className={`border-t border-surface-border/70 ${
        variant === 'landing'
          ? 'bg-dark-950 py-10 px-6'
          : 'bg-dark-900/40 border border-surface-border/60 rounded-2xl py-6 px-6 mt-12'
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Logo & Brand Name */}
        <Link
          to="/"
          className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          title="DevResolve Home"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-accent flex items-center justify-center shadow-md shadow-accent-blue/20 shrink-0">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm tracking-wide">DevResolve</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent-blue/15 text-accent-blue border border-accent-blue/30 font-semibold">
                v0.1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Autonomous AI Incident Engineering & Live Code Reasoning
            </p>
          </div>
        </Link>

        {/* Developer Credit & Copyright */}
        <div className="text-center sm:text-left text-xs text-slate-400">
          <span>Developed by </span>
          <span className="font-semibold text-slate-200">Devashish</span>
          <span className="text-slate-600 mx-2">•</span>
          <span>© 2026 DevResolve. All rights reserved.</span>
        </div>

        {/* Social / Professional Links */}
        <div className="flex items-center gap-2.5">
          {/* GitHub */}
          <a
            href="https://github.com/devashish0407"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub: @devashish0407"
            className="w-9 h-9 rounded-xl bg-dark-850 hover:bg-dark-800 border border-surface-border hover:border-accent-blue/50 text-slate-400 hover:text-white flex items-center justify-center transition-all hover:scale-105 shadow-sm"
          >
            <GithubIcon size={17} />
          </a>

          {/* LinkedIn */}
          <a
            href="https://www.linkedin.com/in/devashish-s-81aa06251/"
            target="_blank"
            rel="noopener noreferrer"
            title="LinkedIn: Devashish"
            className="w-9 h-9 rounded-xl bg-dark-850 hover:bg-dark-800 border border-surface-border hover:border-cyan-400/50 text-slate-400 hover:text-cyan-400 flex items-center justify-center transition-all hover:scale-105 shadow-sm"
          >
            <LinkedinIcon size={17} />
          </a>

          {/* Email */}
          <a
            href="mailto:devashish0716@gmail.com"
            title="Email: devashish0716@gmail.com"
            className="w-9 h-9 rounded-xl bg-dark-850 hover:bg-dark-800 border border-surface-border hover:border-amber-400/50 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-all hover:scale-105 shadow-sm"
          >
            <Mail size={17} />
          </a>
        </div>
      </div>
    </footer>
  );
}
