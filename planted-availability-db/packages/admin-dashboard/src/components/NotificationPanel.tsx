import { useEffect, useRef } from 'react';
import { Notification, NotificationType } from '../hooks/useNotifications';

interface NotificationPanelProps {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  budget_warning: '⚠️',
  budget_critical: '🚨',
  budget_exhausted: '🛑',
  discoveries_pending: '🔍',
  scraper_failed: '❌',
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  budget_warning: 'var(--warning)',
  budget_critical: 'var(--error)',
  budget_exhausted: 'var(--error)',
  discoveries_pending: 'var(--primary)',
  scraper_failed: 'var(--error)',
};

function NotificationPanel({
  notifications,
  isOpen,
  onClose,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Check if the click was on the bell button
        const bellButton = document.querySelector('.notification-bell');
        if (bellButton && bellButton.contains(event.target as Node)) {
          return; // Let the bell button handle the click
        }
        onClose();
      }
    };

    // Add a small delay to prevent immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const hasUnread = unreadNotifications.length > 0;

  return (
    <div className="notification-panel" ref={panelRef}>
      <div className="notification-panel-header">
        <h3>Notifications</h3>
        <div className="notification-panel-actions">
          {hasUnread && (
            <button
              className="notification-action-btn"
              onClick={onMarkAllAsRead}
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className="notification-action-btn"
              onClick={onClearAll}
              title="Clear all notifications"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="notification-panel-body">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <p>No notifications</p>
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                onClick={() => !notification.read && onMarkAsRead(notification.id)}
              >
                <div
                  className="notification-icon"
                  style={{
                    backgroundColor: NOTIFICATION_COLORS[notification.type],
                  }}
                >
                  <span>{NOTIFICATION_ICONS[notification.type]}</span>
                </div>
                <div className="notification-content">
                  <div className="notification-header">
                    <h4>{notification.title}</h4>
                    <span className="notification-timestamp">
                      {formatTimestamp(notification.timestamp)}
                    </span>
                  </div>
                  <p className="notification-message">{notification.message}</p>
                </div>
                {!notification.read && <div className="notification-unread-dot" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationPanel;
