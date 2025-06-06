import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { selectCover } from "../../../services/api"; // Импорт функции API

export const useAttemptSelection = (
  collectionId,
  activeProjectId,
  initialProjectId,
  pendingSelections,
  setPendingSelections,
  onSelectionConfirmed
) => {
  const queryClient = useQueryClient();

  const handleAttemptClick = useCallback(
    (attempt) => {
      // Выбор всегда осуществляется ДЛЯ АКТИВНОГО проекта
      setPendingSelections((prev) => ({
        ...prev,
        [activeProjectId]: {
          generation_id: attempt.generation_id,
          generated_file_id: attempt.generated_file_id,
          file_url: attempt.file_url,
        },
      }));

      // Оптимистичное обновление превью ДЛЯ АКТИВНОГО проекта
      queryClient.setQueryData(
        ["selectionShell", collectionId, initialProjectId],
        (cachedData) => {
          if (!cachedData) return cachedData;
          const updatedTopRow = cachedData.top_row_projects.map((project) => {
            if (project.id === activeProjectId) {
              return { ...project, selected_cover_url: attempt.file_url };
            }
            return project;
          });
          return { ...cachedData, top_row_projects: updatedTopRow };
        }
      );
    },
    [activeProjectId, collectionId, initialProjectId, queryClient, setPendingSelections]
  );

  const { mutateAsync: confirmSelectionMutateAsync, isLoading: isSubmitting } =
    useMutation({
      mutationFn: selectCover,
    });

  const handleConfirmAllSelections = useCallback(async () => {
    const selectionsToSave = Object.entries(pendingSelections);
    if (selectionsToSave.length === 0) {
      alert("Нет новых выборов для сохранения.");
      return;
    }

    const promises = selectionsToSave.map(([projectId, selection]) =>
      confirmSelectionMutateAsync({
        collectionId: String(collectionId),
        projectId: projectId,
        generationId: selection.generation_id,
        generatedFileId: selection.generated_file_id,
      })
    );

    try {
      await Promise.all(promises);
      setPendingSelections({});
      queryClient.invalidateQueries({ queryKey: ["selectionShell"] });
      queryClient.invalidateQueries({ queryKey: ["grid-data-infinite"] });
      if (onSelectionConfirmed) {
        onSelectionConfirmed();
      }
    } catch (error) {
      console.error("One or more selections failed to save:", error);
      alert("Не удалось сохранить один или несколько выборов.");
    }
  }, [pendingSelections, confirmSelectionMutateAsync, collectionId, queryClient, onSelectionConfirmed, setPendingSelections]);

  return {
    isSubmitting,
    handleAttemptClick,
    handleConfirmSelection: handleConfirmAllSelections,
  };
};
