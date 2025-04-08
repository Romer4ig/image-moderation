import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './SelectionModal.css'; // Создадим файл стилей

const API_URL = 'http://localhost:5001/api';

const SelectionModal = ({ isOpen, onClose, collectionId, projectId, onSelectionConfirmed }) => {
  const [modalData, setModalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Состояние для предпросмотра/выбора в нижней сетке
  const [selectedAttempt, setSelectedAttempt] = useState({ generation_id: null, generated_file_id: null, file_url: null });
  // Состояние для данных верхнего ряда (для обновления при предпросмотре)
  const [topRowItems, setTopRowItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isOpen || !collectionId || !projectId) return;

    setLoading(true);
    setError(null);
    setSelectedAttempt({ generation_id: null, generated_file_id: null, file_url: null }); // Сбрасываем выбор

    try {
      const response = await axios.get(`${API_URL}/selection-data`, {
        params: { collection_id: collectionId, project_id: projectId }
      });
      setModalData(response.data);
      setTopRowItems(response.data.top_row_projects || []); // Инициализируем верхний ряд
      
      // Устанавливаем начальный предпросмотр на текущую выбранную обложку для этого проекта (если есть)
      const currentSelection = response.data.top_row_projects?.find(p => p.project_id === projectId)?.selected_cover;
      if (currentSelection) {
          setSelectedAttempt(currentSelection);
      }

    } catch (err) {
      console.error("Error fetching selection data:", err);
      setError("Не удалось загрузить данные для выбора.");
      setModalData(null);
      setTopRowItems([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, collectionId, projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Перезагружаем данные при изменении isOpen, collectionId, projectId

  // Обработчик клика по миниатюре в нижней сетке (предпросмотр)
  const handleAttemptClick = (attempt) => {
    setSelectedAttempt({
        generation_id: attempt.generation_id,
        generated_file_id: attempt.generated_file_id,
        file_url: attempt.file_url
    });
    // Обновляем верхний ряд для предпросмотра
    setTopRowItems(prevItems => 
        prevItems.map(item => 
            item.project_id === projectId 
            ? { ...item, selected_cover: { ...attempt, isPreview: true } } // Помечаем как превью
            : item
        )
    );
  };

  // Обработчик кнопки "Установить выбранную"
  const handleConfirmSelection = async () => {
    if (!selectedAttempt.generation_id) {
      alert("Пожалуйста, выберите изображение из нижнего списка.");
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/select-cover`, {
        collection_id: collectionId,
        project_id: projectId, // Проект, для которого делаем выбор
        generation_id: selectedAttempt.generation_id,
        generated_file_id: selectedAttempt.generated_file_id
      });
      console.log('Selection confirmed successfully');
      onSelectionConfirmed(); // Вызываем колбэк для обновления основного грида
      onClose(); // Закрываем модалку
    } catch (err) {
      console.error("Error confirming selection:", err);
      alert(`Ошибка при сохранении выбора: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null; // Не рендерим модалку, если она закрыта
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-button" onClick={onClose}>X</button>
        
        {loading && <div>Загрузка...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        
        {modalData && (
          <>
            {/* --- Верхний ряд: Выбранные обложки --- */} 
            <h3>Выбранные обложки для сборника "{modalData.collection?.name}"</h3>
            <div className="top-row">
              {topRowItems.map(item => (
                <div key={item.project_id} 
                     className={`top-row-item ${item.project_id === projectId ? 'target-project' : ''} ${item.selected_cover?.isPreview ? 'preview' : ''}`}>
                  <span className="project-name">{item.project_name}</span>
                  {item.selected_cover ? (
                    <img src={item.selected_cover.file_url} alt={`Selected for ${item.project_name}`} className="thumbnail small" />
                  ) : (
                    <div className="placeholder">Не выбрано</div>
                  )}
                </div>
              ))}
            </div>

            {/* --- Нижняя сетка: Варианты для выбора --- */} 
            <h4 style={{ marginTop: '20px' }}>Выбор обложки для проекта "{modalData.target_project?.name}"</h4>
            {/* TODO: Фильтры для нижней сетки? */}
            {/* TODO: Поле комментария? */}
            <div className="bottom-grid">
              {modalData.generation_attempts && modalData.generation_attempts.length > 0 ? (
                modalData.generation_attempts.map(attempt => (
                  <div 
                    key={attempt.generation_id} 
                    className={`bottom-grid-item ${selectedAttempt.generation_id === attempt.generation_id ? 'selected' : ''}`}
                    onClick={() => handleAttemptClick(attempt)}
                  >
                    <img src={attempt.file_url} alt={`Attempt ${attempt.generation_id}`} className="thumbnail" />
                    {/* Можно добавить дату генерации: {new Date(attempt.created_at).toLocaleString()} */}
                  </div>
                ))
              ) : (
                <p>Нет завершенных генераций для этого проекта и коллекции.</p>
              )}
            </div>

            {/* --- Кнопка подтверждения --- */} 
            <div className="modal-actions">
              <button 
                onClick={handleConfirmSelection}
                disabled={!selectedAttempt.generation_id || isSubmitting}
              >
                {isSubmitting ? 'Сохранение...' : 'Установить выбранную'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectionModal;
