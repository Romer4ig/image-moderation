import React, { memo } from "react";
import { useSelectionContext } from "../context/SelectionContext";

const PlaceholderIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#F3F4F6"/>
    <path d="M10 22L14 17L17 21L21 16L26 22H10Z" fill="#D1D5DB"/>
    <circle cx="12.5" cy="13.5" r="1.5" fill="#D1D5DB"/>
  </svg>
);

const TopRowItem = ({ item }) => {
  const { activeProjectId, handleProjectClick, pendingSelections } = useSelectionContext();

  const isTarget = item.project_id === activeProjectId;
  const canClick = !!handleProjectClick;

  const pendingUrl = pendingSelections[item.project_id]?.file_url;
  const displayUrl = pendingUrl || item.selected_cover_url;

  return (
    <div
      className={`top-row-item${isTarget ? " target-project" : ""}`}
      aria-label={item.project_name}
      style={{ cursor: canClick ? "pointer" : "default" }}
      onClick={canClick ? () => handleProjectClick(item.project_id) : undefined}
    >
      {displayUrl ? (
        <img
          src={displayUrl}
          className="thumbnail small"
          alt={`Обложка для ${item.project_name}`}
        />
      ) : (
        <div className="placeholder d-flex flex-column align-items-center justify-content-center">
          <PlaceholderIcon />
          <span className="mt-1" style={{ color: '#9CA3AF', fontSize: '13px' }}>Не выбрано</span>
        </div>
      )}
      <div className="project-name fw-medium text-truncate mt-2" title={item.project_name}>
        {item.project_name}
      </div>
    </div>
  );
};

export default memo(TopRowItem); 