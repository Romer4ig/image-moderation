import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './SelectionModal.css'; // <-- Раскомментируем

// Импорты react-bootstrap
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Image from 'react-bootstrap/Image';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Form from 'react-bootstrap/Form';
// Убираем Dropdown
// import Dropdown from 'react-bootstrap/Dropdown'; 

// Импортируем нужную иконку
import { CheckCircleFill } from 'react-bootstrap-icons';

const API_URL = 'http://localhost:5001/api';

const SelectionModal = ({ show, onHide, collectionId, projectId, onSelectionConfirmed }) => { // Переименовали isOpen/onClose в show/onHide
  const [modalData, setModalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Состояние для предпросмотра/выбора в нижней сетке
  const [selectedAttempt, setSelectedAttempt] = useState({ generation_id: null, generated_file_id: null, file_url: null });
  // Состояние для данных верхнего ряда (для обновления при предпросмотре)
  const [topRowItems, setTopRowItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Новые состояния
  const [selectedProjectIds, setSelectedProjectIds] = useState([]); // ID выбранных чекбоксами проектов
  const [displayedAttempts, setDisplayedAttempts] = useState([]); // Генерации для отображения внизу
  const [loadingAttempts, setLoadingAttempts] = useState(false); // Загрузка генераций при смене чекбоксов

  const fetchModalBaseData = useCallback(async () => {
    if (!show || !collectionId || !projectId) return;

    setLoading(true);
    setError(null);
    setSelectedAttempt({ generation_id: null, generated_file_id: null, file_url: null });
    setDisplayedAttempts([]); // Сбрасываем отображаемые генерации
    setSelectedProjectIds([projectId]); // Выбираем только начальный проект

    try {
      // Запрашиваем данные ТОЛЬКО для основного проекта, чтобы получить top_row и target_project
      const response = await axios.get(`${API_URL}/selection-data`, {
        params: { collection_id: collectionId, project_id: projectId } 
      });
      setModalData(response.data); // Сохраняем основные данные
      setTopRowItems(response.data.top_row_projects || []);
      // Устанавливаем начальный выбор, если он есть для основного проекта
      const currentSelection = response.data.top_row_projects?.find(p => p.project_id === projectId)?.selected_cover;
      if (currentSelection) {
          setSelectedAttempt(currentSelection);
      }
      // НЕ сохраняем generation_attempts отсюда, их загрузит другой эффект
    } catch (err) {
      console.error("Error fetching base modal data:", err);
      setError("Не удалось загрузить основные данные модального окна.");
      setModalData(null);
      setTopRowItems([]);
    } finally {
      setLoading(false);
    }
  }, [show, collectionId, projectId]);

  // Загрузка и объединение генераций для выбранных проектов
  const fetchAndCombineAttempts = useCallback(async (projectIdsToFetch) => {
      if (!collectionId || projectIdsToFetch.length === 0) {
          setDisplayedAttempts([]);
          return;
      }

      setLoadingAttempts(true);
      setError(null); // Сбрасываем предыдущие ошибки связанные с загрузкой попыток
      
      try {
          const requests = projectIdsToFetch.map(pid => 
              axios.get(`${API_URL}/selection-data`, {
                  params: { collection_id: collectionId, project_id: pid }
              })
          );
          const responses = await Promise.all(requests);
          
          let combinedAttempts = [];
          responses.forEach(response => {
              if (response.data && response.data.generation_attempts) {
                  // Добавляем project_id к каждой попытке, чтобы знать откуда она
                  const attemptsWithProjectId = response.data.generation_attempts.map(att => ({...att, origin_project_id: response.data.target_project.id})); 
                  combinedAttempts = combinedAttempts.concat(attemptsWithProjectId);
              }
          });
          
          // Убираем дубликаты на всякий случай (если одна генерация попала в разные проекты? Маловероятно, но все же)
          const uniqueAttempts = Array.from(new Map(combinedAttempts.map(att => [att.generated_file_id, att])).values());
          
          setDisplayedAttempts(uniqueAttempts);
          
      } catch (err) {
          console.error("Error fetching generation attempts:", err);
          setError("Ошибка при загрузке вариантов генераций для выбранных проектов.");
          setDisplayedAttempts([]); // Очищаем при ошибке
      } finally {
          setLoadingAttempts(false);
      }
  }, [collectionId]);

  // Эффект для загрузки основных данных при открытии
  useEffect(() => {
    fetchModalBaseData();
  }, [fetchModalBaseData]);

  // Эффект для загрузки генераций при изменении выбранных проектов
  useEffect(() => {
      // Загружаем генерации только если основные данные загружены и есть выбранные проекты
      if (modalData && selectedProjectIds.length > 0) { 
          fetchAndCombineAttempts(selectedProjectIds);
      }
       // Если список выбранных проектов пуст (хотя инициализируем с одним), очищаем
      if (selectedProjectIds.length === 0) {
          setDisplayedAttempts([]);
      }
  }, [selectedProjectIds, modalData, fetchAndCombineAttempts]); // Зависим от selectedProjectIds и modalData

  // Обработчик изменения состояния чекбокса
  const handleCheckboxChange = (event) => {
      const { value, checked } = event.target;
      // Убираем parseInt, оставляем ID как строку (UUID)
      const projectIdValue = value; 
      
      setSelectedProjectIds(prevSelectedIds => {
          if (checked) {
              // Добавляем ID, если его еще нет
              return [...new Set([...prevSelectedIds, projectIdValue])];
          } else {
              // Удаляем ID
              return prevSelectedIds.filter(id => id !== projectIdValue);
          }
      });
  };

  const handleAttemptClick = (attempt) => {
    setSelectedAttempt({
        generation_id: attempt.generation_id,
        generated_file_id: attempt.generated_file_id,
        file_url: attempt.file_url
    });
    // Обновляем верхний ряд для предпросмотра **основного** проекта
    setTopRowItems(prevItems => 
        prevItems.map(item => 
            item.project_id === projectId // Все еще обновляем только для основного projectId
            ? { ...item, selected_cover: { ...attempt, isPreview: true } } 
            : item
        )
    );
  };

  const handleConfirmSelection = async () => {
    if (!selectedAttempt.generation_id) {
      alert("Пожалуйста, выберите изображение из нижнего списка.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Сохраняем выбор **только** для основного projectId
      await axios.post(`${API_URL}/select-cover`, {
        collection_id: collectionId,
        project_id: projectId, 
        generation_id: selectedAttempt.generation_id,
        generated_file_id: selectedAttempt.generated_file_id
      });
      console.log('Selection confirmed successfully');
      onSelectionConfirmed(); 
      onHide(); 
    } catch (err) {
      console.error("Error confirming selection:", err);
      alert(`Ошибка при сохранении выбора: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Не рендерим через return null, Modal сам управляет видимостью через props.show
  
  // Функция для рендеринга контента модалки
  const renderModalContent = () => {
      // Возвращаем старую логику загрузки
      if (loading) {
          return <div className="text-center p-5"><Spinner animation="border" /> Загрузка...</div>;
      }
      if (error) {
          return <Alert variant="danger">{error}</Alert>;
      }
      // Возвращаем старую проверку на modalData
      if (!modalData) {
           return <Alert variant="warning">Нет данных для отображения.</Alert>;
      }
      
      return (
        <>
          {/* Верхний ряд без изменений */}
          <div className="top-row-scroll mb-3"> 
            <Row className="flex-nowrap"> 
              {topRowItems.map(item => (
                 <Col key={item.project_id} xs="auto" 
                      className={`text-center p-1`} 
                 > 
                  <small className="d-block text-truncate fw-medium" style={{ fontSize: '0.75rem' }} title={item.project_name}>{item.project_name}</small>
                  {item.selected_cover ? (
                    <Image 
                       src={item.selected_cover.file_url} 
                       thumbnail 
                       className={`top-row-thumb`}
                       alt={`Selected for ${item.project_name}`} 
                    />
                  ) : (
                    <div className="placeholder-thumb bg-light d-flex align-items-center justify-content-center text-muted small">
                       Не выбрано
                    </div>
                  )}
                 </Col>
              ))}
             </Row>
           </div>

          {/* --- Секция Выбора --- */}
          {/* Возвращаем старый заголовок */}
          <h5 className="mt-4 fw-semibold">Выбор обложки для проекта "{modalData.target_project?.name}"</h5>
          <Row className="align-items-center mb-3">
             <Col xs="auto">
                 <Form.Label className="me-2 mb-0 fw-medium">Показывать генерации для:</Form.Label>
             </Col>
             <Col>
                {/* Возвращаем чекбоксы */} 
                {modalData.top_row_projects && modalData.top_row_projects.length > 0 ? (
                    modalData.top_row_projects.map(p => (
                       <Form.Check 
                           inline 
                           type="checkbox" 
                           key={p.project_id} 
                           id={`cb-${p.project_id}`} 
                           label={p.project_name} 
                           value={p.project_id} // Добавляем value
                           checked={selectedProjectIds.includes(p.project_id)} // Используем selectedProjectIds
                           onChange={handleCheckboxChange} // Используем новый обработчик
                       />
                    ))
                ) : (
                    <span className="text-muted">Нет доступных проектов для фильтрации.</span>
                )}
             </Col>
          </Row>
          {/* Возвращаем старую строку с комментарием и кнопкой */}
           <Row className="align-items-center mb-3">
             <Col md={8}>
                <Form.Control 
                   as="textarea" 
                   rows={1} 
                   placeholder="Комментарий: Ну картинки сильно одинаковые, перегенерируйте"
                   // Убираем disabled
                   // disabled 
                />
             </Col>
             <Col md={4} className="text-end">
                <Button variant="outline-primary" /* Убираем disabled */>Отправить</Button>
             </Col>
          </Row>
          
          {/* --- Нижняя сетка: Варианты для выбора --- */} 
           {/* Индикатор загрузки для генераций */} 
           {loadingAttempts && (
               <div className="text-center p-3"><Spinner animation="border" size="sm" /> Загрузка вариантов...</div>
           )} 
           {/* Показываем сетку, если не идет загрузка */} 
           {!loadingAttempts && (
               <Row className="g-0 bottom-grid-scroll">
                   {displayedAttempts.length > 0 ? (
                       displayedAttempts.map(attempt => (
                           <Col xs="auto" key={attempt.generated_file_id}> 
                               <div 
                                   className={`bottom-grid-item position-relative clickable ${selectedAttempt.generated_file_id === attempt.generated_file_id ? 'selected-border' : ''}`}
                                   onClick={() => handleAttemptClick(attempt)}
                               >
                                   <Image 
                                       src={attempt.file_url} 
                                       alt={`Attempt ${attempt.generation_id} (Project ${attempt.origin_project_id})`} 
                                   />
                                   {selectedAttempt.generated_file_id === attempt.generated_file_id && (
                                       <CheckCircleFill size={24} className="text-primary position-absolute top-0 end-0 m-1 bg-white rounded-circle"/>
                                   )}
                                   {/* Можно добавить маленькую плашку с ID проекта, если нужно визуально различать */} 
                                   {/* <span className="position-absolute bottom-0 start-0 badge bg-secondary m-1 opacity-75">P: {attempt.origin_project_id}</span> */} 
                               </div>
                           </Col>
                       ))
                   ) : (
                       // Сообщение, если после загрузки попыток нет
                       <Col><p>Нет завершенных генераций для выбранных проектов и коллекции.</p></Col>
                   )}
               </Row>
           )}
        </>
      );
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered backdrop="static"> {/* centered, backdrop=static */} 
      <Modal.Header closeButton>
        <Modal.Title as="h6">Выбранные обложки для сборника "{modalData?.collection?.name}"</Modal.Title>
      </Modal.Header>
      <Modal.Body className="px-3" style={{ maxHeight: '70vh', overflowY: 'auto' }}> {/* Ограничение высоты и прокрутка */} 
        {renderModalContent()} {/* Выносим рендер контента в функцию */} 
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>Отмена</Button>
        <Button 
          variant="primary" 
          onClick={handleConfirmSelection}
          // Блокируем, если нет выбора или идет отправка ИЛИ идет загрузка основных данных
          disabled={!selectedAttempt.generated_file_id || isSubmitting || loading} 
        >
          {isSubmitting ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true"/> Сохранение...</> : 'Установить выбранную'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SelectionModal;

// --- Стили для добавления в CSS (например, App.css) --- 
/*
.top-row-scroll {
  overflow-x: auto;
}
.top-row-thumb {
  height: 60px; // Фиксированная высота для миниатюр вверху
  width: auto; 
  object-fit: contain;
}
.placeholder-thumb {
  height: 60px; 
  width: 80px; // Примерная ширина
}

.bottom-grid-scroll {
  max-height: 400px; // Ограничение высоты сетки выбора
  overflow-y: auto;
  padding-top: 10px;
}

.bottom-grid-item.selected-border {
   outline: 3px solid #0d6efd; 
   outline-offset: -2px;
}
.clickable {
  cursor: pointer;
}
*/
