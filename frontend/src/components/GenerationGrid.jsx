import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios'; // Импортируем axios
import SelectionModal from './SelectionModal'; // Импортируем модалку
// Убираем импорт старого CSS, если он не нужен для кастомных стилей
// import './GenerationGrid.css'; 

// Импорты react-bootstrap
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Accordion from 'react-bootstrap/Accordion';
import Badge from 'react-bootstrap/Badge';
import Image from 'react-bootstrap/Image';
import Spinner from 'react-bootstrap/Spinner'; // Для индикатора загрузки
import Alert from 'react-bootstrap/Alert';
import Dropdown from 'react-bootstrap/Dropdown'; // Добавляем Dropdown

// Импорты иконок (примеры, нужно добавить нужные)
import { CheckCircleFill, XCircleFill, Search, ChevronDown, ChevronUp, CheckLg, ExclamationTriangleFill, SortDown, SortUp, FunnelFill, TagFill } from 'react-bootstrap-icons';

// Импортируем новое модальное окно
import AddCollectionModal from './AddCollectionModal';

const API_URL = 'http://localhost:5001/api'; // Базовый URL API

// Компонент для отображения ячейки грида
const GridCell = ({ cellData, onClick }) => {

  // Объявляем переменные здесь, чтобы они были доступны во всех ветках
  let content = null;
  let cellClass = "grid-cell align-middle"; // Базовый класс
  let backgroundClass = "";
  let isClickable = false;

  if (!cellData) {
    // Используем `text-muted` для пустого состояния
    content = "-";
    cellClass = "text-center text-muted align-middle"; // Переопределяем для пустого
  } else {
      // Определяем кликабельность
      isClickable = cellData.status === 'generated_not_selected' || cellData.status === 'selected';
      // Базовый класс для НЕпустой ячейки уже задан выше, добавляем модификаторы
      if (isClickable) {
        cellClass += " clickable"; 
      }
      
      // ... (switch cellData.status для определения content и backgroundClass) ...
      switch (cellData.status) {
        case 'not_generated':
          content = <span className="text-white small">Не сгенерировано</span>; 
          backgroundClass = "cell-not-generated"; // Кастомный класс
          break;
        case 'queued':
          content = <div className="text-center"><Spinner animation="border" size="sm" /><br/><small>В очереди...</small></div>; 
          backgroundClass = "bg-warning bg-opacity-25"; 
          break;
        case 'error':
          content = <span className="text-danger small" title={cellData.error_message || 'Неизвестная ошибка'}><XCircleFill className="me-1"/> Ошибка</span>; 
          cellClass += " error"; 
          backgroundClass = "bg-danger bg-opacity-25"; // Оставляем красный
          break;
        case 'generated_not_selected': 
            // Если статус такой, значит генерация есть, но не выбрана.
            content = (
                <div className="text-center">
                    <span className="text-white small d-block">Сгенерировано</span>
                    <span className="text-white small d-block">Не выбрано</span>
                </div>
            );
            backgroundClass = "cell-generated-not-selected"; 
            // cellClass остается базовым + clickable
            break;
        case 'selected':
          if (cellData.file_url) {
            content = <Image src={cellData.file_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={`Gen ${cellData.generation_id}`} />; 
          } else {
             // Логика ошибки: Убираем фон, оставляем красный текст
            content = <span className="text-danger small"><XCircleFill className="me-1"/> Нет файла</span>;
            cellClass += " error";
            backgroundClass = ""; // Убираем фон
          }
          // Класс для рамки добавляется только здесь
          cellClass += " cell-selected"; 
          break;
        default:
          content = <span className="text-secondary small">Неизвестный статус</span>;
          cellClass += " unknown";
          backgroundClass = "bg-secondary bg-opacity-10";
      }
  }

  const handleClick = () => {
    if (onClick && isClickable) {
      onClick();
    }
  };

  // Применяем фиксированный размер и flex-центровку к <td>
  return (
    <td 
      className={`${backgroundClass} p-0 position-relative`} // Добавляем relative для позиционирования статуса
      style={{ width: '150px', height: '150px' }} // Фиксированный размер
      onClick={handleClick}
    >
      {/* Внутренний div для контента с flex-центровкой */} 
      <div 
         className={`d-flex align-items-center justify-content-center w-100 h-100 ${cellClass}`}
         style={{ cursor: isClickable ? 'pointer' : 'default' }} // Курсор в зависимости от кликабельности
       >
         {content} 
      </div>
      {/* Отображение статуса "Выбрано" поверх ячейки */} 
      {cellData?.status === 'selected' && (
          <CheckCircleFill 
              className="position-absolute text-success bg-white rounded-circle p-1" 
              style={{ top: '5px', right: '5px', fontSize: '1.2rem' }} 
              title="Выбрано"
           />
      )}
    </td>
  );
};

const GenerationGrid = ({ 
    collections, 
    setCollections, 
    gridLoading, 
    setGridLoading, 
    gridError, 
    setGridError 
}) => {
  // --- Основные Состояния --- 
  const [projects, setProjects] = useState([]); 
  // Переименовываем для ясности - это ID проектов для ВИДИМЫХ КОЛОНОК
  const [visibleColumnProjectIds, setVisibleColumnProjectIds] = useState(new Set()); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedCollectionIds, setSelectedCollectionIds] = useState(new Set());
  const [isSubmittingGenerations, setIsSubmittingGenerations] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState({ collectionId: null, projectId: null });
  const [showAddModal, setShowAddModal] = useState(false);
  
  // --- Состояния Отображения --- 
  const [showPositivePrompt, setShowPositivePrompt] = useState(true); 
  const [showNegativePrompt, setShowNegativePrompt] = useState(true);
  const [showCollectionComment, setShowCollectionComment] = useState(false);
  
  // --- Состояния Автосохранения --- 
  const [fieldSaveStatus, setFieldSaveStatus] = useState({}); 
  const saveTimersRef = useRef({});

  // --- Состояния для Сортировки и Фильтрации ---
  const [sortConfig, setSortConfig] = useState({ key: 'last_generation_at', direction: 'descending' });
  const [advancedFilter, setAdvancedFilter] = useState('all'); 
  const [typeFilter, setTypeFilter] = useState('all'); 
  const [collectionTypes, setCollectionTypes] = useState([]);

  // --- НОВОЕ Состояние для выбора проектов ДЛЯ ГЕНЕРАЦИИ --- 
  const [projectsForGenerationIds, setProjectsForGenerationIds] = useState(new Set());

  // --- Загрузка Данных --- 
  const fetchGridData = useCallback(async () => {
    setGridLoading(true);
    setGridError(null);
    try {
      const response = await axios.get(`${API_URL}/grid-data`);
      const fetchedProjects = response.data.projects || [];
      const fetchedCollections = response.data.collections || [];
      
      setProjects(fetchedProjects);
      setCollections(fetchedCollections); 
      
      // Инициализация видимых КОЛОНОК (если нужно)
      setVisibleColumnProjectIds(prev => prev.size === 0 ? new Set(fetchedProjects.map(p => p.id)) : prev);
      // Инициализация проектов ДЛЯ ГЕНЕРАЦИИ (например, все по умолчанию? или пустое?)
      // Оставим пустым по умолчанию
      // setProjectsForGenerationIds(new Set(fetchedProjects.map(p => p.id)));
      
      const uniqueTypes = [...new Set(fetchedCollections.map(c => c.type).filter(Boolean))].sort();
      setCollectionTypes(uniqueTypes);
      
      setFieldSaveStatus({});
    } catch (err) {
      console.error("Error fetching grid data:", err);
      setGridError("Не удалось загрузить данные для грида.");
      setProjects([]);
      setCollections([]);
      setCollectionTypes([]);
    } finally {
      setGridLoading(false);
    }
   }, [setCollections, setGridError, setGridLoading]); // Убрали setVisibleColumnProjectIds отсюда

  useEffect(() => {
    setGridLoading(true);
    fetchGridData();
    return () => {
        Object.values(saveTimersRef.current).forEach(clearTimeout);
    };
  }, [fetchGridData, setGridLoading]);

  // --- Обработчики --- 
  if (gridLoading) {
    return <div className="text-center p-5"><Spinner animation="border" /> Загрузка...</div>;
  }
  if (gridError) {
    return <div className="alert alert-danger">{gridError}</div>;
  }

  // Обработчик для чекбоксов ВИДИМОСТИ КОЛОНОК
  const handleColumnProjectSelectionChange = (projectId, isChecked) => {
    setVisibleColumnProjectIds(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  };
  // "Выбрать все" для ВИДИМОСТИ КОЛОНОК
  const handleSelectAllColumnProjects = (isChecked) => {
    if (isChecked) {
        setVisibleColumnProjectIds(new Set(projects.map(p => p.id)));
    } else {
        setVisibleColumnProjectIds(new Set());
    }
  };

  // НОВЫЙ Обработчик для чекбоксов ПРОЕКТОВ ДЛЯ ГЕНЕРАЦИИ
  const handleGenerationProjectSelectionChange = (projectId, isChecked) => {
    setProjectsForGenerationIds(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  };
  // НОВЫЙ "Выбрать все" для ПРОЕКТОВ ДЛЯ ГЕНЕРАЦИИ
  const handleSelectAllGenerationProjects = (isChecked) => {
      if (isChecked) {
          setProjectsForGenerationIds(new Set(projects.map(p => p.id)));
      } else {
          setProjectsForGenerationIds(new Set());
      }
  };

  // ... (handleCollectionSelectionChange) ...
  const handleCollectionSelectionChange = (collectionId, isChecked) => {
    setSelectedCollectionIds(prev => {
        const newSet = new Set(prev);
        if (isChecked) {
            newSet.add(collectionId);
        } else {
            newSet.delete(collectionId);
        }
        return newSet;
    });
  };
  // ... (handleSelectAllCollections) ...
  const handleSelectAllCollections = (isChecked) => {
      const currentVisibleIds = new Set(getSortedAndFilteredCollections().map(c => c.id));
      if (isChecked) {
          setSelectedCollectionIds(prev => new Set([...prev, ...currentVisibleIds]));
      } else {
          setSelectedCollectionIds(prev => new Set([...prev].filter(id => !currentVisibleIds.has(id))));
      }
  };
  
  // Обновляем логику запуска генерации
  const handleGenerateSelected = async () => {
    // Проверяем выбор коллекций и проектов ДЛЯ ГЕНЕРАЦИИ
    if (selectedCollectionIds.size === 0 || projectsForGenerationIds.size === 0) { 
        alert("Пожалуйста, выберите хотя бы одну коллекцию и один проект для генерации (в параметрах генерации).");
        return;
    }

    setIsSubmittingGenerations(true);
    const pairsToGenerate = [];

    selectedCollectionIds.forEach(collectionId => {
        const collection = collections.find(c => c.id === collectionId);
        if (collection) { 
            // Используем projectsForGenerationIds
            projectsForGenerationIds.forEach(projectId => { 
                pairsToGenerate.push({ project_id: projectId, collection_id: collectionId });
            });
        }
    });

    if (pairsToGenerate.length === 0) {
        // Эта проверка может быть излишней, если предыдущая сработала
        alert("Нет пар проект-коллекция для генерации."); 
        setIsSubmittingGenerations(false);
        return;
    }

    try {
        console.log("Sending pairs to generate:", pairsToGenerate);
        const response = await axios.post(`${API_URL}/generate-batch`, { pairs: pairsToGenerate });
        console.log("Generate batch response:", response.data);
        alert(`Задачи отправлены. Запущено: ${response.data.tasks_started?.length || 0}. Ошибки: ${response.data.errors?.length || 0}`);

    } catch (err) {
        console.error("Error calling generate-batch API:", err);
        alert(`Ошибка при отправке задач генерации: ${err.response?.data?.error || err.message}`);
    } finally {
        setIsSubmittingGenerations(false);
    }
  };
  
  // ... (openSelectionModal, closeSelectionModal, handleSelectionConfirmed) ...
  const openSelectionModal = (collectionId, projectId) => {
    setModalContext({ collectionId, projectId });
    setIsModalOpen(true);
  };

  const closeSelectionModal = () => {
    setIsModalOpen(false);
    setModalContext({ collectionId: null, projectId: null });
  };
  
  const handleSelectionConfirmed = () => {
      console.log('Selection confirmed in modal, refreshing grid data...');
      fetchGridData(); 
  };
  // ... (handlePromptChange, handleAutoSaveCollectionField, renderFieldStatus, handleCollectionAdded) ...
   const handlePromptChange = (collectionId, fieldType, newValue) => {
        setCollections(prevCollections => 
          prevCollections.map(coll => {
              if (coll.id === collectionId) {
                  let fieldKey = '';
                  if (fieldType === 'positive') fieldKey = 'collection_positive_prompt';
                  else if (fieldType === 'negative') fieldKey = 'collection_negative_prompt';
                  else if (fieldType === 'comment') fieldKey = 'comment';
                  
                  if(fieldKey) return { ...coll, [fieldKey]: newValue };
              }
              return coll;
          })
      );
  };

  const handleAutoSaveCollectionField = async (collectionId, fieldType, currentValue) => {
      const fieldKeyMap = {
          positive: 'collection_positive_prompt',
          negative: 'collection_negative_prompt',
          comment: 'comment'
      };
      const fieldKey = fieldKeyMap[fieldType];
      if (!fieldKey) return;

      const timerKey = `${collectionId}-${fieldType}`;
      
      if (saveTimersRef.current[timerKey]) {
          clearTimeout(saveTimersRef.current[timerKey]);
      }

      setFieldSaveStatus(prev => ({
          ...prev,
          [collectionId]: {
              ...prev[collectionId],
              [fieldType]: { saving: true, error: null, saved: false } 
          }
      }));

      try {
          const payload = { [fieldKey]: currentValue };
          await axios.put(`${API_URL}/collections/${collectionId}`, payload);

          setFieldSaveStatus(prev => ({
              ...prev,
              [collectionId]: {
                  ...prev[collectionId],
                  [fieldType]: { saving: false, error: null, saved: true } 
              }
          }));

          saveTimersRef.current[timerKey] = setTimeout(() => {
              setFieldSaveStatus(prev => {
                  if (prev[collectionId]?.[fieldType]?.saved) {
                      return {
                           ...prev,
                           [collectionId]: {
                              ...prev[collectionId],
                              [fieldType]: { saving: false, error: null, saved: false }
                          }
                      };
                  }
                  return prev;
              });
              delete saveTimersRef.current[timerKey];
          }, 2000);
          
      } catch (err) {
          console.error(`Error auto-saving ${fieldType} for collection ${collectionId}:`, err);
          const errorMsg = err.response?.data?.error || err.message || 'Ошибка сохранения';
          setFieldSaveStatus(prev => ({
              ...prev,
              [collectionId]: {
                  ...prev[collectionId],
                  [fieldType]: { saving: false, error: errorMsg, saved: false }
              }
          }));
      }
  };

  const renderFieldStatus = (collectionId, fieldType) => {
      const status = fieldSaveStatus[collectionId]?.[fieldType];
      if (!status) return null;

      if (status.saving) {
          return <Spinner animation="border" size="sm" variant="secondary" className="ms-1" title="Сохранение..."/>;
      } 
      if (status.error) {
          return <ExclamationTriangleFill className="text-danger ms-1" title={`Ошибка: ${status.error}`} />;
      } 
      if(status.saved) { 
           return <CheckLg className="text-success ms-1" title="Сохранено" />;
      }
      
      return null;
  };
  const handleCollectionAdded = () => {
      fetchGridData();
  };

  // --- ЛОГИКА ФИЛЬТРАЦИИ И СОРТИРОВКИ --- 
  const getSortedAndFilteredCollections = () => {
     // ... (без изменений) ...
     const filtered = collections.filter(collection => {
        if (!collection.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (typeFilter !== 'all' && collection.type !== typeFilter) return false;
        if (advancedFilter === 'empty_positive' && collection.collection_positive_prompt) return false;
        if (advancedFilter === 'no_dynamic') {
            const hasDynamic =
                (collection.collection_positive_prompt?.includes('{') && collection.collection_positive_prompt?.includes('}')) ||
                collection.collection_positive_prompt?.includes('|') ||
                (collection.collection_negative_prompt?.includes('{') && collection.collection_negative_prompt?.includes('}')) ||
                collection.collection_negative_prompt?.includes('|');
            if (hasDynamic) return false;
        }
        if (advancedFilter === 'has_comment' && !collection.comment?.trim()) return false;
        return true;
    });

     const sorted = [...filtered].sort((a, b) => {
        const key = sortConfig.key;
        const direction = sortConfig.direction === 'ascending' ? 1 : -1;
        let aValue = a[key];
        let bValue = b[key];
        if (key === 'created_at' || key === 'last_generation_at') {
            aValue = aValue ? new Date(aValue).getTime() : (direction === 1 ? Infinity : -Infinity); 
            bValue = bValue ? new Date(bValue).getTime() : (direction === 1 ? Infinity : -Infinity);
        } else if (key === 'name') {
            aValue = aValue?.toLowerCase() || '';
            bValue = bValue?.toLowerCase() || '';
        }
        if (aValue < bValue) return -1 * direction;
        if (aValue > bValue) return 1 * direction;
        if (key === 'created_at' || key === 'last_generation_at') {
             const nameA = a.name?.toLowerCase() || '';
             const nameB = b.name?.toLowerCase() || '';
             if (nameA < nameB) return -1;
             if (nameA > nameB) return 1;
        }
        return 0;
    });
    return sorted;
  };

  const sortedAndFilteredCollections = getSortedAndFilteredCollections();
  const allVisibleCollectionsSelected = sortedAndFilteredCollections.length > 0 && sortedAndFilteredCollections.every(c => selectedCollectionIds.has(c.id));
  // Пересчитываем видимые колонки на основе переименованного состояния
  const visibleProjects = projects.filter(p => visibleColumnProjectIds.has(p.id));
  const allColumnProjectsSelected = projects.length > 0 && visibleColumnProjectIds.size === projects.length;
  // Новое состояние для чекбокса "Все" проектов для генерации
  const allGenerationProjectsSelected = projects.length > 0 && projectsForGenerationIds.size === projects.length;

  // Возвращаем определение переменной для отображения колонки промптов
  const shouldShowPromptColumn = showPositivePrompt || showNegativePrompt || showCollectionComment;

  // --- РЕНДЕРИНГ КОМПОНЕНТА --- 
  return (
    <> 
      {/* Открываем только второй аккордеон (индекс 1) по умолчанию */}
      <Accordion defaultActiveKey={["1"]} alwaysOpen className="mb-3"> 
        <Accordion.Item eventKey="0">
          <Accordion.Header>Параметры генерации</Accordion.Header>
          <Accordion.Body>
             {/* --- Секция выбора проектов ДЛЯ ГЕНЕРАЦИИ --- */} 
             <h5>Проекты для запуска генерации</h5>
             <Form.Check 
                  type="checkbox"
                  id="select-all-generation-projects"
                  label="Все проекты для генерации"
                  checked={allGenerationProjectsSelected}
                  onChange={(e) => handleSelectAllGenerationProjects(e.target.checked)}
             />
             <div className="mt-2 mb-3" style={{ maxHeight: '100px', overflowY: 'auto' }}> 
                  {projects.map(project => (
                    <Form.Check 
                      key={`gen-${project.id}`} // Уникальный key
                      type="checkbox"
                      id={`gen-project-${project.id}`} // Уникальный id
                      label={project.name}
                      checked={projectsForGenerationIds.has(project.id)} // Используем новое состояние
                      onChange={(e) => handleGenerationProjectSelectionChange(project.id, e.target.checked)} // Используем новый обработчик
                      inline
                    />
                  ))}
              </div>
             {/* TODO: Добавить сюда другие параметры генерации, если нужно */} 
             <p className="text-muted small">Здесь будут другие общие параметры генерации...</p>
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item eventKey="1">
           {/* Переименовываем заголовок */} 
          <Accordion.Header>Опции отображения грида</Accordion.Header> 
          <Accordion.Body>
            <Row className="mb-3">
              <Col md={8}> 
                <h5>Видимые колонки (Проекты)</h5> { /* Меняем заголовок */}
                <Form.Check 
                  type="checkbox"
                  id="select-all-column-projects" // Меняем ID
                  label="Все колонки"
                  checked={allColumnProjectsSelected} // Используем переименованное состояние
                  onChange={(e) => handleSelectAllColumnProjects(e.target.checked)} // Используем переименованный обработчик
                />
                <div className="mt-2" style={{ maxHeight: '100px', overflowY: 'auto' }}> 
                  {projects.map(project => (
                    <Form.Check 
                      key={project.id}
                      type="checkbox"
                      id={`col-project-${project.id}`} // Меняем ID
                      label={project.name}
                      checked={visibleColumnProjectIds.has(project.id)} // Используем переименованное состояние
                      onChange={(e) => handleColumnProjectSelectionChange(project.id, e.target.checked)} // Используем переименованный обработчик
                      inline
                    />
                  ))}
                </div>
              </Col>
              <Col md={4}> 
                <h5>Отображать в таблице</h5> { /* Меняем заголовок */} 
                 {/* ... Чекбоксы Positive/Negative/Comment ... */} 
                   <Form.Check 
                     type="checkbox"
                     id="show-positive-prompt"
                     label="Positive Prompt"
                     checked={showPositivePrompt}
                     onChange={(e) => setShowPositivePrompt(e.target.checked)}
                   />
                   <Form.Check 
                     type="checkbox"
                     id="show-negative-prompt"
                     label="Negative Prompt"
                     checked={showNegativePrompt}
                     onChange={(e) => setShowNegativePrompt(e.target.checked)}
                   />
                   <Form.Check 
                     type="checkbox"
                     id="show-collection-comment"
                     label="Комментарий"
                     checked={showCollectionComment}
                     onChange={(e) => setShowCollectionComment(e.target.checked)}
                   />
              </Col>
            </Row>
            {/* --- Строка Фильтров/Сортировки --- */} 
            <Row className="mt-3 gx-2">
                 {/* ... Сортировка, Фильтр, Тип ... */} 
                  <Col md={4}>
                      <Form.Label>Сортировка</Form.Label>
                      <Dropdown size="sm"> 
                         <Dropdown.Toggle variant="outline-secondary" id="dropdown-sort" className="w-100 text-start">
                             {sortConfig.direction === 'ascending' ? <SortUp className="me-1"/> : <SortDown className="me-1"/>}
                             {{ 
                                 created_at: 'Дата создания', 
                                 name: 'Название', 
                                 last_generation_at: 'Дата генерации' 
                              }[sortConfig.key] || '???'} 
                         </Dropdown.Toggle>
                         <Dropdown.Menu>
                             <Dropdown.Item onClick={() => setSortConfig({ key: 'last_generation_at', direction: 'descending' })} active={sortConfig.key === 'last_generation_at' && sortConfig.direction === 'descending'}>
                                 Дата генерации (сначала новые)
                             </Dropdown.Item>
                             <Dropdown.Item onClick={() => setSortConfig({ key: 'last_generation_at', direction: 'ascending' })} active={sortConfig.key === 'last_generation_at' && sortConfig.direction === 'ascending'}>
                                 Дата генерации (сначала старые)
                             </Dropdown.Item>
                              <Dropdown.Divider />
                             <Dropdown.Item onClick={() => setSortConfig({ key: 'created_at', direction: 'descending' })} active={sortConfig.key === 'created_at' && sortConfig.direction === 'descending'}>
                                 Дата создания (сначала новые)
                             </Dropdown.Item>
                             <Dropdown.Item onClick={() => setSortConfig({ key: 'created_at', direction: 'ascending' })} active={sortConfig.key === 'created_at' && sortConfig.direction === 'ascending'}>
                                 Дата создания (сначала старые)
                             </Dropdown.Item>
                             <Dropdown.Divider />
                             <Dropdown.Item onClick={() => setSortConfig({ key: 'name', direction: 'ascending' })} active={sortConfig.key === 'name' && sortConfig.direction === 'ascending'}>
                                 Название (А-Я)
                             </Dropdown.Item>
                             <Dropdown.Item onClick={() => setSortConfig({ key: 'name', direction: 'descending' })} active={sortConfig.key === 'name' && sortConfig.direction === 'descending'}>
                                 Название (Я-А)
                             </Dropdown.Item>
                         </Dropdown.Menu>
                      </Dropdown>
                  </Col>
                  <Col md={4}>
                     <Form.Label>Фильтр</Form.Label>
                     <Dropdown size="sm"> 
                         <Dropdown.Toggle variant="outline-secondary" id="dropdown-filter" className="w-100 text-start">
                             <FunnelFill className="me-1"/> 
                             {{ 
                                 all: 'Все', 
                                 empty_positive: 'Пустой Positive', 
                                 no_dynamic: 'Нет Dynamic Prompts', 
                                 has_comment: 'Есть комментарий' 
                             }[advancedFilter]}
                         </Dropdown.Toggle>
                         <Dropdown.Menu>
                             <Dropdown.Item onClick={() => setAdvancedFilter('all')} active={advancedFilter === 'all'}>Все</Dropdown.Item>
                             <Dropdown.Item onClick={() => setAdvancedFilter('empty_positive')} active={advancedFilter === 'empty_positive'}>Пустой Positive Prompt</Dropdown.Item>
                             <Dropdown.Item onClick={() => setAdvancedFilter('no_dynamic')} active={advancedFilter === 'no_dynamic'}>Нет Dynamic Prompts ({}, |)</Dropdown.Item>
                             <Dropdown.Item onClick={() => setAdvancedFilter('has_comment')} active={advancedFilter === 'has_comment'}>Есть комментарий</Dropdown.Item>
                         </Dropdown.Menu>
                     </Dropdown>
                  </Col>
                 <Col md={4}>
                    <Form.Label>Тип сборника</Form.Label>
                    <Dropdown size="sm"> 
                        <Dropdown.Toggle variant="outline-secondary" id="dropdown-type" className="w-100 text-start">
                            <TagFill className="me-1"/> {typeFilter === 'all' ? 'Все типы' : typeFilter}
                        </Dropdown.Toggle>
                        <Dropdown.Menu style={{maxHeight: '200px', overflowY: 'auto'}}> 
                            <Dropdown.Item onClick={() => setTypeFilter('all')} active={typeFilter === 'all'}>Все типы</Dropdown.Item>
                            <Dropdown.Divider />
                            {collectionTypes.map(type => (
                                <Dropdown.Item key={type} onClick={() => setTypeFilter(type)} active={typeFilter === type}>
                                    {type}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    </Dropdown>
                 </Col>
             </Row>
           </Accordion.Body>
         </Accordion.Item>
       </Accordion>
      
       {/* --- Строка Поиска и Действий --- */} 
      <Row className="mb-3 align-items-center gx-2"> 
          <Col md={8} lg={9}> 
            <InputGroup size="sm"> 
               <Form.Control
                 placeholder="Найти сборник..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
            </InputGroup>
          </Col>
          <Col md={4} lg={3} className="text-end"> 
            <ButtonGroup size="sm">
                <Button variant="outline-primary" onClick={() => setShowAddModal(true)}> 
                    Добавить
                </Button>
                <Button 
                    variant="primary" 
                    onClick={handleGenerateSelected}
                    // Обновляем disabled
                    disabled={isSubmittingGenerations || selectedCollectionIds.size === 0 || projectsForGenerationIds.size === 0} 
                    title="Сгенерировать для выбранных коллекций и проектов (выбранных в параметрах генерации)"
                >
                    {isSubmittingGenerations ? <><Spinner as="span" animation="border" size="sm"/> Запуск...</> : "Сгенерировать выбранные"}
                </Button>
             </ButtonGroup>
          </Col>
      </Row>
      
      {/* --- Таблица Грида --- */} 
      <Table bordered hover responsive className="generation-grid-table"> 
        <thead>
             <tr>
                <th>
                <Form.Check 
                    type="checkbox"
                    id="select-all-collections"
                    checked={allVisibleCollectionsSelected} 
                    onChange={(e) => handleSelectAllCollections(e.target.checked)}
                    title="Выбрать все видимые на странице"
                    className="float-start me-2"
                />
                Title / ID 
                </th>
                {/* Рендерим колонки на основе visibleColumnProjectIds */} 
                {visibleProjects.map(project => (
                    <th key={project.id}>{project.name}</th>
                ))}
                {shouldShowPromptColumn && <th>Prompt / Комментарий</th>} 
             </tr>
        </thead>
        <tbody>
          {sortedAndFilteredCollections.map(collection => {
             const positivePromptInvalid = !collection.collection_positive_prompt; 
             const positiveStatus = fieldSaveStatus[collection.id]?.positive || {};
             const negativeStatus = fieldSaveStatus[collection.id]?.negative || {};
             const commentStatus = fieldSaveStatus[collection.id]?.comment || {};
             
             return (
                 <tr key={collection.id}>
                    <td> 
                         <Form.Check 
                           type="checkbox"
                           id={`collection-${collection.id}`}
                           checked={selectedCollectionIds.has(collection.id)}
                           onChange={(e) => handleCollectionSelectionChange(collection.id, e.target.checked)}
                           className="float-start me-2"
                         />
                         <div>
                            <strong>{collection.name}</strong>
                            <br />
                            <small className="text-muted">{collection.id}</small>
                            {collection.type && (
                               <Badge bg="secondary" className="ms-2">{collection.type}</Badge>
                            )}
                         </div>
                      </td>
                      {/* Рендерим ячейки на основе visibleColumnProjectIds */} 
                      {visibleProjects.map(project => (
                         <GridCell 
                           key={`${collection.id}-${project.id}`}
                           cellData={collection.cells ? collection.cells[project.id] : null}
                           onClick={() => openSelectionModal(collection.id, project.id)}
                         />
                      ))}
                      {/* ... (Колонка с промптами без изменений) ... */} 
                       {shouldShowPromptColumn && (
                          <td className="align-top position-relative"> 
                             {showPositivePrompt && (
                                <div className="position-relative mb-1"> 
                                    <Form.Control 
                                      as="textarea" rows={2} placeholder="Positive Prompt"
                                      value={collection.collection_positive_prompt || ''}
                                      onChange={(e) => handlePromptChange(collection.id, 'positive', e.target.value)}
                                      onBlur={(e) => handleAutoSaveCollectionField(collection.id, 'positive', e.target.value)}
                                      size="sm" 
                                      className={`${positiveStatus.saved && !positivePromptInvalid ? 'border border-success' : ''}`}
                                      isInvalid={positivePromptInvalid && !positiveStatus.saved} 
                                    />
                                    <div className="position-absolute" style={{top: '5px', right: '5px'}}> 
                                       {renderFieldStatus(collection.id, 'positive')}
                                    </div>
                                </div>
                             )}
                             {showNegativePrompt && (
                                <div className="position-relative mb-1"> 
                                    <Form.Control 
                                      as="textarea" rows={1} placeholder="Negative Prompt" 
                                      value={collection.collection_negative_prompt || ''}
                                      onChange={(e) => handlePromptChange(collection.id, 'negative', e.target.value)}
                                      onBlur={(e) => handleAutoSaveCollectionField(collection.id, 'negative', e.target.value)}
                                      size="sm" 
                                       className={`${negativeStatus.saved ? 'border border-success' : ''}`}
                                    />
                                    <div className="position-absolute" style={{top: '5px', right: '5px'}}> 
                                       {renderFieldStatus(collection.id, 'negative')}
                                    </div>
                                </div>
                             )}
                             {showCollectionComment && (
                                <div className="position-relative"> 
                                    <Form.Control 
                                      as="textarea" rows={1} placeholder="Комментарий"
                                      value={collection.comment || ''}
                                      onChange={(e) => handlePromptChange(collection.id, 'comment', e.target.value)}
                                      onBlur={(e) => handleAutoSaveCollectionField(collection.id, 'comment', e.target.value)}
                                      size="sm"
                                      className={`${commentStatus.saved ? 'border border-success' : ''}`}
                                    />
                                     <div className="position-absolute" style={{top: '5px', right: '5px'}}> 
                                       {renderFieldStatus(collection.id, 'comment')}
                                     </div>
                                </div>
                             )}
                          </td>
                      )}
                 </tr>
              )
            })
          }
        </tbody>
      </Table>
      
      {/* --- Модальные окна --- */}
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
