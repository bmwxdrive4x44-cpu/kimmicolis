import { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    // Événements de suivi de colis
    newSocket.on('colis-status-update', (data) => {
      console.log('Colis status update:', data);
      // Dispatch custom event for components to listen
      window.dispatchEvent(new CustomEvent('colis-status-update', { detail: data }));
    });

    // Nouvelles missions disponibles
    newSocket.on('nouvelle-mission', (data) => {
      console.log('Nouvelle mission disponible:', data);
      window.dispatchEvent(new CustomEvent('nouvelle-mission', { detail: data }));
    });

    // Notification pour relais
    newSocket.on('nouveau-colis-relais', (data) => {
      console.log('Nouveau colis au relais:', data);
      window.dispatchEvent(new CustomEvent('nouveau-colis-relais', { detail: data }));
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const subscribeToColis = (colisId) => {
    if (socket) {
      socket.emit('subscribe-colis', { colisId });
    }
  };

  const unsubscribeFromColis = (colisId) => {
    if (socket) {
      socket.emit('unsubscribe-colis', { colisId });
    }
  };

  const value = {
    socket,
    connected,
    subscribeToColis,
    unsubscribeFromColis,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketContext;
