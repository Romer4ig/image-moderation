import { useState, useEffect, useCallback, useMemo } from "react";

export const useGenerationGridData = (collections = [], allProjectsList = []) => {
  const [visibleColumnProjectIds, setVisibleColumnProjectIds] = useState(
    () => new Set(allProjectsList.map((p) => p.id))
  );
  const [collectionTypes, setCollectionTypes] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: "last_generation_at",
    direction: "descending",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedFilter, setAdvancedFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    const uniqueTypes = [...new Set(collections.map((c) => c.type).filter(Boolean))].sort();
    setCollectionTypes(uniqueTypes);
  }, [collections]);

  const visibleProjects = useMemo(() => {
    return allProjectsList.filter((p) => visibleColumnProjectIds.has(p.id));
  }, [allProjectsList, visibleColumnProjectIds]);

  const handleColumnProjectSelectionChange = useCallback((projectId, isChecked) => {
    setVisibleColumnProjectIds((prev) => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(projectId);
      } else {
        newSet.delete(projectId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAllColumnProjects = useCallback(
    (isChecked) => {
      if (isChecked) {
        setVisibleColumnProjectIds(new Set(allProjectsList.map((p) => p.id)));
      } else {
        if (visibleColumnProjectIds.size > 1 && allProjectsList.length > 0) {
          setVisibleColumnProjectIds(new Set([allProjectsList[0].id]));
        }
      }
    },
    [allProjectsList, visibleColumnProjectIds]
  );

  const getSortedAndFilteredCollections = useCallback(() => {
    const filtered = collections.filter((collection) => {
      if (!collection) return false;
      if (!collection.name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (typeFilter !== "all" && collection.type !== typeFilter) return false;
      if (advancedFilter === "empty_positive" && collection.collection_positive_prompt)
        return false;
      if (advancedFilter === "no_dynamic") {
        const hasDynamic =
          (collection.collection_positive_prompt?.includes("{") &&
            collection.collection_positive_prompt?.includes("}")) ||
          collection.collection_positive_prompt?.includes("|") ||
          (collection.collection_negative_prompt?.includes("{") &&
            collection.collection_negative_prompt?.includes("}")) ||
          collection.collection_negative_prompt?.includes("|");
        if (hasDynamic) return false;
      }
      if (advancedFilter === "has_comment" && !collection.comment?.trim()) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction === "ascending" ? 1 : -1;
      let aValue = a[key];
      let bValue = b[key];
      if (key === "created_at" || key === "last_generation_at") {
        aValue = aValue ? new Date(aValue).getTime() : direction === 1 ? Infinity : -Infinity;
        bValue = bValue ? new Date(bValue).getTime() : direction === 1 ? Infinity : -Infinity;
      } else if (key === "name") {
        aValue = aValue?.toLowerCase() || "";
        bValue = bValue?.toLowerCase() || "";
      }
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      if (key === "created_at" || key === "last_generation_at") {
        const nameA = a.name?.toLowerCase() || "";
        const nameB = b.name?.toLowerCase() || "";
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
      }
      return 0;
    });
    return sorted;
  }, [collections, searchTerm, typeFilter, advancedFilter, sortConfig]);

  const sortedAndFilteredCollections = getSortedAndFilteredCollections();

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
    sortedAndFilteredCollections,
    visibleProjects,
    allColumnProjectsSelected,
    setSortConfig,
    setSearchTerm,
    setAdvancedFilter,
    setTypeFilter,
    handleColumnProjectSelectionChange,
    handleSelectAllColumnProjects,
  };
};
