import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Client {
  id: string;
  name: string;
  website: string;
}

interface AppState {
  // Current client
  currentClient: Client | null;
  setCurrentClient: (client: Client | null) => void;

  // UI State
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    timestamp: number;
  }>;
  addNotification: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Current client
      currentClient: null,
      setCurrentClient: (client) => set({ currentClient: client }),

      // UI State
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Notifications
      notifications: [],
      addNotification: (type, message) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type,
              message,
              timestamp: Date.now(),
            },
          ],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'cold-outreach-storage',
      partialize: (state) => ({
        currentClient: state.currentClient,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

