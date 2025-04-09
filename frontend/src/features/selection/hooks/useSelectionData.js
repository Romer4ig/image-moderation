import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSelectionData } from "../../../services/api"; // Импорт функции API

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
    data: selectionQueryData, // Весь ответ от API
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

  // Обновляем topRowItems из данных запроса
  useEffect(() => {
    if (selectionQueryData?.top_row_projects) {
      setTopRowItems(selectionQueryData.top_row_projects);
    } else if (!show) {
      // Сбрасываем при закрытии, если данных нет
      setTopRowItems([]);
    }
  }, [selectionQueryData, show]);

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
          }
        }
        return newSelectedIds;
      });
    },
    [initialProjectId]
  ); // Добавляем initialProjectId в зависимости

  return {
    // Данные из useQuery
    modalData: selectionQueryData, // Весь объект ответа
    loading, // Начальная загрузка
    error,
    displayedAttempts: selectionQueryData?.generation_attempts || [], // Попытки
    loadingAttempts, // Индикатор перезагрузки
    // Локальные состояния и обработчики
    topRowItems,
    setTopRowItems, // Нужно для useAttemptSelection
    selectedProjectIds,
    handleCheckboxChange,
  };
};
