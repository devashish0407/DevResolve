import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { api, Conversation, NotificationItem } from '../lib/api';
import {
  LayoutDashboard,
  MessageSquarePlus,
  Plug,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Trash2,
  Zap,
  FolderGit2,
  Ticket,
} from 'lucide-react';
import NewInvestigationModal from './NewInvestigationModal';
import BYOKSettingsModal from './BYOKSettingsModal';
import GitHubImportModal from './GitHubImportModal';
import RaiseTicketModal from './RaiseTicketModal';

const navItems = [
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/app/chat', icon: MessageSquarePlus, label: 'Investigation' },
  { path: '/app/integrations', icon: Plug, label: 'Integrations' },
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [chats, setChats] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isInvestigationModalOpen, setIsInvestigationModalOpen] = useState(false);
  const [isByokModalOpen, setIsByokModalOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [rateLimitFlags, setRateLimitFlags] = useState<any[]>([]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const fetchAIConfig = async () => {
    try {
      const cfg = await api.getAISettings();
      if (cfg) {
        setAiConfig(cfg);
        if (cfg.active_rate_limit_flags) {
          setRateLimitFlags(cfg.active_rate_limit_flags);
        }
      }
    } catch (err) {
      console.warn('Could not load AI settings', err);
    }
  };

  // Load real user conversations & notifications & rate limit status
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [convsRes, notifsRes, limitsRes] = await Promise.allSettled([
          api.getConversations(),
          api.getNotifications(),
          api.getRateLimitFlags(),
        ]);

        if (mounted && convsRes.status === 'fulfilled') {
          setChats(convsRes.value.conversations || []);
        }
        if (mounted && notifsRes.status === 'fulfilled') {
          setNotifications(notifsRes.value || []);
        }
        if (mounted && limitsRes.status === 'fulfilled' && limitsRes.value) {
          setRateLimitFlags(limitsRes.value.flags || []);
        }
      } catch (err) {
        console.warn('Failed to fetch initial sidebar data', err);
      }
    }

    loadData();
    fetchAIConfig();
    const interval = setInterval(loadData, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleMarkAllNotifications = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayName = user?.displayName || 'Devashish Sharma';
  const email = user?.email || 'devashish@devresolve.io';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const startNewInvestigation = () => {
    setIsInvestigationModalOpen(true);
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (window.location.search.includes(chatId)) {
        navigate('/app/chat');
      }
    } catch (err) {
      console.error('Failed to delete investigation', err);
    }
  };

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside
        className={`${
          collapsed ? 'w-[68px]' : 'w-[280px]'
        } flex flex-col border-r border-surface-border bg-dark-850 transition-all duration-300 ease-out`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-border shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg text-white tracking-tight">
              DevResolve
            </span>
          )}
        </div>

        {/* New Investigation Button */}
        <div className="px-3 py-4">
          <button
            onClick={startNewInvestigation}
            className={`btn-gradient w-full flex items-center justify-center gap-2 ${
              collapsed ? 'px-2' : ''
            }`}
          >
            <Plus size={18} />
            {!collapsed && <span>New Investigation</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Chats History */}
        {!collapsed && (
          <div className="mt-6 px-3 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Recent Chats
              </p>
              <span className="text-[10px] text-slate-500 font-mono">
                {chats.length} active
              </span>
            </div>

            <div className="space-y-0.5">
              {chats.length === 0 ? (
                <div className="px-3 py-4 text-center rounded-lg border border-dashed border-surface-border">
                  <p className="text-xs text-slate-500">No investigations yet</p>
                  <button
                    onClick={startNewInvestigation}
                    className="text-xs text-accent-blue hover:underline mt-1 font-medium inline-block"
                  >
                    + Start investigation
                  </button>
                </div>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => navigate(`/app/chat?id=${chat.id}`)}
                    className="nav-item w-full text-left group cursor-pointer flex items-center justify-between relative hover:bg-dark-800"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm truncate text-slate-300 group-hover:text-white">
                        {chat.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {chat.last_message_at
                          ? new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Recent'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        title="Delete investigation"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 hover:bg-dark-700 rounded transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          chat.status === 'resolved'
                            ? 'bg-status-success'
                            : chat.status === 'investigating'
                            ? 'bg-status-warning'
                            : 'bg-accent-blue'
                        }`}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Bottom */}
        <div className="mt-auto border-t border-surface-border p-3 space-y-2">
          {/* Collapse Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="nav-item w-full justify-center"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!collapsed && <span className="flex-1">Collapse</span>}
          </button>

          {/* User Profile */}
          <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate">{email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-400 hover:text-white p-1 rounded transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <header className="h-16 border-b border-surface-border bg-dark-850/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search projects, incidents, or error codes..."
                className="input-field pl-10 w-80 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-lg transition-colors ${
                  showNotifications ? 'bg-surface-hover text-white' : 'hover:bg-surface-hover text-slate-400'
                }`}
                title="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-status-danger ring-2 ring-dark-850 animate-pulse" />
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 sm:w-96 glass-card p-4 shadow-2xl z-50 border border-slate-700 animate-slide-up">
                  <div className="flex items-center justify-between pb-3 border-b border-surface-border mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">Notifications</h4>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-accent-blue/20 text-accent-blue font-bold px-1.5 py-0.5 rounded">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleMarkAllNotifications}
                        className="text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Mark all read
                      </button>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-slate-400 hover:text-white p-0.5 rounded"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-lg border transition-colors ${
                            n.read
                              ? 'bg-dark-900/50 border-surface-border text-slate-400'
                              : 'bg-accent-blue/5 border-accent-blue/30 text-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {n.type === 'alert' && <AlertTriangle size={15} className="text-status-warning shrink-0 mt-0.5" />}
                            {n.type === 'success' && <CheckCircle2 size={15} className="text-status-success shrink-0 mt-0.5" />}
                            {n.type === 'info' && <Info size={15} className="text-accent-blue shrink-0 mt-0.5" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{n.title}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                              <p className="text-[10px] text-slate-500 mt-1">{n.time}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Rate Limit Alert Flag Indicator */}
            {rateLimitFlags && rateLimitFlags.length > 0 && (
              <button
                onClick={() => setIsByokModalOpen(true)}
                className="bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 rounded-lg px-2.5 py-1.5 text-xs text-rose-300 flex items-center gap-1.5 transition-all shadow-md animate-pulse"
                title={`Rate limit flag active for ${rateLimitFlags[0].provider.toUpperCase()} (${rateLimitFlags[0].status_code}). Click to switch provider.`}
              >
                <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                <span className="font-bold hidden sm:inline">
                  Rate Limit Flag [{rateLimitFlags[0].provider.toUpperCase()} 429]
                </span>
                <span className="font-bold sm:hidden">429</span>
              </button>
            )}

            {/* GitHub MCP Import Button */}
            <button
              onClick={() => setIsGitHubModalOpen(true)}
              className="btn-ghost text-xs py-1.5 px-3 border border-surface-border flex items-center gap-1.5 text-slate-300 hover:text-white"
              title="Import GitHub Repository via MCP"
            >
              <FolderGit2 size={14} className="text-cyan-400" />
              <span className="hidden sm:inline">Import GitHub Repo</span>
            </button>

            {/* AI Engine (BYOK) Button */}
            <button
              onClick={() => setIsByokModalOpen(true)}
              className="bg-dark-800 hover:bg-dark-750 border border-surface-border hover:border-accent-blue/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 flex items-center gap-2 transition-colors shadow-sm"
              title="Configure AI API Keys (Gemini, OpenAI, Ollama)"
            >
              <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
              <span className="font-medium">
                {aiConfig?.model
                  ? aiConfig.model.includes('gemini')
                    ? 'Gemini 1.5'
                    : aiConfig.model.includes('gpt')
                    ? 'GPT-4o'
                    : aiConfig.model
                  : 'AI Engine (BYOK)'}
              </span>
              <Zap size={13} className="text-amber-400" />
            </button>

            {/* Raise Ticket / Support Button */}
            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="btn-ghost text-xs py-1.5 px-3 border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 flex items-center gap-1.5 transition-colors shadow-sm"
              title="Raise a Support Ticket or Report an Issue"
            >
              <Ticket size={14} className="text-amber-400" />
              <span className="hidden sm:inline">Raise Ticket</span>
            </button>
          </div>
        </header>

        {/* Real-time Rate Limit Alert Banner */}
        {rateLimitFlags && rateLimitFlags.length > 0 && (
          <div className="bg-rose-950/80 border-b border-rose-500/40 px-6 py-2.5 flex items-center justify-between text-xs text-rose-200 z-10 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={16} className="text-rose-400 shrink-0" />
              <div>
                <span className="font-bold text-rose-300">
                  Rate Limit Flag Raised [{rateLimitFlags[0].provider.toUpperCase()} HTTP {rateLimitFlags[0].status_code}]:
                </span>{' '}
                <span>{rateLimitFlags[0].error_message || 'Rate limit threshold hit on this key.'}</span>{' '}
                <span className="text-rose-400/90 font-medium ml-1">
                  Cooldown: ~{rateLimitFlags[0].retry_after_seconds}s. {rateLimitFlags[0].recommendation}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsByokModalOpen(true)}
                className="px-2.5 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white font-semibold transition-colors text-[11px] shadow"
              >
                Switch Provider in BYOK
              </button>
              <button
                onClick={async () => {
                  await api.clearRateLimitFlag(rateLimitFlags[0].provider);
                  setRateLimitFlags((prev) => prev.filter((f) => f.provider !== rateLimitFlags[0].provider));
                }}
                className="text-slate-400 hover:text-white p-1 rounded"
                title="Dismiss Alert"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {/* New Investigation Modal */}
      <NewInvestigationModal
        isOpen={isInvestigationModalOpen}
        onClose={() => setIsInvestigationModalOpen(false)}
        onCreated={async () => {
          try {
            const res = await api.getConversations();
            if (res && res.conversations) {
              setChats(res.conversations);
            }
          } catch (err) {
            console.warn('Failed to refresh chats stack', err);
          }
        }}
      />

      {/* BYOK Settings Modal */}
      <BYOKSettingsModal
        isOpen={isByokModalOpen}
        onClose={() => setIsByokModalOpen(false)}
        onSaved={fetchAIConfig}
      />

      {/* GitHub MCP Project Importer Modal */}
      <GitHubImportModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        onImported={() => {
          api.getConversations().then((res) => {
            if (res && res.conversations) setChats(res.conversations);
          });
        }}
      />

      {/* Global Raise Ticket / Support Modal */}
      <RaiseTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
      />
    </div>
  );
}
