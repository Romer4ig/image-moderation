import React, { useState, useEffect } from "react";
import { Form, Badge } from "react-bootstrap";
import GridCell from "./GridCell";

const GridRow = ({
  collection,
  selectedCollectionIds,
  handleCollectionSelectionChange,
  visibleProjects,
  openSelectionModal,
  shouldShowPromptColumn,
  showPositivePrompt,
  showNegativePrompt,
  showCollectionComment,
  generationStatusFilter,
}) => {
  // Локальное состояние для редактируемых полей
  const [localPositive, setLocalPositive] = useState(collection.collection_positive_prompt || "");
  const [localNegative, setLocalNegative] = useState(collection.collection_negative_prompt || "");
  const [localComment, setLocalComment] = useState(collection.comment || "");

  // Синхронизация локального состояния при изменении collection
  useEffect(() => {
    setLocalPositive(collection.collection_positive_prompt || "");
  }, [collection.collection_positive_prompt]);
  useEffect(() => {
    setLocalNegative(collection.collection_negative_prompt || "");
  }, [collection.collection_negative_prompt]);
  useEffect(() => {
    setLocalComment(collection.comment || "");
  }, [collection.comment]);

  const positivePromptInvalid = !localPositive;

  // FIGMA-DEV: Определяем класс для Badge
  let badgeClass = "figma-badge ms-2";
  if (collection.type === "Collections") {
    badgeClass += " figma-badge-collections";
  } else if (collection.type === "New") {
    badgeClass += " figma-badge-new";
  } else if (collection.type === "Retro") {
     badgeClass += " figma-badge-retro";
  } // Добавить другие типы по необходимости

  return (
    <tr key={collection.id}>
      <td>
        {/* FIGMA-DEV: Применяем кастомный класс к чекбоксу */}
        <Form.Check
          type="checkbox"
          id={`collection-${collection.id}`}
          checked={selectedCollectionIds.has(collection.id)}
          onChange={(e) => handleCollectionSelectionChange(collection.id, e.target.checked)}
          className="float-start me-2 figma-checkbox"
        />
        <div>
          <strong>{collection.name}</strong> <br />
          <small className="text-muted">{collection.id}</small>
          {collection.type && (
            // FIGMA-DEV: Используем определенный класс для Badge
            <Badge bg={null} className={badgeClass}>
              {collection.type}
            </Badge>
          )}
        </div>
      </td>
      {visibleProjects.map((project) => (
        <GridCell
          key={`${collection.id}-${project.id}`}
          cellData={collection.cells?.[project.id]}
          onClick={() => openSelectionModal(collection.id, project.id)}
          generationStatusFilter={generationStatusFilter}
        />
      ))}
      {shouldShowPromptColumn && (
        <td className="align-top position-relative" style={{ padding: 0, minWidth: 220 }}>
          <div
            className="prompt-flex-container"
            style={{ display: 'flex', flexDirection: 'column', height: 145, gap: 2 }}
          >
            {showPositivePrompt && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Form.Control
                  as="textarea"
                  placeholder="Positive Prompt"
                  value={localPositive}
                  onChange={(e) => setLocalPositive(e.target.value)}
                  style={{
                    flex: 1,
                    minHeight: 32,
                    maxHeight: '100%',
                    resize: 'none',
                    overflow: 'auto',
                  }}
                  className={`figma-textarea`}
                  isInvalid={positivePromptInvalid}
                />
              </div>
            )}
            {showNegativePrompt && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Form.Control
                  as="textarea"
                  placeholder="Negative Prompt"
                  value={localNegative}
                  onChange={(e) => setLocalNegative(e.target.value)}
                  style={{
                    flex: 1,
                    minHeight: 32,
                    maxHeight: '100%',
                    resize: 'none',
                    overflow: 'auto',
                  }}
                  className={`figma-textarea`}
                />
              </div>
            )}
            {showCollectionComment && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Form.Control
                  as="textarea"
                  placeholder="Комментарий"
                  value={localComment}
                  onChange={(e) => setLocalComment(e.target.value)}
                  style={{
                    flex: 1,
                    minHeight: 32,
                    maxHeight: '100%',
                    resize: 'none',
                    overflow: 'auto',
                  }}
                  className={`figma-textarea`}
                />
              </div>
            )}
          </div>
        </td>
      )}
    </tr>
  );
};

export default GridRow;
