import { useContext } from "react";
import { CollectionContext } from "./CollectionContext"; // Импортируем сам контекст

export const useCollections = () => {
  const context = useContext(CollectionContext);
  if (!context) {
    throw new Error("useCollections must be used within a CollectionProvider");
  }
  return context;
};
