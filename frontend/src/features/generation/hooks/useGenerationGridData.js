import { useState, useEffect, useCallback, useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchGridData, fetchProjects } from "../../../services/api";

const PER_PAGE = 100;

export const useGenerationGridData = (
  sortConfig,
  searchTerm,
  advancedFilter,
  typeFilter,
  generationStatusFilter,
) => {
  const [visibleColumnProjectIds, setVisibleColumnProjectIds] = useState(new Set());
  const [collectionTypes, setCollectionTypes] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const { 
    data: projectsData, 
    isLoading: isProjectsLoading, 
    error: projectsError 
  } = useQuery({ 
      queryKey: ['allProjects'], 
      queryFn: fetchProjects,
      staleTime: Infinity,
  });

  const allProjectsList = projectsData || [];

  const visibleProjects = useMemo(() => {
    return allProjectsList.filter((p) => visibleColumnProjectIds.has(p.id));
  }, [allProjectsList, visibleColumnProjectIds]);

  const handleColumnProjectSelectionChange = useCallback((projectId, isChecked) => {
    setVisibleColumnProjectIds((prev) => {
      const currentSet = new Set(prev);
      if (isChecked) {
        currentSet.add(projectId);
      } else {
        currentSet.delete(projectId);
      }
      return currentSet;
    });
  }, []);

  const handleSelectAllColumnProjects = useCallback(
    (isChecked) => {
      if (isChecked) {
        setVisibleColumnProjectIds(new Set(allProjectsList.map((p) => p.id)));
      } else {
        if (visibleColumnProjectIds.size > 1 && allProjectsList.length > 0) {
          setVisibleColumnProjectIds(new Set([allProjectsList[0].id]));
        } else if (allProjectsList.length > 0) {
          setVisibleColumnProjectIds(new Set([allProjectsList[0].id]));
        } else {
          setVisibleColumnProjectIds(new Set());
        }
      }
    },
    [allProjectsList, visibleColumnProjectIds]
  );

  useEffect(() => {
    if (!isProjectsLoading && allProjectsList.length >= 0) {
      const saved = localStorage.getItem('gridVisibleProjectIds');
      let initialIds = new Set();
      if (saved) {
        try {
          const savedIds = JSON.parse(saved);
          if (Array.isArray(savedIds)) {
             const validIds = savedIds.filter(id => allProjectsList.some(p => p.id === id));
             if (validIds.length > 0) {
               initialIds = new Set(validIds);
             } else if (allProjectsList.length > 0) {
               initialIds = new Set([allProjectsList[0].id]);
             }
          } else {
             console.warn("Invalid data type found in localStorage for gridVisibleProjectIds, expected array.");
             if (allProjectsList.length > 0) initialIds = new Set([allProjectsList[0].id]);
          }
        } catch (e) {
           console.error("Failed to parse gridVisibleProjectIds from localStorage", e);
           if (allProjectsList.length > 0) initialIds = new Set([allProjectsList[0].id]);
        }
      } else if (allProjectsList.length > 0) {
         initialIds = new Set([allProjectsList[0].id]);
      }
      setVisibleColumnProjectIds(initialIds);
      setIsInitialized(true);
    }
  }, [isProjectsLoading, allProjectsList]);

  useEffect(() => {
    if (isInitialized && visibleColumnProjectIds !== null) {
      localStorage.setItem('gridVisibleProjectIds', JSON.stringify(Array.from(visibleColumnProjectIds)));
    }
  }, [visibleColumnProjectIds, isInitialized]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading: isLoadingGridData,
    error: gridDataError,
    refetch: refetchGridData,
  } = useInfiniteQuery({
    queryKey: [
      "grid-data-infinite",
      Array.from(visibleColumnProjectIds),
      searchTerm,
      typeFilter,
      advancedFilter,
      sortConfig?.key,
      sortConfig?.direction,
      generationStatusFilter
    ],
    queryFn: ({ pageParam = 1 }) => fetchGridData({
      visibleProjectIds: Array.from(visibleColumnProjectIds),
      search: searchTerm,
      type: typeFilter,
      advanced: advancedFilter,
      sort: sortConfig?.key,
      order: sortConfig?.direction,
      generationStatusFilter,
      page: pageParam,
      per_page: PER_PAGE,
    }),
    getNextPageParam: (lastPage) => {
      if (lastPage.collections.has_next) {
        return lastPage.collections.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    keepPreviousData: true,
    enabled: isInitialized,
  });

  const isLoading = isProjectsLoading || (isInitialized && isLoadingGridData);
  const combinedError = projectsError || gridDataError;

  useEffect(() => {
    if (data?.pages) {
      const allFetchedCollections = data.pages.flatMap(page => page.collections.items);
      const uniqueTypes = [...new Set(allFetchedCollections.map((c) => c.type).filter(Boolean))].sort();
      setCollectionTypes(uniqueTypes);
    }
  }, [data?.pages]);

  const allFetchedCollections = useMemo(() =>
     data?.pages.flatMap(page => page.collections.items) ?? []
  , [data?.pages]);

  const sortedAndFilteredCollections = allFetchedCollections;

  const allColumnProjectsSelected =
    allProjectsList.length > 0 && visibleColumnProjectIds.size === allProjectsList.length;

  return {
    allProjectsList,
    visibleColumnProjectIds,
    collectionTypes,
    sortConfig,
    searchTerm,
    advancedFilter,
    typeFilter,
    generationStatusFilter,
    sortedAndFilteredCollections,
    visibleProjects,
    allColumnProjectsSelected,
    handleColumnProjectSelectionChange,
    handleSelectAllColumnProjects,
    isLoading,
    gridError: combinedError,
    refetchGridData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  };
};
