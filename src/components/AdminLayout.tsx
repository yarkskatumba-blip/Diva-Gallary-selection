import React, { useState, useEffect } from 'react';
import { Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  LayoutDashboard,
  Users,
  Layers,
  Image as ImageIcon,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { UploadManager } from './UploadManager';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const {
    admin,
    logoutAdmin,
    notifications,
    fetchAllGalleriesFromFirestore,
    fetchSettingsFromFirestore,
    cleanupInterruptedUploads
  } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Load all galleries and settings from Firestore on mount
  useEffect(() => {
    if (admin.isAuthenticated) {
      fetchAllGalleriesFromFirestore();
      fetchSettingsFromFirestore();
      cleanupInterruptedUploads();
    }
  }, [admin.isAuthenticated, fetchAllGalleriesFromFirestore, fetchSettingsFromFirestore, cleanupInterruptedUploads]);

  // Cross-tab sync: when the client submits in a separate tab,
  // localStorage changes — we re-hydrate the store so admin sees it immediately.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'diva-shots-studio-storage') {
        // Re-read the persisted store from localStorage
        useStore.persist.rehydrate();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Auth Guard
  if (!admin.isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }


  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Clients', path: '/admin/clients', icon: Users },
    { name: 'Packages', path: '/admin/packages', icon: Layers },
    { name: 'Galleries', path: '/admin/galleries', icon: ImageIcon },
    {
      name: 'Notifications',
      path: '/admin/notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined
    },
    { name: 'Settings', path: '/admin/settings', icon: SettingsIcon }
  ];

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white py-3 px-6 flex justify-between items-center shadow-md z-20">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Diva Shots Logo" className="h-8 object-contain" />
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-slate-300 hover:text-white focus:outline-none"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 bg-slate-900 text-white w-64 p-6 flex flex-col z-30 transition-transform duration-300 transform md:translate-x-0 md:static md:h-auto ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="hidden md:flex flex-col items-center mb-8 pb-6 border-b border-slate-800">
          <img src="/logo.png" alt="Diva Shots Logo" className="h-16 object-contain" />
          <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-widest mt-2 block">
            Studio Manager
          </span>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path === '/admin/dashboard' && location.pathname === '/admin');
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30 font-medium'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-brand-gold' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="bg-brand-gold text-slate-900 font-bold text-xs px-2 py-0.5 rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Admin Footer */}
        <div className="pt-6 border-t border-slate-800 mt-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="overflow-hidden">
              <p className="text-xs text-slate-400 truncate">Logged in as</p>
              <p className="text-sm font-semibold text-white truncate" title={admin.email}>
                {admin.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 py-2.5 px-4 rounded-xl border border-slate-700 hover:border-red-900/30 transition-all duration-200 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-10 max-w-7xl mx-auto w-full transition-all duration-300 overflow-y-auto pb-24 md:pb-10">
        {children}
      </main>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-10 md:hidden transition-opacity duration-300"
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 z-20 flex items-center justify-around pb-safe">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path === '/admin/dashboard' && location.pathname === '/admin');
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 px-3 flex-1 transition-colors ${
                isActive ? 'text-brand-gold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-bold uppercase tracking-wider">{item.name}</span>
              {item.badge !== undefined && (
                <span className="absolute top-1.5 right-2.5 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>      {/* Google Drive-like Floating Upload Panel */}
      <UploadManager />
    </div>
  );
};
