import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/admin/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { Clients } from './pages/admin/Clients';
import { Packages } from './pages/admin/Packages';
import { Galleries } from './pages/admin/Galleries';
import { Notifications } from './pages/admin/Notifications';
import { Settings } from './pages/admin/Settings';
import { GallerySelection } from './pages/client/GallerySelection';
import { AdminLayout } from './components/AdminLayout';
import { useStore } from './store/useStore';

/* ── Auth guards ──────────────────────────────────── */

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin } = useStore();
  if (!admin.isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Client Gallery Route */}
        <Route path="/gallery/:id/:slug?" element={<GallerySelection />} />

        {/* ── Admin ──────────────────────────────────── */}
        <Route path="/admin/login" element={<Login />} />

        <Route path="/admin" element={<AdminGuard><AdminLayout><Dashboard /></AdminLayout></AdminGuard>} />
        <Route path="/admin/dashboard" element={<AdminGuard><AdminLayout><Dashboard /></AdminLayout></AdminGuard>} />
        <Route path="/admin/clients" element={<AdminGuard><AdminLayout><Clients /></AdminLayout></AdminGuard>} />
        <Route path="/admin/packages" element={<AdminGuard><AdminLayout><Packages /></AdminLayout></AdminGuard>} />
        <Route path="/admin/galleries" element={<AdminGuard><AdminLayout><Galleries /></AdminLayout></AdminGuard>} />
        <Route path="/admin/notifications" element={<AdminGuard><AdminLayout><Notifications /></AdminLayout></AdminGuard>} />
        <Route path="/admin/settings" element={<AdminGuard><AdminLayout><Settings /></AdminLayout></AdminGuard>} />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
