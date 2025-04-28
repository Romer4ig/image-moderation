import React, { useState, useEffect } from "react";
// import axios from "axios"; <-- УДАЛИТЬ
import SelectionModal from "../selection/SelectionModal";
import { useMutation } from "@tanstack/react-query";
import { generateBatch } from "../../services/api";
import { useInView } from 'react-intersection-observer';
// import { useCollections } from "../../context/useCollections"; // Убираем
import { useWebSocketContext } from "../../context/WebSocketContext"; // Импортируем новый контекст

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
import "./GenerationGrid.css";

// const API_URL = "http://localhost:5001/api"; <-- УДАЛИТЬ

const GenerationGrid = () => {
  // --- Используем контекст WebSocket ---
  const { lastMessage } = useWebSocketContext();

  // --- Опции отображения грида с localStorage ---
  const [showPositivePrompt, setShowPositivePrompt] = useState(() => {
    const v = localStorage.getItem('gridShowPositivePrompt');
    return v !== null ? JSON.parse(v) : true;
  });
  const [showNegativePrompt, setShowNegativePrompt] = useState(() => {
    const v = localStorage.getItem('gridShowNegativePrompt');
    return v !== null ? JSON.parse(v) : true;
  });
  const [showCollectionComment, setShowCollectionComment] = useState(() => {
    const v = localStorage.getItem('gridShowCollectionComment');
    return v !== null ? JSON.parse(v) : false;
  });
  const [advancedFilter, setAdvancedFilter] = useState(() => {
    const v = localStorage.getItem('gridAdvancedFilter');
    return v !== null ? JSON.parse(v) : false;
  });
  const [typeFilter, setTypeFilter] = useState(() => {
    const v = localStorage.getItem('gridTypeFilter');
    return v !== null ? v : '';
  });
  const [sortConfig, setSortConfig] = useState(() => {
    const v = localStorage.getItem('gridSortConfig');
    return v !== null ? JSON.parse(v) : { key: 'created_at', direction: 'desc' };
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    const v = localStorage.getItem('gridSearchTerm');
    return v !== null ? v : '';
  });
  const [generationStatusFilter, setGenerationStatusFilter] = useState("all");

  useEffect(() => {
    localStorage.setItem('gridShowPositivePrompt', JSON.stringify(showPositivePrompt));
  }, [showPositivePrompt]);
  useEffect(() => {
    localStorage.setItem('gridShowNegativePrompt', JSON.stringify(showNegativePrompt));
  }, [showNegativePrompt]);
  useEffect(() => {
    localStorage.setItem('gridShowCollectionComment', JSON.stringify(showCollectionComment));
  }, [showCollectionComment]);
  useEffect(() => {
    localStorage.setItem('gridAdvancedFilter', JSON.stringify(advancedFilter));
  }, [advancedFilter]);
  useEffect(() => {
    localStorage.setItem('gridTypeFilter', typeFilter);
  }, [typeFilter]);
  useEffect(() => {
    localStorage.setItem('gridSortConfig', JSON.stringify(sortConfig));
  }, [sortConfig]);
  useEffect(() => {
    localStorage.setItem('gridSearchTerm', searchTerm);
  }, [searchTerm]);

  // --- Используем хук для данных грида --- 
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading, // Теперь это общий isLoading из хука
    gridError,
    refetchGridData,
    visibleColumnProjectIds,
    collectionTypes,
    sortedAndFilteredCollections, // Массив коллекций для отображения
    visibleProjects, // Видимые проекты для колонок
    allProjectsList, // Полный список проектов для контролов
    allColumnProjectsSelected,
    handleColumnProjectSelectionChange,
    handleSelectAllColumnProjects,
  } = useGenerationGridData( // Передаем только параметры фильтрации/сортировки
      sortConfig,
      searchTerm,
      advancedFilter,
      typeFilter,
      generationStatusFilter
      // isProjectsLoading больше не нужен, т.к. контекст убрали
  );

  // --- Обработка сообщений WebSocket из контекста ---
  useEffect(() => {
    if (lastMessage && lastMessage.data) {
        const message = lastMessage.data; // Достаем актуальные данные
        console.log("WebSocket message received in GenerationGrid (from Context):", message);
        // Проверяем тип сообщения и рефетчим данные, если нужно
        if (message.type === 'grid_cell_updated' || message.type === 'generation_status_changed') {
           console.log("Refetching grid data due to WebSocket message (from Context)...");
           refetchGridData(); 
        }
        // Можно добавить обработку других типов сообщений здесь
    }
  }, [lastMessage, refetchGridData]); // Зависимость от lastMessage и refetchGridData

  // --- Intersection Observer для Infinite Scroll ---
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: "200px",
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // --- Оставшиеся состояния и обработчики ---
  const [selectedCollectionIds, setSelectedCollectionIds] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState({ collectionId: null, projectId: null });
  const [showAddModal, setShowAddModal] = useState(false);
  const [projectsForGenerationIds, setProjectsForGenerationIds] = useState(new Set());

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
        newSet.add(collectionId); // Добавляем ID
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
      // Ищем коллекцию в АКТУАЛЬНОМ списке из useGenerationGridData
      const collection = sortedAndFilteredCollections.find((c) => String(c.id) === String(collectionId)); 
      if (collection) { 
        projectsForGenerationIds.forEach((projectId) => {
          pairsToGenerate.push({ project_id: projectId, collection_id: String(collection.id) }); // Передаем ID как строку
        });
      } else {
        console.warn(`Collection with ID ${collectionId} not found in current grid data (sortedAndFilteredCollections).`);
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
  const handleCollectionAdded = () => {
    if (typeof refetchGridData === 'function') {
      refetchGridData();
    }
  };

  const allGenerationProjectsSelected =
    allProjectsList.length > 0 && projectsForGenerationIds.size === allProjectsList.length;
  const shouldShowPromptColumn = showPositivePrompt || showNegativePrompt || showCollectionComment;
  const allVisibleCollectionsSelected =
    sortedAndFilteredCollections.length > 0 &&
    sortedAndFilteredCollections.every((c) => selectedCollectionIds.has(c.id));

  // --- Мутация для запуска генерации ---
  const {
    mutate: generateBatchMutate,
    isLoading: isSubmittingGenerations,
    error: generateError,
  } = useMutation({
    mutationFn: generateBatch,
    onSuccess: (data) => {
      console.log("Generate batch response:", data);
      setSelectedCollectionIds(new Set());
      if (typeof refetchGridData === 'function') {
        refetchGridData();
      }
    },
    onError: (err) => {
      console.error("Error calling generate-batch API:", err);
      alert(`Ошибка при отправке задач генерации: ${err.response?.data?.error || err.message}`);
    },
  });

  // Используем sortedAndFilteredCollections из хука
  const filteredCollections = sortedAndFilteredCollections;

  return (
    <>
      <Container fluid className="p-4">
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
        generationStatusFilter={generationStatusFilter}
        setGenerationStatusFilter={setGenerationStatusFilter}
        visibleProjects={visibleProjects}
        onImportSuccess={refetchGridData}
      />

      {(isLoading && !isFetchingNextPage) && (
        <div className="text-center p-5">
          <Spinner animation="border" /> Загрузка данных грида...
        </div>
      )}
      {gridError && <Alert variant="danger">Ошибка загрузки данных: {gridError.message}</Alert>}
      {generateError && (
        <Alert variant="warning" className="mt-2">
          Ошибка запуска генерации: {generateError.message}
        </Alert>
      )}
      {!isLoading && !gridError && (
        <Table
          className="generation-grid-table mt-3"
          bordered
          hover
          responsive
          size="sm"
        >
          <GridHeader
            allVisibleCollectionsSelected={allVisibleCollectionsSelected}
            handleSelectAllCollections={handleSelectAllCollections}
            sortedAndFilteredCollections={filteredCollections}
            visibleProjects={visibleProjects}
            shouldShowPromptColumn={shouldShowPromptColumn}
          />
          <tbody>
            {filteredCollections.length > 0 ? (
              filteredCollections.map((collection) => (
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
                  generationStatusFilter={generationStatusFilter}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={
                    1 + visibleProjects.length + (shouldShowPromptColumn ? 1 : 0)
                  }
                  className="text-center text-muted p-5"
                >
                  Нет сборников для отображения по заданным фильтрам.
                </td>
              </tr>
            )}

            <tr>
              <td colSpan={1 + visibleProjects.length + (shouldShowPromptColumn ? 1 : 0)} style={{ padding: 0 }}>
                <div 
                  ref={loadMoreRef} 
                  style={{ height: '1px', background: 'red', width: '100%' }}
                  aria-hidden="true"
                />
              </td>
            </tr>

            {isFetchingNextPage && (
              <tr>
                <td colSpan={1 + visibleProjects.length + (shouldShowPromptColumn ? 1 : 0)} className="text-center p-3">
                  <Spinner animation="border" size="sm" /> Загрузка следующих...
                </td>
              </tr>
            )}
            {!hasNextPage && filteredCollections.length > 0 && (
              <tr>
                <td colSpan={1 + visibleProjects.length + (shouldShowPromptColumn ? 1 : 0)} className="text-center text-muted p-3">
                  Больше нет данных для загрузки.
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
      </Container>
    </>
  );
};

export default GenerationGrid;
