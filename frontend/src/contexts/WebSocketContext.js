import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const WebSocketContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  // Pending subscriptions queued before the socket finished connecting.
  // We replay them once the socket is available so callers don't lose events.
  const pendingSubsRef = useRef([]);

  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[WS] connected', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.log('[WS] disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('reconnect_attempt', (n) => {
      // eslint-disable-next-line no-console
      console.log('[WS] reconnect attempt', n);
    });

    setSocket(newSocket);

    // Drain queued subscriptions
    if (pendingSubsRef.current.length) {
      pendingSubsRef.current.forEach(({ event, callback }) => {
        newSocket.on(event, callback);
      });
      pendingSubsRef.current = [];
    }

    return () => {
      try { newSocket.close(); } catch (e) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribe = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
    } else {
      // Queue until socket is ready, then attach.
      pendingSubsRef.current.push({ event, callback });
    }
  };

  const unsubscribe = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    } else {
      // Remove from pending queue if not yet attached.
      pendingSubsRef.current = pendingSubsRef.current.filter(
        (item) => !(item.event === event && item.callback === callback)
      );
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, connected, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};
