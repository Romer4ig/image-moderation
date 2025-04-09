import React from "react";
import { Accordion, Spinner, Alert, Button, Form, Row, Col } from "react-bootstrap";
import { Save } from "react-bootstrap-icons";

const ProjectAccordionItem = ({
  project,
  localChanges,
  savingStatus,
  handleProjectChange,
  handleSaveProject,
}) => {
  const status = savingStatus[project.id] || {
    isSaving: false,
    error: null,
    jsonError: null,
  };

  const getFieldValue = (fieldName) => {
    return localChanges?.[fieldName] !== undefined ? localChanges[fieldName] : project[fieldName];
  };

  return (
    <Accordion.Item eventKey={project.id} key={project.id}>
      <Accordion.Header>{getFieldValue("name")}</Accordion.Header>
      <Accordion.Body>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveProject(project.id);
          }}
        >
          {status.error && (
            <Alert variant="danger" size="sm">
              {status.error}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Название проекта*</Form.Label>
            <Form.Control
              type="text"
              value={getFieldValue("name")}
              onChange={(e) => handleProjectChange(project.id, "name", e.target.value)}
              required
              disabled={status.isSaving}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Базовый позитивный промпт</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={getFieldValue("base_positive_prompt")}
              onChange={(e) =>
                handleProjectChange(project.id, "base_positive_prompt", e.target.value)
              }
              disabled={status.isSaving}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Базовый негативный промпт</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={getFieldValue("base_negative_prompt")}
              onChange={(e) =>
                handleProjectChange(project.id, "base_negative_prompt", e.target.value)
              }
              disabled={status.isSaving}
            />
          </Form.Group>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Ширина по умолч.</Form.Label>
                <Form.Control
                  type="number"
                  min="64"
                  step="8"
                  value={getFieldValue("default_width")}
                  onChange={(e) => handleProjectChange(project.id, "default_width", e.target.value)}
                  disabled={status.isSaving}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Высота по умолч.</Form.Label>
                <Form.Control
                  type="number"
                  min="64"
                  step="8"
                  value={getFieldValue("default_height")}
                  onChange={(e) =>
                    handleProjectChange(project.id, "default_height", e.target.value)
                  }
                  disabled={status.isSaving}
                />
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label>Доп. параметры (JSON)</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              value={getFieldValue("jsonString")}
              onChange={(e) => handleProjectChange(project.id, "jsonString", e.target.value)}
              isInvalid={!!status.jsonError}
              disabled={status.isSaving}
            />
            <Form.Control.Feedback type="invalid">{status.jsonError}</Form.Control.Feedback>
          </Form.Group>
          <div className="d-flex justify-content-end">
            <Button
              variant="primary"
              type="submit"
              disabled={status.isSaving || !!status.jsonError}
            >
              {status.isSaving ? <Spinner as="span" size="sm" /> : <Save className="me-1" />}
              Сохранить
            </Button>
          </div>
        </Form>
        <hr />
        <small className="text-muted">
          ID: {project.id} | Создан: {new Date(project.created_at).toLocaleString()} | Обновлен:{" "}
          {new Date(project.updated_at).toLocaleString()}
        </small>
      </Accordion.Body>
    </Accordion.Item>
  );
};

export default ProjectAccordionItem;
