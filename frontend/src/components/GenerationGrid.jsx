import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios'; // Импортируем axios
import SelectionModal from './SelectionModal'; // Импортируем модалку

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
import Spinner from 'react-bootstrap/Spinner'; 
import Alert from 'react-bootstrap/Alert';
import Dropdown from 'react-bootstrap/Dropdown'; 

// Импорты иконок
import { CheckCircleFill, XCircleFill, Search, ChevronDown, ChevronUp, CheckLg, ExclamationTriangleFill, SortDown, SortUp, FunnelFill, TagFill } from 'react-bootstrap-icons';

import AddCollectionModal from './AddCollectionModal';

const API_URL = 'http://localhost:5001/api'; // Базовый URL API

// Компонент для отображения ячейки грида (БЕЗ ИЗМЕНЕНИЙ - можно оставить как есть)
const GridCell = ({ cellData, onClick }) => {
  let content = null;
  let cellClass = "grid-cell align-middle"; 
  let backgroundClass = "";
  let isClickable = false;

  if (!cellData) {
    content = "-";
    cellClass = "text-center text-muted align-middle"; 
  } else {
      isClickable = cellData.status === 'generated_not_selected' || cellData.status === 'selected';
      if (isClickable) {
        cellClass += " clickable"; 
      }
      
      switch (cellData.status) {
        case 'not_generated':
          content = <span className="text-white small">Не сгенерировано</span>; 
          backgroundClass = "cell-not-generated"; 
          break;
        case 'queued':
          content = <div className="text-center"><Spinner animation="border" size="sm" /><br/><small>В очереди...</small></div>; 
          backgroundClass = "bg-warning bg-opacity-25"; 
          break;
        case 'error':
          content = <span className="text-danger small" title={cellData.error_message || 'Неизвестная ошибка'}><XCircleFill className="me-1"/> Ошибка</span>; 
          cellClass += " error"; 
          backgroundClass = "bg-danger bg-opacity-25"; 
          break;
        case 'generated_not_selected': 
            content = (
                <div className="text-center">
                    <span className="text-white small d-block">Сгенерировано</span>
                    <span className="text-white small d-block">Не выбрано</span>
                </div>
            );
            backgroundClass = "cell-generated-not-selected"; 
            break;
        case 'selected':
          if (cellData.file_url) {
            content = <Image src={cellData.file_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt={`Gen ${cellData.generation_id}`} />; 
          } else {
            content = <span className="text-danger small"><XCircleFill className="me-1"/> Нет файла</span>;
            cellClass += " error";
            backgroundClass = ""; 
          }
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

  return (
    <td 
      className={`${backgroundClass} p-0 position-relative`}
      style={{ width: '150px', height: '150px' }} 
      onClick={handleClick}
    >
      <div 
         className={`d-flex align-items-center justify-content-center w-100 h-100 ${cellClass}`}
         style={{ cursor: isClickable ? 'pointer' : 'default' }}
       >
         {content} 
      </div>
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
    collections, // Теперь collections приходит из App.js (если мы не управляем им здесь)
    setCollections, // И setCollections тоже
    gridLoading, // Управляется из App.js? Или оставляем здесь? Давайте пока оставим
    setGridLoading, 
    gridError, 
    setGridError 
}) => {
  // --- Состояния --- 
  const [projects, setProjects] = useState([]); // Список проектов, ОТОБРАЖАЕМЫХ в КОЛОНКАХ
  const [allProjectsList, setAllProjectsList] = useState([]); // ПОЛНЫЙ список проектов для UI
  const [visibleColumnProjectIds, setVisibleColumnProjectIds] = useState(new Set()); // ID видимых колонок
  
  // Состояния для фильтров, поиска, выбора строк и т.д. остаются
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedCollectionIds, setSelectedCollectionIds] = useState(new Set());
  const [isSubmittingGenerations, setIsSubmittingGenerations] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState({ collectionId: null, projectId: null });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPositivePrompt, setShowPositivePrompt] = useState(true); 
  const [showNegativePrompt, setShowNegativePrompt] = useState(true);
  const [showCollectionComment, setShowCollectionComment] = useState(false);
  const [fieldSaveStatus, setFieldSaveStatus] = useState({}); 
  const saveTimersRef = useRef({});
  const [sortConfig, setSortConfig] = useState({ key: 'last_generation_at', direction: 'descending' });
  const [advancedFilter, setAdvancedFilter] = useState('all'); 
  const [typeFilter, setTypeFilter] = useState('all'); 
  const [collectionTypes, setCollectionTypes] = useState([]);
  const [projectsForGenerationIds, setProjectsForGenerationIds] = useState(new Set());
  
  // Ref для отслеживания первого рендера, чтобы не вызывать перезагрузку данных
  const isInitialMount = useRef(true); 

  // --- Загрузка Данных --- 
  // Модифицируем fetchGridData
  const fetchGridData = useCallback(async (projectIdsSet = null) => { 
    setGridLoading(true);
    setGridError(null);
    let requestParams = {};
    // Добавляем параметр, если передан Set и он не пустой
    if (projectIdsSet && projectIdsSet.size > 0) {
        requestParams.visible_project_ids = Array.from(projectIdsSet).join(',');
    } else {
        // Если Set не передан (первая загрузка) или пуст, 
        // НЕ передаем visible_project_ids, чтобы бэкенд вернул ВСЕ проекты
    }
    
    try {
      const response = await axios.get(`${API_URL}/grid-data`, { params: requestParams }); 
      const fetchedProjects = response.data.projects || []; // Это будут отфильтрованные проекты
      const fetchedCollections = response.data.collections || [];
      
      setProjects(fetchedProjects); // Устанавливаем ТЕКУЩИЕ видимые проекты
      setCollections(fetchedCollections); // Устанавливаем (возможно отфильтрованные по строкам) коллекции
      
      // При ПЕРВОЙ загрузке (когда projectIdsSet === null)
      if (!projectIdsSet) { 
          // Сохраняем ПОЛНЫЙ список проектов для использования в UI (чекбоксы и т.д.)
          setAllProjectsList(fetchedProjects); 
          // Инициализируем видимые колонки ВСЕМИ проектами
          setVisibleColumnProjectIds(new Set(fetchedProjects.map(p => p.id))); 
          // Устанавливаем типы коллекций
          const uniqueTypes = [...new Set(fetchedCollections.map(c => c.type).filter(Boolean))].sort();
          setCollectionTypes(uniqueTypes);
      }
            
    } catch (err) {
      console.error("Error fetching grid data:", err);
      setGridError("Не удалось загрузить данные для грида.");
      // При ошибке не сбрасываем данные, чтобы пользователь видел старое состояние
    } finally {
      setGridLoading(false);
    }
  }, [setCollections, setGridError, setGridLoading]); // Зависимости

  // Начальная загрузка ВСЕХ данных при монтировании
  useEffect(() => {
    isInitialMount.current = true; // Устанавливаем флаг перед первой загрузкой
    fetchGridData(); // Вызываем без аргументов для полной загрузки
    return () => {
        Object.values(saveTimersRef.current).forEach(clearTimeout);
    };
  }, [fetchGridData]); // Зависим только от fetchGridData

  // Эффект для перезагрузки данных при ИЗМЕНЕНИИ видимых колонок
  useEffect(() => {
    // Пропускаем самый первый рендер после монтирования
    if (isInitialMount.current) {
      isInitialMount.current = false; // Снимаем флаг после первого рендера
      return; 
    }
    
    // Если это не первый рендер, и visibleColumnProjectIds изменились, 
    // вызываем fetchGridData с текущим набором видимых ID
    console.log("Visible columns changed, refetching data for:", visibleColumnProjectIds);
    fetchGridData(visibleColumnProjectIds); 

  }, [visibleColumnProjectIds, fetchGridData]); // Зависим от видимых ID и функции

  // --- Обработчики --- 
  
  // Обработчик изменения видимых КОЛОНОК
  const handleColumnProjectSelectionChange = (projectId, isChecked) => {
    setVisibleColumnProjectIds(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(projectId);
      } else {
        // Не даем убрать последний выбранный проект из видимости
        if (newSet.size <= 1) return prev; 
        newSet.delete(projectId);
      }
      return newSet;
    });
    // Перезагрузка данных будет вызвана useEffect выше
  };
  
  // Обработчик "Выбрать все" для видимых КОЛОНОК
  const handleSelectAllColumnProjects = (isChecked) => {
    if (isChecked) {
        // Устанавливаем все ID из ПОЛНОГО списка
        setVisibleColumnProjectIds(new Set(allProjectsList.map(p => p.id))); 
    } else {
        // Не позволяем снять все, оставляем хотя бы один
        if (visibleColumnProjectIds.size > 1 && allProjectsList.length > 0) { 
             // Оставляем только первый проект из полного списка
             setVisibleColumnProjectIds(new Set([allProjectsList[0].id])); 
        }
    }
  };

  // Обработчики для проектов ДЛЯ ГЕНЕРАЦИИ (без изменений, но используют allProjectsList)
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
  const handleSelectAllGenerationProjects = (isChecked) => {
      if (isChecked) {
          // Выбираем все из ПОЛНОГО списка
          setProjectsForGenerationIds(new Set(allProjectsList.map(p => p.id))); 
      } else {
          setProjectsForGenerationIds(new Set());
      }
  };

  // Обработчики коллекций (без изменений)
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
  const handleSelectAllCollections = (isChecked) => {
      // Фильтруем и сортируем ТЕКУЩИЕ отображаемые коллекции
      const currentVisibleIds = new Set(getSortedAndFilteredCollections().map(c => c.id)); 
      if (isChecked) {
          setSelectedCollectionIds(prev => new Set([...prev, ...currentVisibleIds]));
      } else {
          setSelectedCollectionIds(prev => new Set([...prev].filter(id => !currentVisibleIds.has(id))));
      }
  };
  
  // handleGenerateSelected (без изменений)
  const handleGenerateSelected = async () => {
    if (selectedCollectionIds.size === 0 || projectsForGenerationIds.size === 0) { 
        alert("Пожалуйста, выберите хотя бы одну коллекцию и один проект для генерации (в параметрах генерации).");
        return;
    }
    // ... остальная логика без изменений ...
     setIsSubmittingGenerations(true);
    const pairsToGenerate = [];
    selectedCollectionIds.forEach(collectionId => {
        // Ищем коллекцию в текущем состоянии collections
        const collection = collections.find(c => c.id === collectionId); 
        if (collection) { 
            projectsForGenerationIds.forEach(projectId => { 
                pairsToGenerate.push({ project_id: projectId, collection_id: collectionId });
            });
        }
    });
    if (pairsToGenerate.length === 0) {
        alert("Нет пар проект-коллекция для генерации."); 
        setIsSubmittingGenerations(false);
        return;
    }
    try {
        console.log("Sending pairs to generate:", pairsToGenerate);
        const response = await axios.post(`${API_URL}/generate-batch`, { pairs: pairsToGenerate });
        console.log("Generate batch response:", response.data);
        alert(`Задачи отправлены. Запущено: ${response.data.tasks_started?.length || 0}. Ошибки: ${response.data.errors?.length || 0}`);
        // TODO: Обновить статус ячеек на 'queued' на фронте? Или ждать WebSocket?
    } catch (err) {
        console.error("Error calling generate-batch API:", err);
        alert(`Ошибка при отправке задач генерации: ${err.response?.data?.error || err.message}`);
    } finally {
        setIsSubmittingGenerations(false);
    }
  };
  
  // Обработчики модалки выбора (без изменений, кроме перезагрузки)
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
      // Перезагружаем данные для ТЕКУЩИХ видимых колонок
      fetchGridData(visibleColumnProjectIds); 
  };
  
  // Обработчики полей (без изменений)
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
      const fieldKeyMap = { positive: 'collection_positive_prompt', negative: 'collection_negative_prompt', comment: 'comment' };
      const fieldKey = fieldKeyMap[fieldType];
      if (!fieldKey) return;
      const timerKey = `${collectionId}-${fieldType}`;
      if (saveTimersRef.current[timerKey]) { clearTimeout(saveTimersRef.current[timerKey]); }
      setFieldSaveStatus(prev => ({ ...prev, [collectionId]: { ...prev[collectionId], [fieldType]: { saving: true, error: null, saved: false } } }));
      try {
          await axios.put(`${API_URL}/collections/${collectionId}`, { [fieldKey]: currentValue });
          setFieldSaveStatus(prev => ({ ...prev, [collectionId]: { ...prev[collectionId], [fieldType]: { saving: false, error: null, saved: true } } }));
          saveTimersRef.current[timerKey] = setTimeout(() => {
              setFieldSaveStatus(prev => { if (prev[collectionId]?.[fieldType]?.saved) { return { ...prev, [collectionId]: { ...prev[collectionId], [fieldType]: { saving: false, error: null, saved: false } } }; } return prev; });
              delete saveTimersRef.current[timerKey];
          }, 2000);
      } catch (err) {
          console.error(`Error auto-saving ${fieldType} for collection ${collectionId}:`, err);
          const errorMsg = err.response?.data?.error || err.message || 'Ошибка сохранения';
          setFieldSaveStatus(prev => ({ ...prev, [collectionId]: { ...prev[collectionId], [fieldType]: { saving: false, error: errorMsg, saved: false } } }));
      }
  };
  const renderFieldStatus = (collectionId, fieldType) => {
      const status = fieldSaveStatus[collectionId]?.[fieldType];
      if (!status) return null;
      if (status.saving) { return <Spinner animation="border" size="sm" variant="secondary" className="ms-1" title="Сохранение..."/>; } 
      if (status.error) { return <ExclamationTriangleFill className="text-danger ms-1" title={`Ошибка: ${status.error}`} />; } 
      if(status.saved) { return <CheckLg className="text-success ms-1" title="Сохранено" />; }
      return null;
  };
  const handleCollectionAdded = () => { fetchGridData(); }; // Перезагружаем все данные

  // --- ЛОГИКА ФИЛЬТРАЦИИ И СОРТИРОВКИ (УДАЛЕНА ФИЛЬТРАЦИЯ ПО КОЛОНКАМ) --- 
  const getSortedAndFilteredCollections = () => {
     // Фильтруем ТЕКУЩИЕ коллекции в state (которые уже пришли от API)
     const filtered = collections.filter(collection => { 
        // Existing filters...
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

        // --- ФИЛЬТРАЦИЯ ПО КОЛОНКАМ УДАЛЕНА ОТСЮДА --- 

        return true; // Passed other filters
    });

     // Sorting logic remains the same...
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
        // Доп. сортировка по имени для одинаковых дат
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

  // Вычисляем производные состояния на основе ТЕКУЩИХ данных в state
  const sortedAndFilteredCollections = getSortedAndFilteredCollections();
  // Все ли видимые на СТРАНИЦЕ коллекции выбраны?
  const allVisibleCollectionsSelected = sortedAndFilteredCollections.length > 0 && sortedAndFilteredCollections.every(c => selectedCollectionIds.has(c.id));
  // Проекты для рендеринга колонок берем из state projects
  const visibleProjects = projects; 
  // Состояние чекбокса "Все колонки"
  const allColumnProjectsSelected = allProjectsList.length > 0 && visibleColumnProjectIds.size === allProjectsList.length; 
  // Состояние чекбокса "Все проекты для генерации"
  const allGenerationProjectsSelected = allProjectsList.length > 0 && projectsForGenerationIds.size === allProjectsList.length;
  const shouldShowPromptColumn = showPositivePrompt || showNegativePrompt || showCollectionComment;

  // --- РЕНДЕРИНГ КОМПОНЕНТА --- 
  return (
    <> 
      {/* Аккордеоны */}
      <Accordion defaultActiveKey={["1"]} alwaysOpen className="mb-3"> 
        <Accordion.Item eventKey="0">
          <Accordion.Header>Параметры генерации</Accordion.Header>
          <Accordion.Body>
             <h5>Проекты для запуска генерации</h5>
             <Form.Check 
                  type="checkbox"
                  id="select-all-generation-projects"
                  label={`Все проекты (${allProjectsList.length})`} // Показываем общее число
                  checked={allGenerationProjectsSelected} 
                  onChange={(e) => handleSelectAllGenerationProjects(e.target.checked)}
             />
             <div className="mt-2 mb-3" style={{ maxHeight: '100px', overflowY: 'auto' }}> 
                  {/* Используем ПОЛНЫЙ список проектов для рендера чекбоксов */ }
                  {allProjectsList.map(project => ( 
                    <Form.Check 
                      key={`gen-${project.id}`} 
                      type="checkbox"
                      id={`gen-project-${project.id}`} 
                      label={project.name}
                      checked={projectsForGenerationIds.has(project.id)} 
                      onChange={(e) => handleGenerationProjectSelectionChange(project.id, e.target.checked)} 
                      inline
                    />
                  ))}
              </div>
             {/* <p className="text-muted small">Здесь будут другие общие параметры генерации...</p> */}
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item eventKey="1">
          <Accordion.Header>Опции отображения грида</Accordion.Header> 
          <Accordion.Body>
            <Row className="mb-3">
              <Col md={8}> 
                <h5>Видимые колонки (Проекты)</h5> 
                <Form.Check 
                  type="checkbox"
                  id="select-all-column-projects" 
                  label={`Все колонки (${allProjectsList.length})`}
                  checked={allColumnProjectsSelected} 
                  onChange={(e) => handleSelectAllColumnProjects(e.target.checked)} 
                />
                <div className="mt-2" style={{ maxHeight: '100px', overflowY: 'auto' }}> 
                  {/* Используем ПОЛНЫЙ список проектов для рендера чекбоксов */ }
                  {allProjectsList.map(project => ( 
                    <Form.Check 
                      key={project.id} // Используем ID из полного списка
                      type="checkbox"
                      id={`col-project-${project.id}`} 
                      label={project.name}
                      checked={visibleColumnProjectIds.has(project.id)} // Проверяем наличие в Set видимых
                      onChange={(e) => handleColumnProjectSelectionChange(project.id, e.target.checked)} 
                      inline
                      // Блокируем снятие последнего видимого чекбокса
                      disabled={visibleColumnProjectIds.size <= 1 && visibleColumnProjectIds.has(project.id)} 
                    />
                  ))}
                </div>
              </Col>
              <Col md={4}> 
                <h5>Отображать в таблице</h5> 
                   {/* Чекбоксы отображения полей без изменений */}
                   <Form.Check type="checkbox" id="show-positive-prompt" label="Positive Prompt" checked={showPositivePrompt} onChange={(e) => setShowPositivePrompt(e.target.checked)} />
                   <Form.Check type="checkbox" id="show-negative-prompt" label="Negative Prompt" checked={showNegativePrompt} onChange={(e) => setShowNegativePrompt(e.target.checked)} />
                   <Form.Check type="checkbox" id="show-collection-comment" label="Комментарий" checked={showCollectionComment} onChange={(e) => setShowCollectionComment(e.target.checked)} />
              </Col>
            </Row>
            {/* Фильтры/Сортировка (без изменений) */}
            <Row className="mt-3 gx-2">
                  <Col md={4}>
                      <Form.Label>Сортировка</Form.Label>
                      <Dropdown size="sm"> <Dropdown.Toggle variant="outline-secondary" id="dropdown-sort" className="w-100 text-start"> {sortConfig.direction === 'ascending' ? <SortUp className="me-1"/> : <SortDown className="me-1"/>} {{ created_at: 'Дата создания', name: 'Название', last_generation_at: 'Дата генерации' }[sortConfig.key] || '???'} </Dropdown.Toggle> <Dropdown.Menu> <Dropdown.Item onClick={() => setSortConfig({ key: 'last_generation_at', direction: 'descending' })} active={sortConfig.key === 'last_generation_at' && sortConfig.direction === 'descending'}> Дата генерации (сначала новые) </Dropdown.Item> <Dropdown.Item onClick={() => setSortConfig({ key: 'last_generation_at', direction: 'ascending' })} active={sortConfig.key === 'last_generation_at' && sortConfig.direction === 'ascending'}> Дата генерации (сначала старые) </Dropdown.Item> <Dropdown.Divider /> <Dropdown.Item onClick={() => setSortConfig({ key: 'created_at', direction: 'descending' })} active={sortConfig.key === 'created_at' && sortConfig.direction === 'descending'}> Дата создания (сначала новые) </Dropdown.Item> <Dropdown.Item onClick={() => setSortConfig({ key: 'created_at', direction: 'ascending' })} active={sortConfig.key === 'created_at' && sortConfig.direction === 'ascending'}> Дата создания (сначала старые) </Dropdown.Item> <Dropdown.Divider /> <Dropdown.Item onClick={() => setSortConfig({ key: 'name', direction: 'ascending' })} active={sortConfig.key === 'name' && sortConfig.direction === 'ascending'}> Название (А-Я) </Dropdown.Item> <Dropdown.Item onClick={() => setSortConfig({ key: 'name', direction: 'descending' })} active={sortConfig.key === 'name' && sortConfig.direction === 'descending'}> Название (Я-А) </Dropdown.Item> </Dropdown.Menu> </Dropdown>
                  </Col>
                  <Col md={4}>
                     <Form.Label>Фильтр</Form.Label>
                     <Dropdown size="sm"> <Dropdown.Toggle variant="outline-secondary" id="dropdown-filter" className="w-100 text-start"> <FunnelFill className="me-1"/> {{ all: 'Все', empty_positive: 'Пустой Positive', no_dynamic: 'Нет Dynamic Prompts', has_comment: 'Есть комментарий' }[advancedFilter]} </Dropdown.Toggle> <Dropdown.Menu> <Dropdown.Item onClick={() => setAdvancedFilter('all')} active={advancedFilter === 'all'}>Все</Dropdown.Item> <Dropdown.Item onClick={() => setAdvancedFilter('empty_positive')} active={advancedFilter === 'empty_positive'}>Пустой Positive Prompt</Dropdown.Item> <Dropdown.Item onClick={() => setAdvancedFilter('no_dynamic')} active={advancedFilter === 'no_dynamic'}>Нет Dynamic Prompts ({}, |)</Dropdown.Item> <Dropdown.Item onClick={() => setAdvancedFilter('has_comment')} active={advancedFilter === 'has_comment'}>Есть комментарий</Dropdown.Item> </Dropdown.Menu> </Dropdown>
                  </Col>
                 <Col md={4}>
                    <Form.Label>Тип сборника</Form.Label>
                    <Dropdown size="sm"> <Dropdown.Toggle variant="outline-secondary" id="dropdown-type" className="w-100 text-start"> <TagFill className="me-1"/> {typeFilter === 'all' ? 'Все типы' : typeFilter} </Dropdown.Toggle> <Dropdown.Menu style={{maxHeight: '200px', overflowY: 'auto'}}> <Dropdown.Item onClick={() => setTypeFilter('all')} active={typeFilter === 'all'}>Все типы</Dropdown.Item> <Dropdown.Divider /> {collectionTypes.map(type => ( <Dropdown.Item key={type} onClick={() => setTypeFilter(type)} active={typeFilter === type}> {type} </Dropdown.Item> ))} </Dropdown.Menu> </Dropdown>
                 </Col>
             </Row>
           </Accordion.Body>
         </Accordion.Item>
       </Accordion>
      
       {/* Поиск и Действия (без изменений) */}
      <Row className="mb-3 align-items-center gx-2"> 
          <Col md={8} lg={9}> <InputGroup size="sm"> <Form.Control placeholder="Найти сборник..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /> </InputGroup> </Col>
          <Col md={4} lg={3} className="text-end"> <ButtonGroup size="sm"> <Button variant="outline-primary" onClick={() => setShowAddModal(true)}> Добавить </Button> <Button variant="primary" onClick={handleGenerateSelected} disabled={isSubmittingGenerations || selectedCollectionIds.size === 0 || projectsForGenerationIds.size === 0} title="Сгенерировать для выбранных коллекций и проектов (выбранных в параметрах генерации)"> {isSubmittingGenerations ? <><Spinner as="span" animation="border" size="sm"/> Запуск...</> : "Сгенерировать выбранные"} </Button> </ButtonGroup> </Col>
      </Row>
      
      {/* Таблица Грида */}
      {/* Показываем основной спиннер только при САМОЙ первой загрузке */}
      {gridLoading && allProjectsList.length === 0 && <div className="text-center p-5"><Spinner animation="border" /> Загрузка таблицы...</div>} 
      {/* Показываем ошибку, если она есть */}
      {gridError && <Alert variant="danger">{gridError}</Alert>}
      {/* Показываем таблицу, если нет ошибки и либо не идет загрузка, либо это перезагрузка */}
      {!gridError && (!gridLoading || allProjectsList.length > 0) && ( 
          <Table bordered hover responsive className="generation-grid-table"> 
            <thead>
                 <tr>
                    <th> 
                        {/* Чекбокс "Выбрать все строки" */}
                        <Form.Check 
                            type="checkbox" 
                            id="select-all-collections" 
                            checked={allVisibleCollectionsSelected} 
                            onChange={(e) => handleSelectAllCollections(e.target.checked)} 
                            title="Выбрать все видимые на странице" 
                            className="float-start me-2" 
                            // Блокируем, если нет строк для выбора
                            disabled={sortedAndFilteredCollections.length === 0} 
                        /> Title / ID 
                    </th>
                    {/* Рендерим колонки из state projects (уже отфильтрованные) */} 
                    {visibleProjects.map(project => (
                        <th key={project.id}>{project.name}</th>
                    ))}
                    {shouldShowPromptColumn && <th>Prompt / Комментарий</th>} 
                 </tr>
            </thead>
            <tbody>
              {/* Индикатор перезагрузки */}
              {gridLoading && allProjectsList.length > 0 && (
                 <tr><td colSpan={2 + visibleProjects.length + (shouldShowPromptColumn ? 1 : 0)} className="text-center"><Spinner animation="border" size="sm" /> Обновление данных...</td></tr>
              )}
              {/* Рендерим строки, если не идет перезагрузка */}
              {!gridLoading && sortedAndFilteredCollections.map(collection => {
                 const positivePromptInvalid = !collection.collection_positive_prompt; 
                 const positiveStatus = fieldSaveStatus[collection.id]?.positive || {};
                 const negativeStatus = fieldSaveStatus[collection.id]?.negative || {};
                 const commentStatus = fieldSaveStatus[collection.id]?.comment || {};
                 
                 return (
                     <tr key={collection.id}>
                        <td> 
                            {/* Чекбокс выбора строки */}
                            <Form.Check 
                                type="checkbox" 
                                id={`collection-${collection.id}`} 
                                checked={selectedCollectionIds.has(collection.id)} 
                                onChange={(e) => handleCollectionSelectionChange(collection.id, e.target.checked)} 
                                className="float-start me-2" 
                            /> 
                            <div> 
                                <strong>{collection.name}</strong> <br /> 
                                <small className="text-muted">{collection.id}</small> 
                                {collection.type && (<Badge bg="secondary" className="ms-2">{collection.type}</Badge>)} 
                            </div> 
                        </td>
                          {/* Рендерим ячейки */} 
                          {visibleProjects.map(project => (
                             <GridCell 
                               key={`${collection.id}-${project.id}`}
                               // Используем ?. для безопасного доступа к ячейкам
                               cellData={collection.cells?.[project.id]} 
                               onClick={() => openSelectionModal(collection.id, project.id)}
                             />
                          ))}
                           {/* Колонка с промптами */}
                           {shouldShowPromptColumn && (
                              <td className="align-top position-relative"> 
                                 {/* ... код полей Positive/Negative/Comment ... */}
                                 {showPositivePrompt && ( <div className="position-relative mb-1"> <Form.Control as="textarea" rows={2} placeholder="Positive Prompt" value={collection.collection_positive_prompt || ''} onChange={(e) => handlePromptChange(collection.id, 'positive', e.target.value)} onBlur={(e) => handleAutoSaveCollectionField(collection.id, 'positive', e.target.value)} size="sm" className={`${positiveStatus.saved && !positivePromptInvalid ? 'border border-success' : ''}`} isInvalid={positivePromptInvalid && !positiveStatus.saved} /> <div className="position-absolute" style={{top: '5px', right: '5px'}}> {renderFieldStatus(collection.id, 'positive')} </div> </div> )}
                                 {showNegativePrompt && ( <div className="position-relative mb-1"> <Form.Control as="textarea" rows={1} placeholder="Negative Prompt" value={collection.collection_negative_prompt || ''} onChange={(e) => handlePromptChange(collection.id, 'negative', e.target.value)} onBlur={(e) => handleAutoSaveCollectionField(collection.id, 'negative', e.target.value)} size="sm" className={`${negativeStatus.saved ? 'border border-success' : ''}`} /> <div className="position-absolute" style={{top: '5px', right: '5px'}}> {renderFieldStatus(collection.id, 'negative')} </div> </div> )}
                                 {showCollectionComment && ( <div className="position-relative"> <Form.Control as="textarea" rows={1} placeholder="Комментарий" value={collection.comment || ''} onChange={(e) => handlePromptChange(collection.id, 'comment', e.target.value)} onBlur={(e) => handleAutoSaveCollectionField(collection.id, 'comment', e.target.value)} size="sm" className={`${commentStatus.saved ? 'border border-success' : ''}`} /> <div className="position-absolute" style={{top: '5px', right: '5px'}}> {renderFieldStatus(collection.id, 'comment')} </div> </div> )}
                              </td>
                          )}
                     </tr>
                  )
                })
              }
              {/* Сообщение, если после фильтрации/сортировки нет коллекций */}
              {!gridLoading && sortedAndFilteredCollections.length === 0 && (
                 <tr><td colSpan={2 + visibleProjects.length + (shouldShowPromptColumn ? 1 : 0)} className="text-center text-muted">Нет коллекций, соответствующих фильтрам.</td></tr>
              )}
            </tbody>
          </Table>
      )}
      
      {/* Модальные окна (без изменений) */}
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