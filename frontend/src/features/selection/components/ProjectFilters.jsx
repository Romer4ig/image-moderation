import React from "react";
import { Row, Col, Form } from "react-bootstrap";
import { useSelectionContext } from "../context/SelectionContext";

const ProjectFilters = () => {
  const { topRowItems, selectedProjectIds, handleCheckboxChange } = useSelectionContext();

  // Используем topRowItems, так как в нем уже есть правильные псевдонимы project_id и project_name
  const projects = topRowItems || [];

  return (
    <Row className="align-items-center mb-3">
      <Col xs="auto">
        <Form.Label className="me-2 mb-0 fw-medium">Показывать генерации для:</Form.Label>
      </Col>
      <Col>
        {projects.length > 0 ? (
          projects.map((p) => (
            <Form.Check
              inline
              type="checkbox"
              key={p.project_id}
              id={`cb-${p.project_id}`}
              label={p.project_name}
              value={p.project_id}
              checked={selectedProjectIds.includes(p.project_id)}
              onChange={handleCheckboxChange}
            />
          ))
        ) : (
          <span className="text-muted">Загрузка проектов...</span>
        )}
      </Col>
    </Row>
  );
};

export default ProjectFilters;
