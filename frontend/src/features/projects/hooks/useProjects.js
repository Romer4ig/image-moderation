import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProjects, updateProject } from "../../../services/api"; // Исправляем путь

export const useProjects = () => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  // --- Загрузка проектов --- 
  const {
    data: projects = [], // Предоставляем пустой массив по умолчанию
    isLoading: loading, // Переименовываем isLoading в loading для совместимости
    error,
    refetch: fetchProjectsManual, // Получаем функцию для ручного обновления
  } = useQuery({ 
    queryKey: ['projects'], 
    queryFn: fetchProjects, // Используем функцию из api.js
    staleTime: 1000 * 60 * 5, // Кэшируем на 5 минут
  });

  // --- Сохранение проекта --- 
  const { 
      mutate: saveProjectMutate, 
      isLoading: isSaving, 
      error: saveError 
  } = useMutation({ 
    mutationFn: updateProject, // Используем функцию из api.js
    onSuccess: (updatedProjectData) => {
      // Обновляем кэш React Query после успешного сохранения
      queryClient.setQueryData(['projects'], (oldData) => 
        oldData.map(p => p.id === updatedProjectData.id ? updatedProjectData : p)
      );
      // Можно также инвалидировать кэш, чтобы вызвать полный refetch:
      // queryClient.invalidateQueries(['projects']);
    },
    // onError: (err) => { // Обработка ошибок уже в компоненте?
    //   console.error("Mutation error:", err);
    // }
  });

  // Локальное состояние для отслеживания изменений перед сохранением
  // и ошибок JSON (это остается, т.к. не связано с серверным состоянием)
  const [localProjectChanges, setLocalProjectChanges] = useState({});
  const [jsonErrors, setJsonErrors] = useState({});

  const handleAddSuccess = useCallback(() => {
    fetchProjectsManual(); // Обновляем список после добавления
    setShowAddModal(false);
  }, [fetchProjectsManual]);

  const handleProjectChange = useCallback((projectId, field, value) => {
    setLocalProjectChanges(prev => ({
      ...prev,
      [projectId]: { ...(prev[projectId] || {}), [field]: value }
    }));

    if (field === "jsonString") {
      let jsonError = null;
      try {
        if (value.trim()) {
          JSON.parse(value);
        }
      } catch {
        jsonError = "Невалидный JSON";
      }
      setJsonErrors(prev => ({ ...prev, [projectId]: jsonError }));
    }
  }, []);

  const handleSaveProject = useCallback((projectId) => {
    const projectFromCache = projects.find(p => p.id === projectId);
    const changes = localProjectChanges[projectId];
    const jsonError = jsonErrors[projectId];

    if (!projectFromCache || !changes) return; // Нет изменений для сохранения
    if (jsonError) {
      alert("Пожалуйста, исправьте ошибку в JSON перед сохранением.");
      return;
    }

    const payload = { ...changes }; // Берем только измененные поля

    // Если меняли JSON, парсим его
    if (payload.jsonString !== undefined) {
        try {
            payload.base_generation_params_json = payload.jsonString.trim() ? JSON.parse(payload.jsonString) : {};
            delete payload.jsonString; // Удаляем строковое представление из payload
        } catch {
            // Эта ошибка уже должна быть поймана в handleProjectChange и jsonErrors
            return; 
        }
    }
    // Преобразуем width/height в числа
    if (payload.default_width !== undefined) payload.default_width = Number(payload.default_width) || 512;
    if (payload.default_height !== undefined) payload.default_height = Number(payload.default_height) || 512;

    saveProjectMutate({ projectId, projectData: payload }, {
        onSettled: () => {
            // Очищаем локальные изменения и ошибки JSON после попытки сохранения
            setLocalProjectChanges(prev => {
                const newState = {...prev};
                delete newState[projectId];
                return newState;
            });
            setJsonErrors(prev => {
                const newState = {...prev};
                delete newState[projectId];
                return newState;
            });
        }
    });

  }, [projects, localProjectChanges, jsonErrors, saveProjectMutate]);

  // Собираем savingStatus для UI на основе мутации и ошибок JSON
  const savingStatus = projects.reduce((acc, project) => {
      acc[project.id] = {
          isSaving: isSaving && localProjectChanges[project.id] !== undefined, // Показываем спиннер только если этот проект сохраняется
          error: saveError && localProjectChanges[project.id] !== undefined ? (saveError.response?.data?.error || saveError.message) : null,
          jsonError: jsonErrors[project.id] || null,
      };
      return acc;
  }, {});

  return {
    // Используем данные и состояния из useQuery и useMutation
    projects, // Данные из кэша
    loading,
    error,
    savingStatus, // Собранный статус
    showAddModal,
    setShowAddModal,
    handleAddSuccess,
    // Передаем функции для изменения локального состояния
    handleProjectChange,
    // Передаем функцию для запуска сохранения
    handleSaveProject,
    // Локальные изменения и ошибки для отображения в UI
    localProjectChanges,
  };
}; 