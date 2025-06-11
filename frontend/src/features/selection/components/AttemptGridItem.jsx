import React, { memo } from "react";
import { Col, Image } from "react-bootstrap";
import { CheckCircleFill } from "react-bootstrap-icons";
import { useSelectionContext } from "../context/SelectionContext";

const AttemptGridItem = ({ attempt }) => {
  const {
    activeProjectId,
    pendingSelections,
    persistedSelectedFileId,
    handleAttemptClick,
  } = useSelectionContext();

  const pendingSelectionForActiveProject = pendingSelections[activeProjectId];
  const isSelected = pendingSelectionForActiveProject?.generated_file_id === attempt.generated_file_id;
  
  // Показываем "сохраненную" галку только если для этого проекта нет нового выбора в очереди
  const pendingSelectionForThisProject = pendingSelections[attempt.project_id];
  const isPersisted = persistedSelectedFileId === attempt.generated_file_id && !pendingSelectionForThisProject;

  return (
    <Col xs="auto">
      <div
        className={`bottom-grid-item position-relative clickable ${isSelected ? "selected-border" : ""}`}
        onClick={() => handleAttemptClick(attempt)}
      >
        <Image
          src={attempt.file_url}
          alt={`Attempt ${attempt.generation_id} (Project ${attempt.origin_project_id})`}
        />
        {isPersisted && (
          <CheckCircleFill
            size={24}
            className="text-primary position-absolute top-0 end-0 m-1 bg-white rounded-circle"
          />
        )}
      </div>
    </Col>
  );
};

export default memo(AttemptGridItem); 