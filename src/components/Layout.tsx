import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Settings,
  AlertTriangle,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  X,
  User,
  Activity
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { appUser, user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', roles: ['super_admin', 'admin', 'partner'] },
    { name: 'Publishers', icon: Users, href: '/publishers', roles: ['super_admin', 'admin', 'partner'] },
    { name: 'Alerts', icon: AlertTriangle, href: '/alerts', roles: ['super_admin', 'admin', 'partner'] },
    { name: 'Reports', icon: BarChart3, href: '/reports', roles: ['super_admin', 'admin', 'partner'] },
    { name: 'MFA Buster', icon: Shield, href: '/mfa-buster', roles: ['super_admin', 'admin'] },
    { name: 'Control Center', icon: Settings, href: '/mcm-parents', roles: ['super_admin', 'admin'] },
    { name: 'Profile', icon: User, href: '/profile', roles: ['super_admin', 'admin', 'partner'] },
  ];

  // If appUser missing, default to showing non-admin views for authenticated users
  const filteredNavigation = appUser?.role
    ? navigation.filter(item => item.roles.includes(appUser.role))
    : navigation.filter(item => item.roles.includes('partner'));

  return (
    <div className="min-h-screen bg-[#0E0E0E]">
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-[#0E0E0E] border-b border-[#2C2C2C] z-50 h-14">
        <div className="flex items-center justify-between px-4 h-full">
          <h1 className="text-base sm:text-lg font-semibold text-white truncate">LP Media</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white p-2 -mr-2"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0E0E0E] border-r border-[#2C2C2C] transform transition-transform duration-200 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-[#2C2C2C] hidden lg:block">
            <h1 className="text-xl font-semibold text-white">LP Media</h1>
            <p className="text-xs text-gray-400 mt-0.5">Control Center</p>
          </div>

          <div className="flex-1 p-3 overflow-y-auto pt-4 lg:pt-3">
            <div className="mb-4">
              <div className="bg-[#161616] rounded-lg p-2.5 border border-[#2C2C2C]">
                <p className="text-xs text-gray-400">Logged in as</p>
                <p className="text-xs sm:text-sm text-white font-medium truncate break-all">{user?.email || appUser?.email || 'Authenticated user'}</p>
                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-semibold ${
                  appUser?.role === 'super_admin' ? 'bg-[#48a77f] text-white' :
                  appUser?.role === 'admin' ? 'bg-[#48a77f] text-white' :
                  'bg-[#48a77f] text-white'
                }`}>
                  {(appUser?.role?.replace('_', ' ').toUpperCase()) || 'AUTHENTICATED'}
                </span>
              </div>
            </div>

            <nav className="space-y-1">
              {filteredNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2.5 text-sm rounded-lg transition-colors group ${
                    location.pathname === item.href
                      ? 'bg-[#48a77f] text-white'
                      : 'text-gray-400 hover:bg-[#48a77f]'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-4 h-4 mr-3 flex-shrink-0 ${
                    location.pathname === item.href
                      ? 'text-white'
                      : 'text-gray-400 group-hover:text-white'
                  }`} />
                  <span className={`truncate ${
                    location.pathname === item.href
                      ? 'text-white'
                      : 'text-gray-400 group-hover:text-white'
                  }`}>
                    {item.name}
                  </span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="p-3 border-t border-[#2C2C2C]">
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-3 py-2.5 text-sm text-gray-400 hover:bg-[#48a77f] rounded-lg transition-colors group"
            >
              <LogOut className="w-4 h-4 mr-3 flex-shrink-0 group-hover:text-white" />
              <span className="group-hover:text-white">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="lg:pl-64 pt-[3.5rem] lg:pt-0">
        <main className="p-3 sm:p-4 md:p-6 min-h-screen">
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
