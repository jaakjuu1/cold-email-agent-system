import { useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../store';
import { clsx } from 'clsx';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
};

const iconStyles = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-yellow-500',
};

export function Toast() {
  const notifications = useAppStore((state) => state.notifications);
  const removeNotification = useAppStore((state) => state.removeNotification);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    notifications.forEach((notification) => {
      if (!timersRef.current.has(notification.id)) {
        const timer = setTimeout(() => {
          removeNotification(notification.id);
          timersRef.current.delete(notification.id);
        }, 5000);
        timersRef.current.set(notification.id, timer);
      }
    });

    // Cleanup timers for removed notifications
    timersRef.current.forEach((timer, id) => {
      if (!notifications.find((n) => n.id === id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    });
  }, [notifications, removeNotification]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => {
        const Icon = icons[notification.type];
        return (
          <div
            key={notification.id}
            className={clsx(
              'flex items-start gap-3 p-4 rounded-lg border shadow-lg animate-fade-in',
              styles[notification.type]
            )}
            role="alert"
            aria-live="polite"
          >
            <Icon className={clsx('w-5 h-5 flex-shrink-0', iconStyles[notification.type])} />
            <p className="flex-1 text-sm">{notification.message}</p>
            <button
              onClick={() => removeNotification(notification.id)}
              className="p-1 hover:opacity-70 transition-opacity"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
