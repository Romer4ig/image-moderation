import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCollection } from "../../../services/api"; // Импортируем функцию API

export const useCollectionActions = (setCollections) => {
  const queryClient = useQueryClient();
  const [fieldSaveStatus, setFieldSaveStatus] = useState({});
  const saveTimersRef = useRef({});

  // --- Мутация для обновления поля коллекции ---
  const { mutate: updateFieldMutate } = useMutation({
    mutationFn: updateCollection, // Функция из api.js
    onSuccess: (updatedCollectionData, variables) => {
      // variables содержит { collectionId, fieldType, ... }
      const { collectionId, fieldType } = variables;
      const timerKey = `${collectionId}-${fieldType}`;

      // Обновляем кэш грида (опционально, если /grid-data содержит эти поля)
      // queryClient.invalidateQueries(['gridData']);
      // Или обновляем вручную, если нужно
      queryClient.setQueryData(["gridData"], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          collections: oldData.collections.map((c) =>
            c.id === collectionId ? updatedCollectionData : c
          ),
        };
      });

      // Устанавливаем статус "Сохранено"
      setFieldSaveStatus((prev) => ({
        ...prev,
        [collectionId]: {
          ...prev[collectionId],
          [fieldType]: { saving: false, error: null, saved: true },
        },
      }));

      // Запускаем таймер для сброса статуса "Сохранено"
      clearTimeout(saveTimersRef.current[timerKey]); // Очищаем предыдущий таймер, если есть
      saveTimersRef.current[timerKey] = setTimeout(() => {
        setFieldSaveStatus((prev) => {
          // Проверяем, что статус все еще saved перед сбросом
          if (prev[collectionId]?.[fieldType]?.saved) {
            const newStatus = { ...prev };
            if (newStatus[collectionId]) {
              newStatus[collectionId] = { ...newStatus[collectionId] }; // Копируем объект коллекции
              delete newStatus[collectionId][fieldType]; // Удаляем статус для этого поля
              // Если у коллекции больше нет статусов, удаляем и ее
              if (Object.keys(newStatus[collectionId]).length === 0) {
                delete newStatus[collectionId];
              }
            }
            return newStatus;
          }
          return prev;
        });
        delete saveTimersRef.current[timerKey];
      }, 2000);
    },
    onError: (err, variables) => {
      const { collectionId, fieldType } = variables;
      console.error(`Error auto-saving ${fieldType} for collection ${collectionId}:`, err);
      const errorMsg = err.response?.data?.error || err.message || "Ошибка сохранения";
      // Устанавливаем статус ошибки
      setFieldSaveStatus((prev) => ({
        ...prev,
        [collectionId]: {
          ...prev[collectionId],
          [fieldType]: { saving: false, error: errorMsg, saved: false },
        },
      }));
    },
  });

  // Локальное обновление состояния (остается без изменений)
  const handlePromptChange = useCallback(
    (collectionId, fieldType, newValue) => {
      setCollections((prevCollections) =>
        prevCollections.map((coll) => {
          if (coll.id === collectionId) {
            let fieldKey = "";
            if (fieldType === "positive") fieldKey = "collection_positive_prompt";
            else if (fieldType === "negative") fieldKey = "collection_negative_prompt";
            else if (fieldType === "comment") fieldKey = "comment";
            if (fieldKey) return { ...coll, [fieldKey]: newValue };
          }
          return coll;
        })
      );
    },
    [setCollections]
  );

  // Запуск сохранения при потере фокуса
  const handleAutoSaveCollectionField = useCallback(
    (collectionId, fieldType, currentValue) => {
      const fieldKeyMap = {
        positive: "collection_positive_prompt",
        negative: "collection_negative_prompt",
        comment: "comment",
      };
      const fieldKey = fieldKeyMap[fieldType];
      if (!fieldKey) return;

      const timerKey = `${collectionId}-${fieldType}`;
      if (saveTimersRef.current[timerKey]) {
        clearTimeout(saveTimersRef.current[timerKey]);
      }

      // Устанавливаем статус "Saving" перед вызовом мутации
      setFieldSaveStatus((prev) => ({
        ...prev,
        [collectionId]: {
          ...prev[collectionId],
          [fieldType]: { saving: true, error: null, saved: false },
        },
      }));

      // Вызываем мутацию
      updateFieldMutate({
        collectionId,
        collectionData: { [fieldKey]: currentValue },
        // Передаем fieldType для использования в onSuccess/onError
        fieldType: fieldType,
      });
    },
    [updateFieldMutate] // Зависимость от функции мутации
  );

  // Очистка таймеров при размонтировании (остается)
  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Собираем финальный статус для UI
  // Нужно пройтись по всем статусам и учесть isLoading/error из мутации
  const finalFieldSaveStatus = { ...fieldSaveStatus };
  // Если мутация активна, нужно найти соответствующий collectionId/fieldType? Сложно.
  // Проще полагаться на статус, устанавливаемый в onError/onSuccess/перед вызовом mutate.

  return {
    fieldSaveStatus: finalFieldSaveStatus, // Возвращаем собранный статус
    handlePromptChange,
    handleAutoSaveCollectionField,
  };
};
