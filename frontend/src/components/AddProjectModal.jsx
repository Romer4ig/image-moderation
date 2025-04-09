import React, { useState } from 'react';
import axios from 'axios';
import { Modal, Button, Form, Spinner, Alert, Row, Col } from 'react-bootstrap';

const API_URL = 'http://localhost:5001/api';

const AddProjectModal = ({ show, onHide, onSuccess }) => {
  const [name, setName] = useState('');
  const [basePositivePrompt, setBasePositivePrompt] = useState('');
  const [baseNegativePrompt, setBaseNegativePrompt] = useState('');
  const [defaultWidth, setDefaultWidth] = useState(512);
  const [defaultHeight, setDefaultHeight] = useState(512);
  const [baseGenerationParamsJsonString, setBaseGenerationParamsJsonString] = useState('{}');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [jsonError, setJsonError] = useState(null); // Ошибка валидации JSON

  const handleJsonChange = (e) => {
    const jsonString = e.target.value;
    setBaseGenerationParamsJsonString(jsonString);
    // Простая валидация JSON при вводе
    try {
      if (jsonString.trim()) { // Пытаемся парсить только непустую строку
        JSON.parse(jsonString);
      }
      setJsonError(null); // Ошибки нет
    } catch (err) {
      setJsonError('Невалидный JSON'); // Есть ошибка
    }
  };

  const resetForm = () => {
      setName('');
      setBasePositivePrompt('');
      setBaseNegativePrompt('');
      setDefaultWidth(512);
      setDefaultHeight(512);
      setBaseGenerationParamsJsonString('{}');
      setIsSubmitting(false);
      setError(null);
      setJsonError(null);
  };

  const handleClose = () => {
    resetForm();
    onHide();
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setJsonError(null);

    if (!name.trim()) {
      setError('Название проекта обязательно');
      return;
    }

    let paramsJson = {};
    if (baseGenerationParamsJsonString.trim()) {
        try {
            paramsJson = JSON.parse(baseGenerationParamsJsonString);
        } catch (err) {
            setJsonError('Невалидный JSON');
            setError('Пожалуйста, исправьте формат дополнительных параметров.');
            return;
        }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        base_positive_prompt: basePositivePrompt,
        base_negative_prompt: baseNegativePrompt,
        default_width: Number(defaultWidth) || 512, // Преобразуем в число или дефолт
        default_height: Number(defaultHeight) || 512,
        base_generation_params_json: paramsJson,
      };
      await axios.post(`${API_URL}/projects`, payload);
      handleClose(); // Закрываем и сбрасываем форму
      onSuccess(); // Вызываем колбэк для обновления списка
    } catch (err) {
      console.error("Error creating project:", err);
      setError(err.response?.data?.error || err.message || 'Не удалось создать проект');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Новый проект</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
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
                    min="64" // Примерные ограничения
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
              onChange={handleJsonChange} // Используем специальный обработчик
              isInvalid={!!jsonError} // Показываем ошибку, если JSON невалидный
              disabled={isSubmitting}
              placeholder='{ "sampler_name": "DPM++ 2M Karras", "cfg_scale": 7 ... }'
            />
            <Form.Control.Feedback type="invalid">
              {jsonError}
            </Form.Control.Feedback>
             <Form.Text muted>
                 Введите валидный JSON объект или оставьте пустым.
            </Form.Text>
          </Form.Group>
          
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
          Отмена
        </Button>
        {/* Кнопка отправки теперь вне формы, используем onClick */}
        <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting || !!jsonError}>
          {isSubmitting ? <Spinner as="span" animation="border" size="sm" /> : 'Создать'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddProjectModal; 