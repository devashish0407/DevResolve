import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  LayoutDashboard,
  MessageSquarePlus,
  Plug,
  FileBarChart,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  Plus,
} from 'lucide-react';

const navItems = [
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/app/chat', icon: MessageSquarePlus, label: 'New Investigation' },
  { path: '/app/integrations', icon: Plug, label: 'Integrations' },
  { path: '/app/reports', icon: FileBarChart, label: 'Reports' },
  { path: '/app/settings', icon: Settings, label: 'Settings' },
];

const recentChats = [
  { id: '1', title: '500 error on login API', status: 'resolved', time: 'Today' },
  { id: '2', title: 'Database connection leak', status: 'investigating', time: 'Today' },
  { id: '3', title: 'High memory usage', status: 'resolved', time: 'Yesterday' },
  { id: '4', title: 'Redis timeout errors', status: 'active', time: 'Yesterday' },
  { id: '5', title: 'Slow API response', status: 'resolved', time: '2 days ago' },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.displayName || 'Devashish Sharma';
  const email = user?.email || 'devashish@email.com';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

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
            onClick={() => navigate('/app/chat')}
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

        {/* Recent Chats */}
        {!collapsed && (
          <div className="mt-6 px-3 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
              Recent Chats
            </p>
            <div className="space-y-0.5">
              {recentChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/app/chat/${chat.id}`)}
                  className="nav-item w-full text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-slate-300 group-hover:text-white">
                      {chat.title}
                    </p>
                    <p className="text-xs text-slate-500">{chat.time}</p>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      chat.status === 'resolved'
                        ? 'bg-status-success'
                        : chat.status === 'investigating'
                        ? 'bg-status-warning'
                        : 'bg-accent-blue'
                    }`}
                  />
                </button>
              ))}
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

          {/* User */}
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
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-surface-border bg-dark-850/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search projects, incidents..."
                className="input-field pl-10 w-80 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-surface-hover transition-colors">
              <Bell size={20} className="text-slate-400" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-status-danger" />
            </button>
            <select className="bg-dark-800 border border-surface-border rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none">
              <option>GPT-4o</option>
              <option>Claude 3.5</option>
              <option>Gemini Pro</option>
            </select>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
