import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProjects, updateProject, reindexProject } from "../../../services/api"; // Добавляем reindexProject
import { toast } from "react-toastify"; // Для уведомлений

export const useProjects = () => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  // --- Загрузка проектов ---
  const {
    data: projects = [],
    isLoading: loading,
    error,
    refetch: fetchProjectsManual,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    staleTime: 1000 * 60 * 5,
  });

  // --- Сохранение проекта ---
  const {
    mutate: saveProjectMutate,
    isLoading: isSaving,
    error: saveError, // Это ошибка последней мутации сохранения
  } = useMutation({
    mutationFn: updateProject,
    onSuccess: (updatedProjectData) => {
      queryClient.setQueryData(["projects"], (oldData) =>
        oldData.map((p) => (p.id === updatedProjectData.id ? updatedProjectData : p))
      );
      toast.success(`Проект "${updatedProjectData.name}" успешно сохранен.`);
    },
    onError: (err, variables) => {
      const projectName = projects.find(p => p.id === variables.projectId)?.name || variables.projectId;
      toast.error(`Ошибка сохранения проекта "${projectName}": ${err.response?.data?.error || err.message}`);
    },
  });

  // --- Переиндексация проекта ---
  const {
    mutate: reindexProjectMutate,
    isLoading: isReindexing,
    error: reindexError, // Ошибка последней мутации переиндексации
    // data: reindexSuccessData, // Данные при успехе, если нужны
  } = useMutation({
    mutationFn: reindexProject,
    onSuccess: (data, projectId) => {
      const projectName = projects.find(p => p.id === projectId)?.name || projectId;
      toast.success(`Проект "${projectName}" (${data.path_checked}) переиндексирован: ${data.entry_count} элементов. (${data.message})`);
      // Здесь не нужно обновлять данные проектов, т.к. сам проект не меняется
    },
    onError: (err, projectId) => {
      const projectName = projects.find(p => p.id === projectId)?.name || projectId;
      toast.error(`Ошибка переиндексации проекта "${projectName}": ${err.response?.data?.error || err.message}`);
    },
  });

  const [localProjectChanges, setLocalProjectChanges] = useState({});
  const [jsonErrors, setJsonErrors] = useState({});
  // Отдельное состояние для отслеживания, какой проект переиндексируется
  const [reindexingProjectId, setReindexingProjectId] = useState(null);

  const handleAddSuccess = useCallback(() => {
    fetchProjectsManual();
    setShowAddModal(false);
  }, [fetchProjectsManual]);

  const handleProjectChange = useCallback((projectId, field, value) => {
    setLocalProjectChanges((prev) => ({
      ...prev,
      [projectId]: { ...(prev[projectId] || {}), [field]: value },
    }));
    if (field === "jsonString") {
      let jsonError = null;
      try { if (value.trim()) { JSON.parse(value); } } catch { jsonError = "Невалидный JSON"; }
      setJsonErrors((prev) => ({ ...prev, [projectId]: jsonError }));
    }
  }, []);

  const handleSaveProject = useCallback(
    (projectId) => {
      const changes = localProjectChanges[projectId];
      const jsonError = jsonErrors[projectId];
      if (!changes || Object.keys(changes).length === 0) {
        toast.info("Нет изменений для сохранения.");
        return;
      }
      if (jsonError) {
        toast.error("Пожалуйста, исправьте ошибку в JSON перед сохранением.");
        return;
      }
      const payload = { ...changes };
      if (payload.jsonString !== undefined) {
        try {
          payload.base_generation_params_json = payload.jsonString.trim() ? JSON.parse(payload.jsonString) : {};
          delete payload.jsonString;
        } catch { return; }
      }
      if (payload.default_width !== undefined) payload.default_width = Number(payload.default_width) || 512;
      if (payload.default_height !== undefined) payload.default_height = Number(payload.default_height) || 512;

      saveProjectMutate(
        { projectId, projectData: payload },
        {
          onSettled: () => {
            setLocalProjectChanges((prev) => { const newState = { ...prev }; delete newState[projectId]; return newState; });
            setJsonErrors((prev) => { const newState = { ...prev }; delete newState[projectId]; return newState; });
          },
        }
      );
    },
    [localProjectChanges, jsonErrors, saveProjectMutate, toast]
  );

  const handleReindexProject = useCallback((projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.path) {
        toast.warn(`Для проекта "${project?.name || projectId}" не указан путь для индексации.`);
        return;
    }
    setReindexingProjectId(projectId); // Устанавливаем ID текущего проекта для reindex
    reindexProjectMutate(projectId, {
        onSettled: () => {
            setReindexingProjectId(null); // Сбрасываем после завершения
        }
    });
  }, [projects, reindexProjectMutate, toast]);


  const getCombinedStatus = (projectId) => {
    const isCurrentlySaving = isSaving && localProjectChanges[projectId] !== undefined && Object.keys(localProjectChanges[projectId]).length > 0;
    const currentSaveError = saveError && localProjectChanges[projectId] !== undefined ? (saveError.response?.data?.error || saveError.message) : null;
    const currentJsonError = jsonErrors[projectId] || null;
    
    const isCurrentlyReindexing = isReindexing && reindexingProjectId === projectId;
    const currentReindexError = reindexError && reindexingProjectId === projectId ? (reindexError.response?.data?.error || reindexError.message) : null;

    return {
      isSaving: isCurrentlySaving,
      saveError: currentSaveError,
      jsonError: currentJsonError,
      isReindexing: isCurrentlyReindexing,
      reindexError: currentReindexError,
    };
  };

  return {
    projects,
    loading,
    error,
    // savingStatus, // Заменяем на getCombinedStatus
    getCombinedStatus,
    showAddModal,
    setShowAddModal,
    handleAddSuccess,
    handleProjectChange,
    handleSaveProject,
    handleReindexProject, // Добавляем новый обработчик
    localProjectChanges,
  };
};
