import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSelectionData } from "../../../services/api"; // Импорт функции API
import React from "react";

export const useSelectionData = (show, collectionId, initialProjectId) => {
  // Состояние для выбранных ID проектов (для загрузки попыток)
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  // Состояние для верхнего ряда (модифицируется из useAttemptSelection для превью)
  const [topRowItems, setTopRowItems] = useState([]);

  // Инициализируем selectedProjectIds при открытии модалки
  useEffect(() => {
    if (show && initialProjectId) {
      setSelectedProjectIds([initialProjectId]);
    } else if (!show) {
      setSelectedProjectIds([]); // Сбрасываем при закрытии
    }
  }, [show, initialProjectId]);

  // --- Запрос данных для модалки ---
  const queryKey = [
    "selectionData",
    collectionId,
    initialProjectId,
    // Зависимость от отсортированной строки ID, чтобы ключ был стабильным
    [...selectedProjectIds].sort().join(","),
  ];

  const {
    data: rawSelectionData, // Переименовываем, чтобы было понятно, что это сырые данные
    isLoading: loading, // Статус загрузки
    error, // Ошибка
    isFetching: loadingAttempts, // Индикатор перезагрузки при смене selectedProjectIds
  } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      if (!collectionId || !initialProjectId || selectedProjectIds.length === 0) {
        // Возвращаем null или пустой объект, если нет данных для запроса
        // useQuery не будет вызывать queryFn если enabled: false
        return Promise.resolve(null);
      }
      return fetchSelectionData({
        collectionId,
        initialProjectId,
        projectIds: selectedProjectIds.join(","), // Передаем строку ID
      });
    },
    enabled: !!show && !!collectionId && !!initialProjectId && selectedProjectIds.length > 0, // Запрос активен только когда все параметры есть
    staleTime: 1000 * 60 * 1, // Кэшируем на 1 минуту
    // keepPreviousData: true, // Можно включить для более плавного UX при смене фильтров
  });

  // --- Трансформация данных ---
  const mappedModalData = React.useMemo(() => {
    if (!rawSelectionData) return null;

    // 1. Маппинг generation_attempts
    const mappedAttempts = (rawSelectionData.generation_attempts || []).map(attempt => {
      const firstFile = attempt.generated_files?.[0];
      return {
        ...attempt, // Копируем все остальные поля попытки
        // Извлекаем нужные поля из первого файла
        generated_file_id: firstFile?.id, 
        file_url: firstFile?.url,
        // Извлекаем generation_id (который на самом деле id попытки)
        generation_id: attempt.id, 
        // Добавляем недостающие, если нужно (напр., project_id из самой попытки)
        // project_id: attempt.project_id, // Уже должно быть в attempt
      };
    }).filter(attempt => attempt.generated_file_id && attempt.file_url && attempt.generation_id); // Убираем попытки без файлов ИЛИ ID

    // 2. Маппинг top_row_projects
    const mappedTopRowProjects = (rawSelectionData.top_row_projects || []).map(project => ({
        ...project, // Копируем остальные поля проекта
        project_id: project.id, // Переименовываем id -> project_id
        project_name: project.name, // Переименовываем name -> project_name
        // TODO: Добавить поле с URL выбранной обложки, если бэкенд его присылает
        // selected_cover_url: project.selected_cover_url, 
    }));

    return {
        ...rawSelectionData, // Копируем остальные поля ответа (напр., collection, target_project)
        generation_attempts: mappedAttempts, // Заменяем на смапленные попытки
        top_row_projects: mappedTopRowProjects, // Заменяем на смапленные проекты для топ-роу
    };

  }, [rawSelectionData]);

  // Обновляем topRowItems из ТРАНСФОРМИРОВАННЫХ данных
  useEffect(() => {
    if (mappedModalData?.top_row_projects) {
      setTopRowItems(mappedModalData.top_row_projects);
    } else if (!show) {
      // Сбрасываем при закрытии, если данных нет
      setTopRowItems([]);
    }
  }, [mappedModalData, show]); // Зависимость от mappedModalData

  // Обработчик изменения чекбоксов (остается)
  const handleCheckboxChange = useCallback(
    (event) => {
      const { value, checked } = event.target;
      const projectIdValue = value;
      setSelectedProjectIds((prevSelectedIds) => {
        let newSelectedIds;
        if (checked) {
          newSelectedIds = [...new Set([...prevSelectedIds, projectIdValue])];
        } else {
          newSelectedIds = prevSelectedIds.filter((id) => id !== projectIdValue);
          // Если после снятия галочки не осталось ни одного проекта, оставляем initialProjectId
          if (newSelectedIds.length === 0 && initialProjectId) {
            newSelectedIds = [initialProjectId];
          } else if (newSelectedIds.length === 0 && !initialProjectId) {
            // Если initialProjectId нет, то оставляем пустым - позволяет снять все галочки
            newSelectedIds = []; 
          }
        }
        return newSelectedIds;
      });
    },
    [initialProjectId]
  ); // Добавляем initialProjectId в зависимости

  // Извлекаем ID сохраненного файла для активного проекта
  const persistedSelectedFileId = mappedModalData?.target_project?.selected_generated_file_id || null;

  return {
    // Возвращаем ТРАНСФОРМИРОВАННЫЕ данные
    modalData: mappedModalData, 
    loading, 
    error,
    // Получаем смапленные попытки из modalData
    displayedAttempts: mappedModalData?.generation_attempts || [], 
    loadingAttempts, 
    // Локальные состояния и обработчики
    topRowItems, // topRowItems теперь должен содержать selected_cover_url
    setTopRowItems, // Нужно для useAttemptSelection
    selectedProjectIds,
    handleCheckboxChange,
    persistedSelectedFileId, // <-- Возвращаем ID сохраненного файла
  };
};
