import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Trophy,
  Activity,
  Users,
  Shield,
  MapPin,
  Video,
  LayoutDashboard,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
  UserCheck,
  Award,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PlatformRole } from '../domain/rbac';

const NAV_ITEMS = [
  { label: 'Match Center', path: '/', icon: Activity },
  { label: 'Fixtures & Results', path: '/matches', icon: Calendar },
  { label: 'Tournaments & NRR', path: '/tournaments', icon: Trophy },
  { label: 'Series Hub', path: '/series/series-premier-t20', icon: Award },
  { label: 'Clubs & Squads', path: '/teams/team-emr', icon: Users },
  { label: 'Player Analytics', path: '/players/p-emr-1', icon: UserCheck },
  { label: 'Ground Directory', path: '/grounds', icon: MapPin },
  { label: 'Video Coaching', path: '/coach', icon: Video },
  { label: 'My Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Admin & Audit', path: '/admin', icon: Shield },
];

const ROLES: Array<{ value: PlatformRole; label: string }> = [
  { value: 'scorer', label: 'Role: Assigned Scorer' },
  { value: 'tournament_organizer', label: 'Role: Organizer' },
  { value: 'team_manager', label: 'Role: Team Manager' },
  { value: 'player', label: 'Role: Player' },
  { value: 'admin', label: 'Role: Platform Admin' },
  { value: 'visitor', label: 'Role: Visitor (Read-Only)' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    theme,
    toggleTheme,
    activeRole,
    setActiveRoleAndUid,
    firebaseUser,
    toasts,
    dismissToast,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDark = theme === 'dark';

  const currentBreadcrumb = () => {
    const p = location.pathname;
    if (p === '/') return 'Workspace / Match Discovery';
    if (p.startsWith('/matches/')) return `Matches / Live & Scorecard / ${p.split('/')[2]}`;
    if (p === '/matches') return 'Matches / Directory & Results';
    if (p.startsWith('/tournaments/')) return `Tournaments / Standings & Bracket / ${p.split('/')[2]}`;
    if (p === '/tournaments') return 'Tournaments / Competition Engine';
    if (p.startsWith('/series/')) return 'Series / Competition Hub';
    if (p.startsWith('/teams/')) return 'Teams / Squad & Roster';
    if (p.startsWith('/players/')) return 'Players / Career Statistics';
    if (p === '/grounds') return 'Grounds / Venue Directory';
    if (p === '/coach') return 'Coaching / Biomechanics & Video Review';
    if (p.startsWith('/dashboard')) return 'Dashboard / Operations';
    if (p === '/admin') return 'Administration / RBAC & Audit Logs';
    if (p === '/settings') return 'Account / Settings & Privacy';
    return `Workspace / ${p.replace('/', '')}`;
  };

  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row ${
        isDark ? 'bg-[#0B0F14] text-[#F1F5F9]' : 'bg-[#F8FAFC] text-[#0F172A]'
      }`}
    >
      {/* Desktop Left Sidebar */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className={`hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r ${
          isDark ? 'bg-[#0F141C] border-slate-800/80' : 'bg-white border-slate-200'
        }`}
      >
        <div className="px-6 py-5 border-b border-slate-800/60 flex items-center justify-between">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-emerald-400 whitespace-nowrap shrink-0"
          >
            CRICKET PRO MAX
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main Modules">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path.split('/').slice(0, 2).join('/'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? isDark
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-emerald-50 text-emerald-800'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Sidebar Footer Links */}
        <div
          className={`p-4 border-t text-xs space-y-3 ${
            isDark ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <Link to="/settings" className="hover:text-emerald-400 transition-colors">
              Settings
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/privacy" className="hover:text-emerald-400 transition-colors">
              Privacy
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms" className="hover:text-emerald-400 transition-colors">
              Terms
            </Link>
          </div>
          <p className="text-[11px] leading-relaxed opacity-75">
            PostgreSQL Persisted · Integer Ball Engine · Official NRR
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Zone 1 Breadcrumb/Brand, Zone 2 Quick Links, Zone 3 Primary Controls */}
        <header
          className={`sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 lg:px-8 py-3 border-b backdrop-blur-md ${
            isDark
              ? 'bg-[#0B0F14]/95 border-slate-800/80'
              : 'bg-white/95 border-slate-200'
          }`}
        >
          {/* Left: Mobile Menu Button + Brand/Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              className={`lg:hidden p-2 rounded-lg border shrink-0 ${
                isDark ? 'border-slate-800 text-slate-200' : 'border-slate-200 text-slate-700'
              }`}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <Link
              to="/"
              className="lg:hidden font-display text-sm font-bold tracking-tight text-emerald-400 whitespace-nowrap shrink-0"
            >
              CRICKET PRO MAX
            </Link>
            <span
              className={`hidden md:inline-block text-sm font-medium truncate ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {currentBreadcrumb()}
            </span>
          </div>

          {/* Right: Active Role Selector + Theme Toggle + Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="rbac-role-select" className="sr-only">
              Active Permission Role
            </label>
            <select
              id="rbac-role-select"
              aria-label="Active Permission Role"
              value={activeRole}
              onChange={(e) => setActiveRoleAndUid(e.target.value as PlatformRole)}
              className={`text-xs font-medium rounded-lg px-2 sm:px-2.5 py-1.5 sm:py-2 border max-w-[148px] sm:max-w-none truncate focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                isDark
                  ? 'bg-[#131B26] border-slate-700 text-slate-200'
                  : 'bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              className={`p-2 rounded-lg border transition-colors shrink-0 ${
                isDark
                  ? 'bg-[#131B26] border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900'
              }`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => navigate('/matches/match-live-101?tab=scoring')}
              className="hidden md:inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Live Scoring Console
            </button>

            <Link
              to="/login"
              className={`hidden sm:inline-flex items-center px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {firebaseUser ? firebaseUser.displayName?.split(' ')[0] || 'Account' : 'Sign In'}
            </Link>
          </div>
        </header>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation Drawer"
            className={`lg:hidden border-b px-4 py-3 space-y-1 ${
              isDark ? 'bg-[#0F141C] border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 text-emerald-400" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-400">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                Sign In / Roles
              </Link>
              <span>·</span>
              <Link to="/settings" onClick={() => setMobileMenuOpen(false)}>
                Settings
              </Link>
              <span>·</span>
              <Link to="/privacy" onClick={() => setMobileMenuOpen(false)}>
                Privacy
              </Link>
            </div>
          </nav>
        )}

        {/* Toast Feedback Region */}
        {toasts.length > 0 && (
          <div
            aria-live="polite"
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg border shadow-lg text-xs font-medium ${
                  t.type === 'error'
                    ? 'bg-red-950/95 border-red-700 text-red-100'
                    : t.type === 'success'
                      ? 'bg-emerald-950/95 border-emerald-700 text-emerald-100'
                      : 'bg-slate-900/95 border-slate-700 text-slate-100'
                }`}
              >
                <span>{t.text}</span>
                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  aria-label="Dismiss Notification"
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Quiet Editorial Footer */}
        <footer
          className={`mt-auto border-t px-4 lg:px-8 py-5 text-xs ${
            isDark
              ? 'border-slate-800/80 text-slate-400 bg-[#0B0F14]'
              : 'border-slate-200 text-slate-500 bg-white'
          }`}
        >
          <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="font-semibold text-emerald-400">CRICKET PRO MAX</span>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              <span>Modular Monolith Sports-Tech Platform</span>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              <span>Seed Data Explicitly Flagged as Fictional</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/grounds" className="hover:text-emerald-400 transition-colors">
                Grounds
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/coach" className="hover:text-emerald-400 transition-colors">
                Biomechanics Coach
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/privacy" className="hover:text-emerald-400 transition-colors">
                Privacy Charter
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/terms" className="hover:text-emerald-400 transition-colors">
                Terms & Licensing
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
