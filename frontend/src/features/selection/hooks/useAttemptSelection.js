import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { selectCover } from "../../../services/api"; // Импорт функции API

export const useAttemptSelection = (collectionId, projectId, setTopRowItems, onSelectionConfirmed, onHide) => {
  const queryClient = useQueryClient();
  const [selectedAttempt, setSelectedAttempt] = useState({
    generation_id: null,
    generated_file_id: null,
    file_url: null,
  });

  // --- Мутация для выбора обложки --- 
  const { 
      mutate: confirmSelectionMutate, 
      isLoading: isSubmitting, // Используем isLoading из мутации
      error // Получаем ошибку из мутации
  } = useMutation({
      mutationFn: selectCover,
      onSuccess: () => {
          // Инвалидируем кэши после успешного выбора
          queryClient.invalidateQueries(['gridData']);
          // Инвалидируем кэш для текущей модалки, если нужно обновить topRowItems из API
          // queryClient.invalidateQueries(['selectionData', collectionId, projectId]); 
          
          console.log("Selection confirmed successfully via mutation");
          onSelectionConfirmed(); // Внешний callback
          onHide(); // Закрываем модалку
      },
      onError: (err) => {
          console.error("Error confirming selection via mutation:", err);
          alert(`Ошибка при сохранении выбора: ${err.response?.data?.error || err.message}`);
          // isSubmitting автоматически станет false
      }
  });

  const handleAttemptClick = useCallback((attempt) => {
      setSelectedAttempt({
        generation_id: attempt.generation_id,
        generated_file_id: attempt.generated_file_id,
        file_url: attempt.file_url,
      });
      setTopRowItems((prevItems) =>
        prevItems.map((item) =>
          item.project_id === projectId
            ? { ...item, selected_cover: { ...attempt, isPreview: true } }
            : item
        )
      );
    }, [projectId, setTopRowItems]);

  const handleConfirmSelection = useCallback(async () => {
      if (!selectedAttempt.generation_id) {
        alert("Пожалуйста, выберите изображение из нижнего списка.");
        return;
      }
      
      // Вызываем мутацию
      confirmSelectionMutate({
          collectionId,
          projectId,
          generationId: selectedAttempt.generation_id,
          generatedFileId: selectedAttempt.generated_file_id,
      });

    }, [collectionId, projectId, selectedAttempt, confirmSelectionMutate, onSelectionConfirmed, onHide]);

  return {
    selectedAttempt,
    isSubmitting, // Передаем isLoading из мутации
    // error, // Передаем ошибку, если нужно отобразить в UI модалки
    handleAttemptClick,
    handleConfirmSelection,
  };
}; 