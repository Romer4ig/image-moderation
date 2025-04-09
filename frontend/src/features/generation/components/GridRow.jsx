import React from "react";
import {
  Form,
  Badge,
} from "react-bootstrap";
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
  handlePromptChange,
  handleAutoSaveCollectionField,
  fieldSaveStatus,
  renderFieldStatus,
}) => {

  const positivePromptInvalid = !collection.collection_positive_prompt;
  const positiveStatus = fieldSaveStatus[collection.id]?.positive || {};
  const negativeStatus = fieldSaveStatus[collection.id]?.negative || {};
  const commentStatus = fieldSaveStatus[collection.id]?.comment || {};

  return (
    <tr key={collection.id}>
      <td>
        <Form.Check
          type="checkbox"
          id={`collection-${collection.id}`}
          checked={selectedCollectionIds.has(collection.id)}
          onChange={(e) =>
            handleCollectionSelectionChange(collection.id, e.target.checked)
          }
          className="float-start me-2"
        />
        <div>
          <strong>{collection.name}</strong> <br />
          <small className="text-muted">{collection.id}</small>
          {collection.type && (
            <Badge bg="secondary" className="ms-2">
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
        />
      ))}
      {shouldShowPromptColumn && (
        <td className="align-top position-relative">
          {showPositivePrompt && (
            <div className="position-relative mb-1">
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Positive Prompt"
                value={collection.collection_positive_prompt || ""}
                onChange={(e) =>
                  handlePromptChange(collection.id, "positive", e.target.value)
                }
                onBlur={(e) =>
                  handleAutoSaveCollectionField(
                    collection.id,
                    "positive",
                    e.target.value
                  )
                }
                size="sm"
                className={`${positiveStatus.saved && !positivePromptInvalid ? "border border-success" : ""}`}
                isInvalid={positivePromptInvalid && !positiveStatus.saved}
              />
              <div className="position-absolute" style={{ top: "5px", right: "5px" }}>
                {renderFieldStatus(collection.id, "positive")}
              </div>
            </div>
          )}
          {showNegativePrompt && (
            <div className="position-relative mb-1">
              <Form.Control
                as="textarea"
                rows={1}
                placeholder="Negative Prompt"
                value={collection.collection_negative_prompt || ""}
                onChange={(e) =>
                  handlePromptChange(collection.id, "negative", e.target.value)
                }
                onBlur={(e) =>
                  handleAutoSaveCollectionField(
                    collection.id,
                    "negative",
                    e.target.value
                  )
                }
                size="sm"
                className={`${negativeStatus.saved ? "border border-success" : ""}`}
              />
              <div className="position-absolute" style={{ top: "5px", right: "5px" }}>
                {renderFieldStatus(collection.id, "negative")}
              </div>
            </div>
          )}
          {showCollectionComment && (
            <div className="position-relative">
              <Form.Control
                as="textarea"
                rows={1}
                placeholder="Комментарий"
                value={collection.comment || ""}
                onChange={(e) =>
                  handlePromptChange(collection.id, "comment", e.target.value)
                }
                onBlur={(e) =>
                  handleAutoSaveCollectionField(
                    collection.id,
                    "comment",
                    e.target.value
                  )
                }
                size="sm"
                className={`${commentStatus.saved ? "border border-success" : ""}`}
              />
              <div className="position-absolute" style={{ top: "5px", right: "5px" }}>
                {renderFieldStatus(collection.id, "comment")}
              </div>
            </div>
          )}
        </td>
      )}
    </tr>
  );
};

export default GridRow; 