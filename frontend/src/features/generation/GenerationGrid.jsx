import React, { useState } from "react";
import axios from "axios";
import SelectionModal from "../selection/SelectionModal";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateBatch } from "../../services/api";

// Импорты react-bootstrap
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Table from "react-bootstrap/Table";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import Accordion from "react-bootstrap/Accordion";
import Badge from "react-bootstrap/Badge";
import Image from "react-bootstrap/Image";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Dropdown from "react-bootstrap/Dropdown";

// Импорты иконок
import {
  CheckCircleFill,
  XCircleFill,
  Search,
  ChevronDown,
  ChevronUp,
  CheckLg,
  ExclamationTriangleFill,
  SortDown,
  SortUp,
  FunnelFill,
  TagFill,
} from "react-bootstrap-icons";

import AddCollectionModal from "../collections/AddCollectionModal";
import GridCell from "./components/GridCell";
import GridControls from "./components/GridControls";
import GridHeader from "./components/GridHeader";
import GridRow from "./components/GridRow";
import { useGenerationGridData } from "./hooks/useGenerationGridData";
import { useCollectionActions } from "./hooks/useCollectionActions";
import { useCollections } from "../../context/CollectionContext";
import "./GenerationGrid.css";

const API_URL = "http://localhost:5001/api";

