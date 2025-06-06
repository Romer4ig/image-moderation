import React from "react";
import { useSelectionContext } from "../context/SelectionContext";
import TopRowItem from "./TopRowItem";

const PlaceholderIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#F3F4F6"/>
    <path d="M10 22L14 17L17 21L21 16L26 22H10Z" fill="#D1D5DB"/>
    <circle cx="12.5" cy="13.5" r="1.5" fill="#D1D5DB"/>
  </svg>
);

const TopRowPreview = () => {
  const { topRowItems } = useSelectionContext();

  return (
    <div className="top-row mb-3">
      {topRowItems.map((item) => (
        <TopRowItem key={item.project_id} item={item} />
      ))}
    </div>
  );
};

export default TopRowPreview;
