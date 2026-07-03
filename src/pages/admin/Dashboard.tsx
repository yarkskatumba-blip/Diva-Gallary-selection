import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Users,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  Coins,
  ArrowRight,
  TrendingUp,
  Bell
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { galleries, clients, notifications, settings } = useStore();
  const navigate = useNavigate();

  // Computations
  const totalClients = clients.length;
  const activeGalleries = galleries.filter((g) => g.status !== 'Closed').length;
  const pendingSelections = galleries.filter((g) => g.status === 'Client Selecting' || g.status === 'Link Generated' || g.status === 'Reopened').length;
  const completedSelections = galleries.filter((g) => g.status === 'Submitted').length;
  const totalExtraRevenue = galleries.reduce((acc, g) => acc + g.extraAmountDue, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency || 'UGX',
      minimumFractionDigits: 0
    }).format(val).replace('$', 'UGX ');
  };

  const statCards = [
    {
      title: 'Total Clients',
      value: totalClients,
      description: 'Registered client profiles',
      icon: Users,
      color: 'bg-blue-500 text-white',
      link: '/admin/clients'
    },
    {
      title: 'Active Galleries',
      value: activeGalleries,
      description: 'Galleries currently open',
      icon: ImageIcon,
      color: 'bg-purple-500 text-white',
      link: '/admin/galleries'
    },
    {
      title: 'Pending Selections',
      value: pendingSelections,
      description: 'Awaiting client response',
      icon: Clock,
      color: 'bg-amber-500 text-white',
      link: '/admin/galleries'
    },
    {
      title: 'Completed Selections',
      value: completedSelections,
      description: 'Selections submitted',
      icon: CheckCircle,
      color: 'bg-emerald-500 text-white',
      link: '/admin/galleries'
    },
    {
      title: 'Total Extra Revenue',
      value: formatCurrency(totalExtraRevenue),
      description: 'Revenue from extra selections',
      icon: Coins,
      color: 'bg-pink-500 text-white',
      link: '/admin/galleries'
    }
  ];

  // Sort: submitted galleries first, then by recency (store prepends newest)
  const recentGalleries = [...galleries]
    .sort((a, b) => {
      if (a.status === 'Submitted' && b.status !== 'Submitted') return -1;
      if (a.status !== 'Submitted' && b.status === 'Submitted') return 1;
      return 0;
    })
    .slice(0, 5);

  const unreadCount = notifications.filter(n => !n.read).length;
  // Show newest 5 notifications, unread first
  const recentNotifs = [...notifications]
    .sort((a, b) => {
      if (!a.read && b.read) return -1;
      if (a.read && !b.read) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-blue/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <h1 className="font-display font-extrabold text-3xl tracking-tight text-white mb-2 leading-none">
            Welcome back, Diva Shots Staff
          </h1>
          <p className="text-slate-400 font-medium text-sm">
            {settings.slogan || 'Capturing Moments, Creating Memories'} — Monitor client photo selection states from your dashboard.
          </p>
        </div>
        <div className="flex gap-3 relative z-10">
          <button
            onClick={() => navigate('/admin/galleries')}
            className="bg-brand-blue hover:bg-brand-blue-dark text-white font-semibold py-3 px-5 rounded-xl border border-brand-blue transition-all duration-200 text-sm shadow-lg shadow-brand-blue/20"
          >
            Manage Galleries
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              to={card.link}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2.5 rounded-xl ${card.color} shadow-sm group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-none">
                  {card.value}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">{card.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Galleries */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-800 m-0">Recent Galleries</h2>
              <p className="text-xs text-slate-400 font-medium">Quick state checks of last created galleries</p>
            </div>
            <Link
              to="/admin/galleries"
              className="text-brand-blue hover:text-brand-blue-dark font-semibold text-xs flex items-center gap-1 group"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase">
                  <th className="py-3 px-2">Client</th>
                  <th className="py-3 px-2">Collection Title</th>
                  <th className="py-3 px-2">Photos Selected</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Extra Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {recentGalleries.map((g) => (
                  <tr key={g.id} className={`hover:bg-slate-50/50 transition-colors relative ${
                    g.status === 'Submitted' ? 'bg-emerald-50/30' : ''
                  }`}>
                    <td className="py-3.5 px-2 relative">
                      {g.status === 'Submitted' && (
                        <div className="absolute left-0 inset-y-2 w-0.5 bg-emerald-500 rounded-r" />
                      )}
                      <div className="font-semibold text-slate-800">{g.client.name}</div>
                      <div className="text-[11px] text-slate-400">{g.client.email}</div>
                    </td>
                    <td className="py-3.5 px-2 font-medium text-slate-600">{g.collectionTitle || 'Untitled'}</td>
                    <td className="py-3.5 px-2">
                      <span className="font-semibold text-slate-800">{g.selectedCount}</span>
                      <span className="text-slate-400"> / {g.includedPhotos}</span>
                    </td>
                    <td className="py-3.5 px-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          g.status === 'Submitted'
                            ? 'bg-emerald-50 text-emerald-700'
                            : g.status === 'Client Selecting'
                            ? 'bg-blue-50 text-brand-blue'
                            : g.status === 'Reopened'
                            ? 'bg-purple-50 text-purple-700'
                            : g.status === 'Closed'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-slate-50 text-slate-500'
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-right font-bold text-slate-800">
                      {formatCurrency(g.extraAmountDue)}
                    </td>
                  </tr>
                ))}
                {recentGalleries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No galleries created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notifications & Settings Summary */}
        <div className="space-y-6">
          {/* Notifications Center */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-gold" />
                <h2 className="text-lg font-bold text-slate-800 m-0">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </div>
              <Link
                to="/admin/notifications"
                className="text-brand-blue hover:text-brand-blue-dark font-semibold text-xs flex items-center gap-1 group"
              >
                <span>View Center</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentNotifs.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors relative ${
                    !notif.read
                      ? 'bg-brand-blue/5 border-brand-blue/20'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  {/* Unread left accent */}
                  {!notif.read && (
                    <div className="absolute left-0 inset-y-3 w-0.5 bg-brand-blue rounded-r" />
                  )}
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      notif.type === 'success'
                        ? 'bg-emerald-500'
                        : notif.type === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-brand-blue'
                    }`}
                  />
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${
                      !notif.read ? 'text-slate-800 font-semibold' : 'text-slate-600 font-medium'
                    }`}>
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!notif.read && (
                        <span className="text-[9px] font-bold uppercase text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {recentNotifs.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">No new notifications.</p>
              )}
            </div>
          </div>

          {/* Quick Stats Representation */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-800 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-gold/10 rounded-full blur-2xl" />
            <div className="relative z-10 flex items-center gap-2 text-brand-gold">
              <TrendingUp className="w-5 h-5" />
              <span className="text-xs uppercase font-extrabold tracking-wider">Revenue Stream</span>
            </div>
            <div className="relative z-10">
              <p className="text-2xl font-extrabold tracking-tight text-white m-0">
                {formatCurrency(totalExtraRevenue)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Generated from client-selected photographs exceeding package limits.
              </p>
            </div>
            <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center text-xs">
              <span className="text-slate-400">Default rate:</span>
              <span className="font-semibold text-brand-gold">
                {formatCurrency(settings.defaultExtraPrice)}/extra
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