const GenerationGrid = () => {
  const { collections, setCollections, allProjectsList, isLoadingGrid, gridError } = useCollections();
  const queryClient = useQueryClient();

  // --- Используем хук для данных грида ---
  const {
    visibleColumnProjectIds,
    collectionTypes,
    sortConfig,
    searchTerm,
    advancedFilter,
    typeFilter,
    sortedAndFilteredCollections,
    visibleProjects,
    allColumnProjectsSelected,
    setSortConfig,
    setSearchTerm,
    setAdvancedFilter,
    setTypeFilter,
    handleColumnProjectSelectionChange,
    handleSelectAllColumnProjects,
  } = useGenerationGridData(collections, allProjectsList); // Передаем collections и allProjectsList

  const {
    fieldSaveStatus,
    handlePromptChange,
    handleAutoSaveCollectionField,
  } = useCollectionActions(setCollections);

  // --- Оставшиеся состояния и обработчики ---
  const [selectedCollectionIds, setSelectedCollectionIds] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState({ collectionId: null, projectId: null });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPositivePrompt, setShowPositivePrompt] = useState(true);
  const [showNegativePrompt, setShowNegativePrompt] = useState(true);
  const [showCollectionComment, setShowCollectionComment] = useState(false);
  const [projectsForGenerationIds, setProjectsForGenerationIds] = useState(new Set());

  // --- Мутация для запуска генерации --- 
  const { 
      mutate: generateBatchMutate, 
      isLoading: isSubmittingGenerations,
      error: generateError
  } = useMutation({
      mutationFn: generateBatch,
      onSuccess: (data) => {
          console.log("Generate batch response:", data);
          alert(`Задачи генерации отправлены (${data?.tasks_started?.length || 0} успешно). Проверьте статус в гриде.`);
          setSelectedCollectionIds(new Set());
      },
      onError: (err) => {
          console.error("Error calling generate-batch API:", err);
          alert(`Ошибка при отправке задач генерации: ${err.response?.data?.error || err.message}`);
      }
  });

  const handleGenerationProjectSelectionChange = (projectId, isChecked) => {
    setProjectsForGenerationIds((prev) => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  };
  const handleSelectAllGenerationProjects = (isChecked) => {
    if (isChecked) {
      setProjectsForGenerationIds(new Set(allProjectsList.map((p) => p.id)));
    } else {
      setProjectsForGenerationIds(new Set());
    }
  };
  const handleCollectionSelectionChange = (collectionId, isChecked) => {
    setSelectedCollectionIds((prev) => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(collectionId);
      } else {
        newSet.delete(collectionId);
      }
      return newSet;
    });
  };
  const handleSelectAllCollections = (isChecked) => {
    const currentVisibleIds = new Set(sortedAndFilteredCollections.map((c) => c.id));
    if (isChecked) {
      setSelectedCollectionIds((prev) => new Set([...prev, ...currentVisibleIds]));
    } else {
      setSelectedCollectionIds(
        (prev) => new Set([...prev].filter((id) => !currentVisibleIds.has(id)))
      );
    }
  };
  const handleGenerateSelected = () => {
    if (selectedCollectionIds.size === 0 || projectsForGenerationIds.size === 0) {
      alert("Пожалуйста, выберите хотя бы одну коллекцию и один проект для генерации...");
      return;
    }
    const pairsToGenerate = [];
    selectedCollectionIds.forEach((collectionId) => {
      const collection = collections.find((c) => c.id === collectionId);
      if (collection) {
        projectsForGenerationIds.forEach((projectId) => {
          pairsToGenerate.push({ project_id: projectId, collection_id: collectionId });
        });
      }
    });
    if (pairsToGenerate.length === 0) {
      alert("Нет подходящих пар проект-коллекция для запуска генерации.");
      return;
    }
    
    console.log("Calling generateBatch mutation with pairs:", pairsToGenerate);
    generateBatchMutate(pairsToGenerate);
  };
  const openSelectionModal = (collectionId, projectId) => {
    setModalContext({ collectionId, projectId });
    setIsModalOpen(true);
  };
  const closeSelectionModal = () => {
    setIsModalOpen(false);
    setModalContext({ collectionId: null, projectId: null });
  };
  const handleSelectionConfirmed = () => {
    console.log("Selection confirmed in modal...");
  };
  const renderFieldStatus = (collectionId, fieldType) => {
    const status = fieldSaveStatus[collectionId]?.[fieldType];
    if (!status) return null;
    if (status.saving) {
      return <Spinner animation="border" size="sm" variant="secondary" className="ms-1" title="Сохранение..." />;
    }
    if (status.error) {
      return <ExclamationTriangleFill className="text-danger ms-1" title={`Ошибка: ${status.error}`} />;
    }
    if (status.saved) {
      return <CheckLg className="text-success ms-1" title="Сохранено" />;
    }
    return null;
  };
  const handleCollectionAdded = () => {
  };

  const allGenerationProjectsSelected =
    allProjectsList.length > 0 && projectsForGenerationIds.size === allProjectsList.length;
  const shouldShowPromptColumn = showPositivePrompt || showNegativePrompt || showCollectionComment;
  const allVisibleCollectionsSelected =
    sortedAndFilteredCollections.length > 0 &&
    sortedAndFilteredCollections.every((c) => selectedCollectionIds.has(c.id));

  return (
    <>
      <GridControls
        allProjectsList={allProjectsList}
        projectsForGenerationIds={projectsForGenerationIds}
        allGenerationProjectsSelected={allGenerationProjectsSelected}
        handleGenerationProjectSelectionChange={handleGenerationProjectSelectionChange}
        handleSelectAllGenerationProjects={handleSelectAllGenerationProjects}
        visibleColumnProjectIds={visibleColumnProjectIds}
        allColumnProjectsSelected={allColumnProjectsSelected}
        handleColumnProjectSelectionChange={handleColumnProjectSelectionChange}
        handleSelectAllColumnProjects={handleSelectAllColumnProjects}
        showPositivePrompt={showPositivePrompt}
        setShowPositivePrompt={setShowPositivePrompt}
        showNegativePrompt={showNegativePrompt}
        setShowNegativePrompt={setShowNegativePrompt}
        showCollectionComment={showCollectionComment}
        setShowCollectionComment={setShowCollectionComment}
        sortConfig={sortConfig}
        setSortConfig={setSortConfig}
        advancedFilter={advancedFilter}
        setAdvancedFilter={setAdvancedFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        collectionTypes={collectionTypes}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        setShowAddModal={setShowAddModal}
        handleGenerateSelected={handleGenerateSelected}
        isSubmittingGenerations={isSubmittingGenerations}
        selectedCollectionIds={selectedCollectionIds}
      />

      {isLoadingGrid && (
        <div className="text-center p-5">
          <Spinner animation="border" /> Загрузка данных грида...
        </div>
      )}
      {gridError && <Alert variant="danger">Ошибка загрузки данных: {gridError.message}</Alert>}
      {generateError && <Alert variant="warning" className="mt-2">Ошибка запуска генерации: {generateError.message}</Alert>}
      {!isLoadingGrid && !gridError && (
        <Table bordered hover responsive className="generation-grid-table">
          <GridHeader
            allVisibleCollectionsSelected={allVisibleCollectionsSelected}
            handleSelectAllCollections={handleSelectAllCollections}
            sortedAndFilteredCollections={sortedAndFilteredCollections}
            visibleProjects={visibleProjects}
            shouldShowPromptColumn={shouldShowPromptColumn}
          />
          <tbody>
            {sortedAndFilteredCollections.map((collection) => (
              <GridRow
                key={collection.id}
                collection={collection}
                selectedCollectionIds={selectedCollectionIds}
                handleCollectionSelectionChange={handleCollectionSelectionChange}
                visibleProjects={visibleProjects}
                openSelectionModal={openSelectionModal}
                shouldShowPromptColumn={shouldShowPromptColumn}
                showPositivePrompt={showPositivePrompt}
                showNegativePrompt={showNegativePrompt}
                showCollectionComment={showCollectionComment}
                handlePromptChange={handlePromptChange}
                handleAutoSaveCollectionField={handleAutoSaveCollectionField}
                fieldSaveStatus={fieldSaveStatus}
                renderFieldStatus={renderFieldStatus}
                      />
                    ))}
            {sortedAndFilteredCollections.length === 0 && (
              <tr>
                <td
                  colSpan={2 + visibleProjects.length + (shouldShowPromptColumn ? 1 : 0)}
                  className="text-center text-muted"
                >
                  Нет коллекций, соответствующих фильтрам, или данные еще не загружены.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}

      <SelectionModal
        show={isModalOpen}
        onHide={closeSelectionModal}
        collectionId={modalContext.collectionId}
        projectId={modalContext.projectId}
        onSelectionConfirmed={handleSelectionConfirmed}
      />
      <AddCollectionModal
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        onSuccess={handleCollectionAdded}
      />
    </>
  );
};

export default GenerationGrid;
