import React, { createContext, useState /* убираем useEffect */ } from "react";
// import { useQuery } from "@tanstack/react-query"; // Убираем
import { useWebSocket } from "../hooks/useWebSocket";
// import { fetchGridData } from "../services/api"; // Убираем

// Экспортируем контекст для использования в useCollections.js
export const CollectionContext = createContext(null);

export const CollectionProvider = ({ children }) => {
  // --- Удаляем useQuery для gridData --- 
  // const {
  //   data: gridData,
  //   isLoading: isLoadingGrid,
  //   error: gridError,
  // } = useQuery(...);

  // --- Удаляем состояние и useEffect, связанные с useQuery --- 
  // const [collectionsArray, setCollectionsArray] = useState([]);
  // useEffect(() => {
  //   ...
  // }, [gridData]);

  // Оставляем только WebSocket, если он нужен. 
  // Если WebSocket тоже обновляет коллекции, ему нужен другой источник данных или механизм.
  // Пока предполагаем, что WebSocket не используется или будет переделан.
  // const { isConnected, lastMessage } = useWebSocket(/* ??? */); 
  // УБИРАЕМ WebSocket ПОКА, чтобы не было ошибок

  // Контекст теперь предоставляет минимум - можно удалить, если не нужен WebSocket
  const value = {
    // collections: [], // Больше не предоставляем коллекции
    // setCollections: () => {}, // Больше не предоставляем сеттер
    // allProjectsList: [], // Больше не предоставляем проекты
    // isLoadingGrid: false, // Статусы загрузки теперь в useGenerationGridData
    // gridError: null,
    // isConnected: false, // Убрали WebSocket
    // lastMessage: null,
  };
  
  // Если контекст стал пустым, можно его вообще удалить и использовать 
  // useGenerationGridData напрямую во всех компонентах, где он нужен.
  // Но пока оставим Provider с пустым value.

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
};
