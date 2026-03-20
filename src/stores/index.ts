import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  image?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

interface NotificationState {
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: Date;
  }>;
  addNotification: (notification: any) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));

interface ParcelState {
  selectedParcel: any | null;
  trackingNumber: string;
  setSelectedParcel: (parcel: any | null) => void;
  setTrackingNumber: (trackingNumber: string) => void;
}

export const useParcelStore = create<ParcelState>((set) => ({
  selectedParcel: null,
  trackingNumber: '',
  setSelectedParcel: (parcel) => set({ selectedParcel: parcel }),
  setTrackingNumber: (trackingNumber) => set({ trackingNumber }),
}));
