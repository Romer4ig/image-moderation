import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Импортируем axios
import SelectionModal from './SelectionModal'; // Импортируем модалку
import './GenerationGrid.css'; // Используем правильный импорт

const API_URL = 'http://localhost:5001/api'; // Базовый URL API

// Компонент для отображения ячейки грида
const GridCell = ({ cellData, onClick }) => {
  if (!cellData) {
    return <td className="grid-cell empty">-</td>;
  }

  let content = null;
  let cellClass = "grid-cell";

  // Добавляем класс, если ячейка кликабельна
  const isClickable = cellData.status === 'generated_not_selected' || cellData.status === 'selected';
  if (isClickable) {
       cellClass += " clickable";
  }

  switch (cellData.status) {
    case 'not_generated':
      content = "Не сгенерировано";
      cellClass += " not-generated";
      break;
    case 'queued':
      content = "В очереди...";
      cellClass += " queued";
      break;
    case 'error':
      content = `Ошибка: ${cellData.error_message || 'Неизвестно'}`;
      cellClass += " error";
      break;
    case 'generated_not_selected':
    case 'selected':
      if (cellData.file_url) {
        content = <img src={cellData.file_url} alt={`Gen ${cellData.generation_id}`} className="thumbnail" />;
      } else {
        content = "Нет файла"; // Ошибка: статус completed, но нет файла
        cellClass += " error";
      }
      if (cellData.status === 'selected') {
           cellClass += " selected"; // Добавляем класс для выбранных
      }
      break;
    default:
      content = "Неизвестный статус";
      cellClass += " unknown";
  }

  const handleClick = () => {
      if (onClick && isClickable) {
         onClick(); // Передаем управление наружу
      } else {
         console.log('Clicked on non-selectable cell with status:', cellData?.status)
      }
  };

  return (
    <td className={cellClass} onClick={handleClick}>
      {content}
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
  // Убираем локальные состояния loading, error, collections
  const [projects, setProjects] = useState([]); 
  const [visibleProjectIds, setVisibleProjectIds] = useState(new Set()); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [statusFilter, setStatusFilter] = useState('all');
  // Состояние для выбранных коллекций
  const [selectedCollectionIds, setSelectedCollectionIds] = useState(new Set());
  // Состояние для индикации процесса запуска генерации
  const [isSubmittingGenerations, setIsSubmittingGenerations] = useState(false);
  // Состояние для модального окна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContext, setModalContext] = useState({ collectionId: null, projectId: null });
  
  // Переименуем функцию загрузки для ясности
  const fetchGridData = useCallback(() => {
      // Не сбрасываем loading/error здесь, так как это может быть вызвано для обновления
      // setGridLoading(true); 
      axios.get(`${API_URL}/grid-data`)
        .then(response => {
          const fetchedProjects = response.data.projects || [];
          setProjects(fetchedProjects);
          setCollections(response.data.collections || []); 
          // Устанавливаем видимые проекты только если они еще не установлены
          setVisibleProjectIds(prev => prev.size === 0 ? new Set(fetchedProjects.map(p => p.id)) : prev);
          setGridError(null);
        })
        .catch(err => {
          console.error("Error fetching grid data:", err);
          setGridError("Не удалось загрузить данные для грида.");
          setProjects([]);
          setCollections([]);
        })
        .finally(() => {
          setGridLoading(false); // Устанавливаем loading в false только после завершения
        });
   }, [setCollections, setGridError, setGridLoading]); // Зависимости

  useEffect(() => {
    setGridLoading(true); // Устанавливаем loading в true перед первым вызовом
    fetchGridData(); // Вызываем загрузку данных
  }, [fetchGridData, setGridLoading]); // Зависимость от функции загрузки

  // Используем gridLoading и gridError из props
  if (gridLoading) {
    return <div>Загрузка данных грида...</div>;
  }

  if (gridError) {
    return <div style={{ color: 'red' }}>{gridError}</div>;
  }

  // Обработчик изменения фильтра проектов
  const handleProjectFilterChange = (projectId, isChecked) => {
    setVisibleProjectIds(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  };

  // Обработчик для чекбокса "Все"
  const handleSelectAllProjects = (isChecked) => {
    if (isChecked) {
        setVisibleProjectIds(new Set(projects.map(p => p.id)));
    } else {
        setVisibleProjectIds(new Set());
    }
  };
  
  // Фильтруем проекты для отображения
  const visibleProjects = projects.filter(p => visibleProjectIds.has(p.id));
  const allProjectsSelected = projects.length > 0 && visibleProjectIds.size === projects.length;

  // Фильтруем коллекции перед рендерингом
  const filteredCollections = collections.filter(collection => {
    // Фильтр по названию
    const nameMatch = collection.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!nameMatch) return false;

    // Фильтр по статусу
    if (statusFilter === 'all') {
        return true; // Показываем все, если 'all'
    }

    // Проверяем статусы ячеек только для видимых проектов
    let hasStatusMatch = false;
    if (collection.cells) {
        for (const projectId of visibleProjectIds) {
             const cellData = collection.cells[projectId];
             if (!cellData) continue; // Пропускаем, если данных для ячейки нет

             if (statusFilter === 'not_selected' && cellData.status === 'generated_not_selected') {
                 hasStatusMatch = true;
                 break;
             }
             if (statusFilter === 'not_generated' && cellData.status === 'not_generated') {
                 hasStatusMatch = true;
                 break;
             }
        }
    }
    return hasStatusMatch;

  });

  // Обработчик изменения выбора коллекции
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
  
  // Обработчик для чекбокса "Выбрать все коллекции"
  const handleSelectAllCollections = (isChecked) => {
      if (isChecked) {
          // Выбираем только видимые (отфильтрованные) коллекции
          setSelectedCollectionIds(new Set(filteredCollections.map(c => c.id)));
      } else {
          setSelectedCollectionIds(new Set());
      }
  };
  
  // Обработчик кнопки "Сгенерировать выбранные"
  const handleGenerateSelected = async () => {
    if (selectedCollectionIds.size === 0 || visibleProjectIds.size === 0) {
        alert("Пожалуйста, выберите хотя бы одну коллекцию и один проект.");
        return;
    }

    setIsSubmittingGenerations(true);
    const pairsToGenerate = [];

    // Собираем пары (collection_id, project_id) для генерации
    selectedCollectionIds.forEach(collectionId => {
        const collection = collections.find(c => c.id === collectionId);
        if (collection && collection.cells) {
            visibleProjectIds.forEach(projectId => {
                const cellData = collection.cells[projectId];
                // Добавляем в очередь, если ячейка не сгенерирована или ее нет
                if (!cellData || cellData.status === 'not_generated') {
                    pairsToGenerate.push({ project_id: projectId, collection_id: collectionId });
                }
            });
        }
    });

    if (pairsToGenerate.length === 0) {
        alert("Нет ячеек для генерации среди выбранных коллекций и видимых проектов (уже сгенерированы?).");
        setIsSubmittingGenerations(false);
        return;
    }

    try {
        console.log("Sending pairs to generate:", pairsToGenerate);
        // Вызываем API бэкенда
        const response = await axios.post(`${API_URL}/generate-batch`, { pairs: pairsToGenerate });
        console.log("Generate batch response:", response.data);
        // TODO: Показать уведомление об успехе/ошибках из response.data
        alert(`Задачи отправлены. Запущено: ${response.data.tasks_started?.length || 0}. Ошибки: ${response.data.errors?.length || 0}`);
        
        // Опционально: Оптимистичное обновление UI на статус "queued"
        // Это можно сделать, пройдясь по pairsToGenerate и обновив состояние collections
        // Но WebSocket сделает это надежнее, так что пока пропустим

    } catch (err) {
        console.error("Error calling generate-batch API:", err);
        alert(`Ошибка при отправке задач генерации: ${err.response?.data?.error || err.message}`);
    } finally {
        setIsSubmittingGenerations(false);
    }
  };
  
  // Определяем, выбраны ли все видимые коллекции
  const allCollectionsSelected = filteredCollections.length > 0 && selectedCollectionIds.size === filteredCollections.length;

  // --- Логика Модального Окна --- 
  const openSelectionModal = (collectionId, projectId) => {
    setModalContext({ collectionId, projectId });
    setIsModalOpen(true);
  };

  const closeSelectionModal = () => {
    setIsModalOpen(false);
    setModalContext({ collectionId: null, projectId: null });
  };
  
  // Колбэк после подтверждения выбора в модалке
  const handleSelectionConfirmed = () => {
      console.log('Selection confirmed in modal, refreshing grid data...');
      fetchGridData(); // Перезагружаем данные грида для отображения нового статуса "Выбрано"
      // TODO: Можно реализовать более тонкое обновление через WebSocket или локально
  };

  return (
    <div className="grid-container">
        <h2>Сравнение и выбор обложек</h2>
        
        {/* --- Фильтры Проектов --- */} 
        <div className="filters project-filters">
            <h4>Проекты:</h4>
            <label>
                <input 
                    type="checkbox"
                    checked={allProjectsSelected}
                    onChange={(e) => handleSelectAllProjects(e.target.checked)}
                />
                Все
            </label>
            {projects.map(project => (
                <label key={project.id} style={{ marginLeft: '10px' }}>
                    <input 
                        type="checkbox"
                        checked={visibleProjectIds.has(project.id)}
                        onChange={(e) => handleProjectFilterChange(project.id, e.target.checked)}
                    />
                    {project.name}
                </label>
            ))}
        </div>

        {/* --- Фильтры Коллекций и Действия --- */} 
        <div className="filters collection-filters" style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
             {/* TODO: Кнопки Сортировка, Фильтр, Тип */}

             <input 
                 type="text"
                 placeholder="Найти сборник..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 style={{ padding: '5px' }}
             />
             {/* <button>🔍</button> */}

             <div className="status-filters" style={{ marginLeft: 'auto' }}>
                 <button onClick={() => setStatusFilter('all')} disabled={statusFilter === 'all'}>Все</button>
                 <button onClick={() => setStatusFilter('not_selected')} disabled={statusFilter === 'not_selected'}>Не выбрано</button>
                 <button onClick={() => setStatusFilter('not_generated')} disabled={statusFilter === 'not_generated'}>Не сгенерировано</button>
             </div>
             
             {/* --- Кнопки Действий --- */} 
             <div className="action-buttons" style={{ marginLeft: '20px' }}>
                {/* TODO: Кнопка "Добавить сборник" */} 
                <button 
                    onClick={handleGenerateSelected} 
                    disabled={isSubmittingGenerations || selectedCollectionIds.size === 0 || visibleProjectIds.size === 0}
                >
                    {isSubmittingGenerations ? 'Отправка...' : 'Сгенерировать выбранные'}
                </button>
             </div>
        </div>
        
        <div className="grid-table-wrapper">
            <table className="generation-grid-table">
                <thead>
                    <tr>
                        <th>
                            {/* Чекбокс "Выбрать все" */} 
                            <input 
                                type="checkbox"
                                title="Выбрать все видимые"
                                checked={allCollectionsSelected}
                                onChange={(e) => handleSelectAllCollections(e.target.checked)}
                                disabled={filteredCollections.length === 0}
                            />
                            Сборник
                        </th>
                        {/* Используем отфильтрованный список */} 
                        {visibleProjects.map(project => (
                            <th key={project.id}>{project.name}</th>
                        ))}
                        <th>Промпт (Выбранной ячейки)</th> {/* Placeholder */} 
                    </tr>
                </thead>
                <tbody>
                    {/* Используем отфильтрованный список коллекций */} 
                    {filteredCollections.map(collection => (
                        <tr key={collection.id}>
                            <td>
                                {/* Чекбокс выбора строки */} 
                                <input 
                                     type="checkbox"
                                     checked={selectedCollectionIds.has(collection.id)}
                                     onChange={(e) => handleCollectionSelectionChange(collection.id, e.target.checked)}
                                />
                                <div>{collection.id.substring(0,6)}...</div>
                                <div><strong>{collection.name}</strong></div>
                                {/* TODO: Отображать теги (collection.type?) */} 
                            </td>
                            {/* Используем отфильтрованный список проектов */} 
                            {visibleProjects.map(project => {
                                const cellData = collection.cells ? collection.cells[project.id] : null;
                                return (
                                    <GridCell 
                                        key={`${collection.id}-${project.id}`}
                                        cellData={cellData}
                                        // Передаем обработчик для открытия модалки
                                        onClick={() => openSelectionModal(collection.id, project.id)}
                                    />
                                );
                            })}
                            <td> {/* Placeholder для промпта */} 
                                --- 
                            </td>
                        </tr>
                    ))}
                    {/* Условный рендеринг, если после фильтрации ничего не осталось */} 
                    {filteredCollections.length === 0 && (
                         <tr>
                             <td colSpan={visibleProjects.length + 2}>Нет коллекций, соответствующих фильтрам.</td>
                         </tr>
                    )}
                </tbody>
            </table>
        </div> {/* Закрываем grid-table-wrapper */} 
        
        {/* --- Модальное окно Выбора --- */} 
        <SelectionModal 
            isOpen={isModalOpen}
            onClose={closeSelectionModal}
            collectionId={modalContext.collectionId}
            projectId={modalContext.projectId}
            onSelectionConfirmed={handleSelectionConfirmed} 
        />
    </div> // Закрываем grid-container
  );
};

export default GenerationGrid;
