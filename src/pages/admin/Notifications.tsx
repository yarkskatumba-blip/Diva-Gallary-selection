import React from 'react';
import { useStore } from '../../store/useStore';
import { Bell, Trash2, Check, Clock, AlertTriangle, CheckCircle, CheckCheck } from 'lucide-react';

export const Notifications: React.FC = () => {
  const { notifications, markNotificationAsRead, clearAllNotifications } = useStore();

  const handleMarkAllRead = () => {
    notifications.forEach((n) => {
      if (!n.read) markNotificationAsRead(n.id);
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default:
        return <Bell className="w-5 h-5 text-brand-blue" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h1 className="font-display font-extrabold text-2xl tracking-tight text-slate-800 m-0 leading-none">
            Notification Center
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Monitor real-time updates of client selection confirmations and billing.
          </p>
        </div>
        <div className="flex gap-2.5 shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="bg-white hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-xl border border-slate-200 text-xs flex items-center gap-1.5 transition-colors shadow-sm active:scale-[0.98]"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAllNotifications}
              className="bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 px-4 rounded-xl border border-red-100 text-xs flex items-center gap-1.5 transition-colors shadow-sm active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4 max-w-3xl">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            onClick={() => !notif.read && markNotificationAsRead(notif.id)}
            className={`p-4 rounded-2xl border flex items-start gap-4 transition-all duration-200 relative group cursor-pointer ${
              !notif.read
                ? 'bg-white border-brand-blue shadow-sm hover:shadow'
                : 'bg-slate-50/50 border-slate-100'
            }`}
          >
            {/* Overage status indicator block */}
            {!notif.read && (
              <div className="absolute left-0 inset-y-4 w-1 bg-brand-blue rounded-r" />
            )}

            <div className="p-2 bg-slate-100 rounded-xl group-hover:scale-105 transition-transform shrink-0">
              {getIcon(notif.type)}
            </div>

            <div className="flex-1 space-y-1">
              <p
                className={`text-sm leading-relaxed ${
                  !notif.read ? 'text-slate-800 font-semibold' : 'text-slate-600 font-medium'
                }`}
              >
                {notif.message}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase">
                <Clock className="w-3 h-3" />
                <span>
                  {new Date(notif.createdAt).toLocaleDateString()} at{' '}
                  {new Date(notif.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            {!notif.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  markNotificationAsRead(notif.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all shrink-0"
                title="Mark as read"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {notifications.length === 0 && (
          <div className="bg-slate-50 py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-medium">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <span>No notifications yet. Activity will show up here.</span>
          </div>
        )}
      </div>
    </div>
  );
};
