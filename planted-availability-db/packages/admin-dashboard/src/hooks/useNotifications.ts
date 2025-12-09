import { useState, useEffect } from 'react';

export type NotificationType =
  | 'budget_warning'
  | 'budget_critical'
  | 'budget_exhausted'
  | 'discoveries_pending'
  | 'scraper_failed';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

// Mock notifications for demonstration
const generateMockNotifications = (): Notification[] => {
  const now = new Date();
  const mockData: Notification[] = [
    {
      id: '1',
      type: 'budget_critical',
      title: 'Budget Critical',
      message: 'API budget has reached 92% usage. Please review your spending.',
      timestamp: new Date(now.getTime() - 5 * 60000), // 5 minutes ago
      read: false,
    },
    {
      id: '2',
      type: 'discoveries_pending',
      title: 'New Discoveries',
      message: '12 new venues are pending review in the Discovery Review page.',
      timestamp: new Date(now.getTime() - 30 * 60000), // 30 minutes ago
      read: false,
    },
    {
      id: '3',
      type: 'scraper_failed',
      title: 'Scraper Failed',
      message: 'Uber Eats scraper failed: Rate limit exceeded',
      timestamp: new Date(now.getTime() - 2 * 60 * 60000), // 2 hours ago
      read: false,
    },
    {
      id: '4',
      type: 'budget_warning',
      title: 'Budget Warning',
      message: 'API budget has reached 85% usage this month.',
      timestamp: new Date(now.getTime() - 4 * 60 * 60000), // 4 hours ago
      read: true,
    },
  ];

  return mockData;
};

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
  });

  // Initialize with mock notifications
  useEffect(() => {
    const notifications = generateMockNotifications();
    setState({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  }, []);

  const markAsRead = (notificationId: string) => {
    setState((prev) => {
      const notifications = prev.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      return {
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      };
    });
  };

  const markAllAsRead = () => {
    setState((prev) => ({
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  };

  const clearAll = () => {
    setState({
      notifications: [],
      unreadCount: 0,
    });
  };

  const getUnreadCount = () => state.unreadCount;

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    getUnreadCount,
  };
}
