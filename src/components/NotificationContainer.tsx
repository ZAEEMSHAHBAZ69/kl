import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Notification, { NotificationType } from './Notification';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (type: NotificationType, title: string, message?: string, duration?: number) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showWarning: (title: string, message?: string) => void;
  showInfo: (title: string, message?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const showNotification = useCallback((
    type: NotificationType,
    title: string,
    message?: string,
    duration: number = 5000
  ) => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, type, title, message, duration }]);
  }, []);

  const showSuccess = useCallback((title: string, message?: string) => {
    showNotification('success', title, message);
  }, [showNotification]);

  const showError = useCallback((title: string, message?: string) => {
    showNotification('error', title, message, 7000);
  }, [showNotification]);

  const showWarning = useCallback((title: string, message?: string) => {
    showNotification('warning', title, message);
  }, [showNotification]);

  const showInfo = useCallback((title: string, message?: string) => {
    showNotification('info', title, message);
  }, [showNotification]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{
      showNotification,
      showSuccess,
      showError,
      showWarning,
      showInfo
    }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            type={notification.type}
            title={notification.title}
            message={notification.message}
            duration={notification.duration}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
