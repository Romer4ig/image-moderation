import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { selectCover } from "../../../services/api"; // Импорт функции API

export const useAttemptSelection = (
  collectionId,
  activeProjectId,
  setTopRowItems,
  onSelectionConfirmed
) => {
  const queryClient = useQueryClient();
  const [selectedAttempt, setSelectedAttempt] = useState({
    generation_id: null,
    generated_file_id: null,
    file_url: null,
  });

  // --- Мутация для выбора обложки ---
  const { mutate: confirmSelectionMutate, isLoading: isSubmitting } = useMutation({
    mutationFn: selectCover,
    onSuccess: () => {
      // Инвалидируем кэш данных основной сетки по базовому ключу
      queryClient.invalidateQueries({ queryKey: ["grid-data-infinite"] });
      // Инвалидируем кэш данных для модального окна выбора
      queryClient.invalidateQueries({ queryKey: ["selectionData", collectionId, activeProjectId]});

      console.log("Selection confirmed successfully via mutation");
      onSelectionConfirmed();
    },
    onError: (err) => {
      console.error("Error confirming selection via mutation:", err);
      alert(`Ошибка при сохранении выбора: ${err.response?.data?.error || err.message}`);
    },
  });

  const handleAttemptClick = useCallback(
    (attempt) => {
      // --- УБИРАЕМ ПРОВЕРКУ НА ACTIVEPROJECTID ---
      // if (attempt.project_id !== activeProjectId) {
      //     console.warn(`Attempt ${attempt.id} clicked, but it belongs to project ${attempt.project_id}, while active project is ${activeProjectId}. Ignoring click.`);
      //     return; 
      // }
      // --- КОНЕЦ УДАЛЕНИЯ ---
      
      setSelectedAttempt({
        generation_id: attempt.generation_id,
        generated_file_id: attempt.generated_file_id,
        file_url: attempt.file_url,
      });
      // Обновляем превью в верхнем ряду для АКТИВНОГО проекта
      setTopRowItems((prevItems) =>
        prevItems.map((item) =>
          item.project_id === activeProjectId
            ? { ...item, selected_cover_url: attempt.file_url } // Используем URL напрямую
            : item
        )
      );
    },
    [activeProjectId, setTopRowItems] // Добавляем activeProjectId в зависимости
  );

  const handleConfirmSelection = useCallback(async () => {
    if (!selectedAttempt.generated_file_id) { // Проверяем generated_file_id, т.к. generation_id может быть не уникальным между проектами
      alert("Пожалуйста, выберите изображение из нижнего списка.");
      return;
    }

    // Вызываем мутацию, используя activeProjectId
    console.log("Confirming selection with:", {
        collectionId,
        projectId: activeProjectId,
        generationId: selectedAttempt.generation_id,
        generatedFileId: selectedAttempt.generated_file_id,
      }); // <-- Добавляем лог перед вызовом мутации
    confirmSelectionMutate({
      collectionId: String(collectionId), // <--- Преобразуем в строку
      projectId: activeProjectId, // <--- Используем activeProjectId!
      generationId: selectedAttempt.generation_id,
      generatedFileId: selectedAttempt.generated_file_id,
    });
  }, [collectionId, activeProjectId, selectedAttempt, confirmSelectionMutate]); // Добавляем activeProjectId в зависимости

  return {
    selectedAttempt,
    isSubmitting, 
    handleAttemptClick,
    handleConfirmSelection,
  };
};
