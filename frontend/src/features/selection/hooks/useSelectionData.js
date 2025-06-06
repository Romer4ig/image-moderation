import React, { useState, useEffect } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { getSelectionShell, getProjectAttempts } from "../../../services/api";

export const useSelectionData = (show, collectionId, initialProjectId) => {
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);

  // 1. При открытии модалки, сбрасываем состояние и устанавливаем начальный проект
  useEffect(() => {
    if (show && initialProjectId) {
      setSelectedProjectIds([initialProjectId]);
    } else if (!show) {
      setSelectedProjectIds([]);
    }
  }, [show, initialProjectId]);

  // 2. Основной запрос для "оболочки" модалки (список проектов, таргет и т.д.)
  const { data: shellData, isLoading: isLoadingShell, error } = useQuery({
    queryKey: ["selectionShell", collectionId, initialProjectId],
    queryFn: () => getSelectionShell(collectionId, initialProjectId),
    enabled: show && !!collectionId && !!initialProjectId,
    staleTime: 5 * 60 * 1000, // Кэшируем на 5 минут
    keepPreviousData: true,
  });

  // 3. Динамические запросы для генераций каждого выбранного проекта
  const attemptQueries = useQueries({
    queries: selectedProjectIds.map(projectId => ({
      queryKey: ["projectAttempts", collectionId, projectId],
      queryFn: () => getProjectAttempts(collectionId, projectId),
      enabled: show && !!collectionId,
      staleTime: 5 * 60 * 1000,
    }))
  });
  
  // 4. Обработчик чекбоксов
  const handleCheckboxChange = (event) => {
    const { value, checked } = event.target;
    const projectId = value; // ID - это строка (UUID), parseInt был ошибкой
    setSelectedProjectIds((prev) =>
      checked ? [...prev, projectId] : prev.filter((id) => id !== projectId)
    );
  };

  // 5. Мемоизация и трансформация данных
  const { topRowItems, displayedAttempts, loadingAttempts, persistedSelectedFileId } = React.useMemo(() => {
    const isLoading = attemptQueries.some(q => q.isLoading);

    // "Разворачиваем" результаты всех запросов в один плоский массив
    const allAttempts = attemptQueries
      .filter(q => q.isSuccess && q.data)
      .flatMap(q => q.data);

    // Трансформируем данные для отображения
    const mappedAttempts = allAttempts.flatMap(attempt => 
      (attempt.generated_files || []).map(file => ({
        ...attempt,
        generated_file_id: file.id,
        file_url: file.url,
        generation_id: attempt.id, 
      }))
    ).filter(Boolean);

    // Данные для верхнего ряда
    const mappedTopRowProjects = (shellData?.top_row_projects || []).map(p => ({
      ...p,
      project_id: p.id,
      project_name: p.name,
      selected_cover_url: p.selected_cover_url || null
    }));

    // ID сохраненного файла для текущего активного проекта
    const savedFileId = shellData?.target_project?.selected_generated_file_id || null;

    return {
      topRowItems: mappedTopRowProjects,
      displayedAttempts: mappedAttempts,
      loadingAttempts: isLoading,
      persistedSelectedFileId: savedFileId,
    };
  }, [shellData, attemptQueries]);

  return {
    modalData: shellData, // `modalData` теперь содержит только данные "оболочки"
    loading: isLoadingShell, // Основная загрузка - это загрузка оболочки
    error,
    topRowItems,
    selectedProjectIds,
    displayedAttempts,
    loadingAttempts, // Загрузка именно попыток
    handleCheckboxChange,
    persistedSelectedFileId,
    // `setTopRowItems` больше не нужен, т.к. `useAttemptSelection` будет обновлять превью иначе
  };
};
