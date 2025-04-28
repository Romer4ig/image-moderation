import React from "react";

const PlaceholderIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#F3F4F6"/>
    <path d="M10 22L14 17L17 21L21 16L26 22H10Z" fill="#D1D5DB"/>
    <circle cx="12.5" cy="13.5" r="1.5" fill="#D1D5DB"/>
  </svg>
);

const TopRowPreview = ({ topRowItems, projectId, onProjectClick }) => {
  return (
    <div className="top-row mb-3">
      {topRowItems.map((item) => (
        <div
          key={item.project_id}
          className={`top-row-item${item.project_id === projectId ? " target-project" : ""}`}
          aria-label={item.project_name}
          style={{ cursor: onProjectClick ? "pointer" : undefined }}
          onClick={onProjectClick ? () => onProjectClick(item.project_id) : undefined}
        >
          {/* Проверяем наличие URL выбранной обложки из БД */}
          {item.selected_cover_url ? (
            <img
              src={item.selected_cover_url} // Используем URL из БД
              className="thumbnail small"
              alt={`Обложка для ${item.project_name}`}
            />
          ) : (
            // Если URL из БД нет, показываем плейсхолдер
            <div className="placeholder d-flex flex-column align-items-center justify-content-center">
              <PlaceholderIcon />
              <span className="mt-1" style={{ color: '#9CA3AF', fontSize: '13px' }}>Не выбрано</span>
            </div>
          )}
          <div className="project-name fw-medium text-truncate mt-2" title={item.project_name}>
            {item.project_name}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TopRowPreview;
