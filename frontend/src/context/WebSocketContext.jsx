import React, { createContext, useState, useEffect, useContext, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = "http://localhost:5001"; // Убедись, что URL верный
const WebSocketContext = createContext(null);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

// Компонент-провайдер
export const WebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null); // Используем useRef для хранения экземпляра сокета

  useEffect(() => {
    // Предотвращаем множественные подключения
    if (socketRef.current) {
      return;
    }

    console.log("WebSocketProvider: Connecting to Socket.IO...");
    // Сохраняем экземпляр в ref
    socketRef.current = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      transports: ["websocket"], // Предпочитаем WebSocket
    });

    const socket = socketRef.current; // Локальная переменная для удобства

    socket.on("connect", () => {
      console.log("WebSocketProvider: Socket.IO Connected!", socket.id);
      setIsConnected(true);
    });

    socket.on("disconnect", (reason) => {
      console.log("WebSocketProvider: Socket.IO Disconnected.", reason);
      setIsConnected(false);
      // Можно добавить логику переподключения при определенных причинах
      if (reason === 'io server disconnect') {
        // Попытка переподключения вручную, если сервер разорвал соединение
         setTimeout(() => socket.connect(), 5000); 
      }
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocketProvider: Socket.IO Connection Error:", error);
      setIsConnected(false);
    });

    // Общий обработчик сообщений, обновляет lastMessage в контексте
    socket.on("message", (data) => {
        console.log("WebSocketProvider: Raw message received:", data)
        setLastMessage({ data, timestamp: Date.now() }); // Добавляем timestamp, чтобы useEffect срабатывал
    });

    // Функция очистки при размонтировании провайдера
    return () => {
      console.log("WebSocketProvider: Cleaning up WebSocket connection.");
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null; // Очищаем ref
      }
      setIsConnected(false); // Устанавливаем статус в false при очистке
    };
  }, []); // Пустой массив зависимостей гарантирует выполнение только один раз при монтировании

  // Функция для отправки сообщений (если понадобится)
  const sendMessage = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('WebSocket is not connected. Cannot send message.');
    }
  }, []);

  // Значение, предоставляемое контекстом
  const contextValue = {
    isConnected,
    lastMessage,
    sendMessage, // Добавляем функцию отправки
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}; 