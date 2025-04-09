import React, { createContext, useState, useContext, useEffect } from "react";
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from "../hooks/useWebSocket";
import { fetchGridData } from "../services/api";

const CollectionContext = createContext(null);

export const useCollections = () => {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error("useCollections must be used within a CollectionProvider");
  }
  return context;
};

export const CollectionProvider = ({ children }) => {
  const {
    data: gridData,
    isLoading: isLoadingGrid,
    error: gridError,
  } = useQuery({
    queryKey: ['gridData'],
    queryFn: () => fetchGridData(),
    staleTime: 1000 * 60 * 1,
  });

  const [collections, setCollections] = useState([]);

  useEffect(() => {
    if (gridData?.collections) {
      setCollections(gridData.collections);
    }
  }, [gridData]);

  const { isConnected, lastMessage } = useWebSocket(setCollections);

  const value = {
    collections,
    setCollections,
    allProjectsList: gridData?.projects || [],
    isLoadingGrid,
    gridError,
    isConnected,
    lastMessage
  };

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}; 