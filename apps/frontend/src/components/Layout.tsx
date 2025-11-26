import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Mail,
  Users,
  BarChart3,
  Settings,
  Menu,
  Zap,
  Bell,
  Building2,
  Plus,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { useAppStore } from '../store';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
  { name: 'Prospects', href: '/prospects', icon: Users },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentClient = useAppStore((state) => state.currentClient);
  const setCurrentClient = useAppStore((state) => state.setCurrentClient);

  const handleSwitchClient = () => {
    setCurrentClient(null);
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-surface-50 to-primary-50/30">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-surface-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-surface-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-200">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-surface-900">Outreach</h1>
              <p className="text-xs text-surface-500">AI-Powered Sales</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={clsx('w-5 h-5', isActive && 'text-primary-600')} />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          {/* Current Client */}
          <div className="px-3 py-4 border-t border-surface-200">
            <div className="relative">
              <button
                onClick={() => setClientMenuOpen(!clientMenuOpen)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-surface-900 truncate">
                    {currentClient?.name || 'No Client'}
                  </p>
                  <p className="text-xs text-surface-500 truncate">
                    {currentClient?.website ? new URL(currentClient.website).hostname : 'Select a client'}
                  </p>
                </div>
                <ChevronDown className={clsx(
                  'w-4 h-4 text-surface-400 transition-transform',
                  clientMenuOpen && 'rotate-180'
                )} />
              </button>

              {/* Client dropdown menu */}
              {clientMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-surface-200 overflow-hidden">
                  <button
                    onClick={() => {
                      setClientMenuOpen(false);
                      handleSwitchClient();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-50 transition-colors text-left"
                  >
                    <Plus className="w-4 h-4 text-primary-600" />
                    <span className="text-sm font-medium text-surface-700">Add New Client</span>
                  </button>
                  <div className="border-t border-surface-100" />
                  <button
                    onClick={() => {
                      setClientMenuOpen(false);
                      handleSwitchClient();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600">Switch Client</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-surface-200">
          <div className="flex items-center justify-between px-4 py-3 lg:px-8">
            <button
              className="p-2 rounded-lg hover:bg-surface-100 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 text-surface-600" />
            </button>

            <div className="flex-1 lg:hidden" />

            <div className="flex items-center gap-3">
              <button className="relative p-2 rounded-lg hover:bg-surface-100 transition-colors">
                <Bell className="w-5 h-5 text-surface-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

