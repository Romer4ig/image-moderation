import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const apiClient = axios.create({
  baseURL: API_URL,
});

// --- Projects API ---
export const fetchProjects = async () => {
  const { data } = await apiClient.get("/projects");
  // Преобразуем JSON при получении, как это делалось в useProjects
  return data.map((p) => ({
    ...p,
    jsonString: JSON.stringify(p.base_generation_params_json || {}, null, 2),
  }));
};

export const createProject = async (projectData) => {
  const { data } = await apiClient.post("/projects", projectData);
  return data;
};

export const updateProject = async ({ projectId, projectData }) => {
  const { data } = await apiClient.put(`/projects/${projectId}`, projectData);
  // Преобразуем JSON обратно при ответе
  return {
    ...data,
    jsonString: JSON.stringify(data.base_generation_params_json || {}, null, 2),
  };
};

// --- Collections API ---
export const fetchCollections = async () => {
  const { data } = await apiClient.get("/collections");
  return data;
};

export const createCollection = async (collectionData) => {
  const { data } = await apiClient.post("/collections", collectionData);
  return data;
};

export const updateCollection = async ({ collectionId, collectionData }) => {
  const { data } = await apiClient.put(`/collections/${collectionId}`, collectionData);
  return data;
};

// --- Generation & Grid API ---
export const fetchGridData = async ({
  visibleProjectIds = [],
  search = '',
  type = '',
  advanced = '',
  sort = '',
  order = '',
  generationStatusFilter = '',
  page = 1,
  per_page = 100,
} = {}) => {
  const params = {};
  if (visibleProjectIds && visibleProjectIds.length > 0) {
    params.visible_project_ids = visibleProjectIds.join(",");
  }
  if (search) params.search = search;
  if (type) params.type = type;
  if (advanced) params.advanced = advanced;
  if (sort) params.sort = sort;
  if (order) params.order = order;
  if (generationStatusFilter && generationStatusFilter !== 'all') params.generation_status_filter = generationStatusFilter;
  params.page = page;
  params.per_page = per_page;

  const { data } = await apiClient.get("/grid-data", { params });
  return data;
};

export const generateBatch = async (pairs) => {
  const { data } = await apiClient.post("/generate-batch", { pairs });
  return data;
};

// --- Selection API ---
export const fetchSelectionData = async ({ collectionId, initialProjectId, projectIds }) => {
  const { data } = await apiClient.get("/selection-data", {
    params: {
      collection_id: collectionId,
      initial_project_id: initialProjectId,
      project_ids: projectIds, // projectIds уже строка или массив? Бэкенд ждет строку
    },
  });
  return data;
};

// --- Получение данных для "оболочки" модального окна ---
export const getSelectionShell = async (collectionId, projectId) => {
  const { data } = await apiClient.get("/selection-data", {
    params: {
      collection_id: collectionId,
      project_id: projectId, // `initialProjectId` для получения target_project
    },
  });
  return data;
};

// --- Получение генераций для ОДНОГО проекта ---
export const getProjectAttempts = async (collectionId, projectId) => {
  const { data } = await apiClient.get("/selection-data/attempts", {
    params: {
      collection_id: collectionId,
      project_id: projectId,
    },
  });
  return data.generation_attempts || []; // Возвращаем только массив попыток
};

// --- Отправка выбора ---
export const selectCover = async ({ collectionId, projectId, generationId, generatedFileId }) => {
  const { data } = await apiClient.post("/select-cover", {
    collection_id: collectionId,
    project_id: projectId,
    generation_id: generationId,
    generated_file_id: generatedFileId,
  });
  return data;
};

export const importCollectionsCSV = async (formData) => {
  // Отправляем FormData, axios сам установит Content-Type: multipart/form-data
  const { data } = await apiClient.post("/collections/import-csv", formData);
  return data;
};

// --- Project Reindex API ---
export const reindexProject = async (projectId) => {
  const { data } = await apiClient.post(`/projects/${projectId}/reindex`);
  return data; // Ожидаем JSON с сообщением, path_checked, entry_count или ошибкой
};

// Можно добавить другие функции API по мере необходимости
