import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Spinner, Alert, Row, Col } from "react-bootstrap";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject } from "../../services/api";

const AddProjectModal = ({ show, onHide, onSuccess }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [selectionPath, setSelectionPath] = useState("");
  const [basePositivePrompt, setBasePositivePrompt] = useState("");
  const [baseNegativePrompt, setBaseNegativePrompt] = useState("");
  const [defaultWidth, setDefaultWidth] = useState(512);
  const [defaultHeight, setDefaultHeight] = useState(512);
  const [baseGenerationParamsJsonString, setBaseGenerationParamsJsonString] = useState("{}");
  const [jsonError, setJsonError] = useState(null);

  const {
    mutate: addProjectMutate,
    isLoading: isSubmitting,
    error,
    reset,
  } = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries(["projects"]);
      handleClose();
      onSuccess();
    },
  });

  useEffect(() => {
    if (!show) {
      reset();
    }
  }, [show, reset]);

  const handleJsonChange = (e) => {
    const jsonString = e.target.value;
    setBaseGenerationParamsJsonString(jsonString);
    try {
      if (jsonString.trim()) {
        JSON.parse(jsonString);
      }
      setJsonError(null);
    } catch {
      setJsonError("Невалидный JSON");
    }
  };

  const resetForm = () => {
    setName("");
    setPath("");
    setSelectionPath("");
    setBasePositivePrompt("");
    setBaseNegativePrompt("");
    setDefaultWidth(512);
    setDefaultHeight(512);
    setBaseGenerationParamsJsonString("{}");
    setJsonError(null);
    reset();
  };

  const handleClose = () => {
    resetForm();
    onHide();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setJsonError(null);

    if (!name.trim()) {
      return;
    }

    let paramsJson = {};
    if (baseGenerationParamsJsonString.trim()) {
      try {
        paramsJson = JSON.parse(baseGenerationParamsJsonString);
      } catch {
        setJsonError("Невалидный JSON");
        return;
      }
    }

    const payload = {
      name: name.trim(),
      path: path.trim(),
      selection_path: selectionPath.trim(),
      base_positive_prompt: basePositivePrompt,
      base_negative_prompt: baseNegativePrompt,
      default_width: Number(defaultWidth) || 512,
      default_height: Number(defaultHeight) || 512,
      base_generation_params_json: paramsJson,
    };

    addProjectMutate(payload);
  };

  const mutationError = error?.response?.data?.error || error?.message;

  return (
    <Modal show={show} onHide={handleClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Новый проект</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {mutationError && <Alert variant="danger">{mutationError}</Alert>}
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="projectName">
            <Form.Label>Название проекта*</Form.Label>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="projectPath">
            <Form.Label>Путь сохранения</Form.Label>
            <Form.Control
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              disabled={isSubmitting}
              placeholder="Например, /mnt/generated_images/my_project или my_project_folder"
            />
            <Form.Text muted>
              Опционально. Если указано, файлы генераций будут сохраняться в этой директории (относительно базовой директории генераций на сервере).
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3" controlId="projectSelectionPath">
            <Form.Label>Путь выбранных</Form.Label>
            <Form.Control
              type="text"
              value={selectionPath}
              onChange={(e) => setSelectionPath(e.target.value)}
              disabled={isSubmitting}
              placeholder="Например, /mnt/selected_images/my_project или selected_covers"
            />
            <Form.Text muted>
              Опционально. Если указано, выбранные обложки будут копироваться в эту директорию.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3" controlId="projectBasePositivePrompt">
            <Form.Label>Базовый позитивный промпт</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={basePositivePrompt}
              onChange={(e) => setBasePositivePrompt(e.target.value)}
              disabled={isSubmitting}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="projectBaseNegativePrompt">
            <Form.Label>Базовый негативный промпт</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={baseNegativePrompt}
              onChange={(e) => setBaseNegativePrompt(e.target.value)}
              disabled={isSubmitting}
            />
          </Form.Group>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="projectDefaultWidth">
                <Form.Label>Ширина по умолч.</Form.Label>
                <Form.Control
                  type="number"
                  value={defaultWidth}
                  onChange={(e) => setDefaultWidth(e.target.value)}
                  disabled={isSubmitting}
                  min="64"
                  step="8"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="projectDefaultHeight">
                <Form.Label>Высота по умолч.</Form.Label>
                <Form.Control
                  type="number"
                  value={defaultHeight}
                  onChange={(e) => setDefaultHeight(e.target.value)}
                  disabled={isSubmitting}
                  min="64"
                  step="8"
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3" controlId="projectBaseGenerationParams">
            <Form.Label>Доп. параметры генерации (JSON)</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={baseGenerationParamsJsonString}
              onChange={handleJsonChange}
              isInvalid={!!jsonError}
              disabled={isSubmitting}
              placeholder='{ "sampler_name": "DPM++ 2M Karras", "cfg_scale": 7 ... }'
            />
            <Form.Control.Feedback type="invalid">{jsonError}</Form.Control.Feedback>
            <Form.Text muted>Введите валидный JSON объект или оставьте пустым.</Form.Text>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
          Отмена
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !!jsonError}>
          {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : "Создать"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddProjectModal;
