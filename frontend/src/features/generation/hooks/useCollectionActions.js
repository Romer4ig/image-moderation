import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCollection } from "../../../services/api"; // Импортируем функцию API

export const useCollectionActions = () => {
  const queryClient = useQueryClient();
  const [fieldSaveStatus, setFieldSaveStatus] = useState({});
  const saveTimersRef = useRef({});

  // --- Мутация для обновления поля коллекции ---
  const { mutate: updateFieldMutate } = useMutation({
    mutationFn: updateCollection, // Функция из api.js
    onSuccess: (updatedCollectionData, variables) => {
      const { collectionId, fieldType } = variables;
      const timerKey = `${collectionId}-${fieldType}`;

      // Инвалидируем кэш грида, чтобы он обновился
      queryClient.invalidateQueries({ queryKey: ["grid-data-infinite"] });

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

      // Запускаем таймер для сброса статуса ошибки
      const timerKey = `${collectionId}-${fieldType}-error`;
      clearTimeout(saveTimersRef.current[timerKey]); 
      saveTimersRef.current[timerKey] = setTimeout(() => {
        setFieldSaveStatus((prev) => {
          if (prev[collectionId]?.[fieldType]?.error) {
            const newStatus = { ...prev };
            if (newStatus[collectionId]) {
              newStatus[collectionId] = { ...newStatus[collectionId] };
              delete newStatus[collectionId][fieldType];
              if (Object.keys(newStatus[collectionId]).length === 0) {
                delete newStatus[collectionId];
              }
            }
            return newStatus;
          }
          return prev;
        });
        delete saveTimersRef.current[timerKey];
      }, 5000); // 5 секунд для отображения ошибки
    },
  });

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
    handleAutoSaveCollectionField,
  };
};
