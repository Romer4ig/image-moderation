import React, { createContext, useContext, useState, useEffect } from "react";
import { useSelectionData } from "../hooks/useSelectionData";
import { useAttemptSelection } from "../hooks/useAttemptSelection";

const SelectionContext = createContext(null);

export const useSelectionContext = () => {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error(
      "useSelectionContext must be used within a SelectionProvider"
    );
  }
  return context;
};

export const SelectionProvider = ({ children, show, onHide, collectionId, projectId: initialProjectId, onSelectionConfirmed }) => {
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const [pendingSelections, setPendingSelections] = useState({});
  
  useEffect(() => {
    if (show) {
      setActiveProjectId(initialProjectId);
      setPendingSelections({});
    }
  }, [show, initialProjectId]);

  const {
    modalData,
    loading,
    error,
    topRowItems,
    selectedProjectIds,
    displayedAttempts,
    loadingAttempts,
    handleCheckboxChange,
    persistedSelectedFileId,
  } = useSelectionData(show, collectionId, initialProjectId);

  const {
    selectedAttempt,
    isSubmitting,
    handleAttemptClick,
    handleConfirmSelection,
  } = useAttemptSelection(
    collectionId,
    activeProjectId,
    initialProjectId,
    pendingSelections,
    setPendingSelections,
    onSelectionConfirmed
  );

  const handleProjectClick = (projectId) => {
    setActiveProjectId(projectId);
  };

  const value = {
    // Modal state
    onHide,
    // from useSelectionData
    modalData,
    loading,
    error,
    topRowItems,
    selectedProjectIds,
    displayedAttempts,
    loadingAttempts,
    handleCheckboxChange,
    persistedSelectedFileId,
    // from useAttemptSelection
    selectedAttempt,
    isSubmitting,
    handleAttemptClick,
    handleConfirmSelection,
    // from local state
    activeProjectId,
    handleProjectClick,
    pendingSelections,
  };

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}; 