import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Container, Accordion, Spinner, Alert, 
  Card, Button, Form, Row, Col
} from 'react-bootstrap';
import { PlusCircleFill, Save } from 'react-bootstrap-icons';
import AddProjectModal from '../components/AddProjectModal';

const API_URL = 'http://localhost:5001/api';

const ProjectsPage = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [savingStatus, setSavingStatus] = useState({});

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/projects`);
      const projectsWithJsonString = response.data.map(p => ({ 
          ...p, 
          jsonString: JSON.stringify(p.base_generation_params_json || {}, null, 2) 
      }));
      setProjects(projectsWithJsonString);
      setSavingStatus({}); 
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError(err.response?.data?.error || err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleAddSuccess = () => {
    fetchProjects();
  };

  const handleProjectChange = (projectId, field, value) => {
    setProjects(prevProjects => 
      prevProjects.map(p => {
        if (p.id === projectId) {
          const updatedProject = { ...p, [field]: value };
          if (field === 'jsonString') {
            let jsonError = null;
            try {
              if (value.trim()) { JSON.parse(value); }
            } catch (e) {
              jsonError = 'Невалидный JSON';
            }
            setSavingStatus(prevStatus => ({
                 ...prevStatus,
                 [projectId]: { ...prevStatus[projectId], jsonError: jsonError }
            }));
          }
          return updatedProject;
        }
        return p;
      })
    );
  };

  const handleSaveProject = async (projectId) => {
    const projectToSave = projects.find(p => p.id === projectId);
    if (!projectToSave) return;

    const currentJsonError = savingStatus[projectId]?.jsonError;

    setSavingStatus(prevStatus => ({
        ...prevStatus,
        [projectId]: { isSaving: true, error: null, jsonError: currentJsonError }
    }));
    
    let paramsJson = {};
    let finalJsonError = currentJsonError;

    if (projectToSave.jsonString && projectToSave.jsonString.trim()) {
      if (finalJsonError) {
         setSavingStatus(prevStatus => ({
            ...prevStatus,
            [projectId]: { isSaving: false, error: 'Ошибка в формате JSON.', jsonError: finalJsonError }
        }));
        return;
      }
       try {
          paramsJson = JSON.parse(projectToSave.jsonString);
       } catch (err) {
           finalJsonError = 'Невалидный JSON';
           setSavingStatus(prevStatus => ({
               ...prevStatus,
               [projectId]: { isSaving: false, error: 'Ошибка в формате JSON.', jsonError: finalJsonError }
           }));
           return;
       }
    }

    try {
      const payload = {
        name: projectToSave.name,
        base_positive_prompt: projectToSave.base_positive_prompt,
        base_negative_prompt: projectToSave.base_negative_prompt,
        default_width: Number(projectToSave.default_width) || 512,
        default_height: Number(projectToSave.default_height) || 512,
        base_generation_params_json: paramsJson,
      };
      
      const response = await axios.put(`${API_URL}/projects/${projectId}`, payload);
      
      setProjects(prevProjects => 
          prevProjects.map(p => p.id === projectId ? { ...response.data, jsonString: JSON.stringify(response.data.base_generation_params_json || {}, null, 2) } : p)
      );
       setSavingStatus(prevStatus => ({
           ...prevStatus,
           [projectId]: { isSaving: false, error: null, jsonError: null }
       }));

    } catch (err) {
        console.error(`Error updating project ${projectId}:`, err);
        const errorMsg = err.response?.data?.error || err.message || 'Не удалось сохранить изменения.';
        setSavingStatus(prevStatus => ({
            ...prevStatus,
            [projectId]: { isSaving: false, error: errorMsg, jsonError: finalJsonError }
        }));
    } 
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Проекты</h2>
        <Button variant="success" onClick={() => setShowAddModal(true)}>
          <PlusCircleFill className="me-1"/> Добавить проект
        </Button>
      </div>

      {loading && (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Загрузка...</span>
          </Spinner>
        </div>
      )}

      {error && <Alert variant="danger">Ошибка загрузки списка: {error}</Alert>}

      {!loading && !error && (
        <Accordion>
          {projects.length === 0 ? (
             <p>Проекты не найдены.</p>
          ) : (
            projects.map((project) => {
              const status = savingStatus[project.id] || { isSaving: false, error: null, jsonError: null };
              
              return (
                <Accordion.Item eventKey={project.id} key={project.id}>
                  <Accordion.Header>{project.name}</Accordion.Header>
                  <Accordion.Body>
                     <Form onSubmit={(e) => { e.preventDefault(); handleSaveProject(project.id); }}>
                          {status.error && <Alert variant="danger" size="sm">{status.error}</Alert>}
                          
                          <Form.Group className="mb-3">
                              <Form.Label>Название проекта*</Form.Label>
                              <Form.Control
                                type="text"
                                value={project.name}
                                onChange={(e) => handleProjectChange(project.id, 'name', e.target.value)}
                                required
                                disabled={status.isSaving}
                              />
                          </Form.Group>
                          <Form.Group className="mb-3">
                              <Form.Label>Базовый позитивный промпт</Form.Label>
                              <Form.Control
                                as="textarea" rows={3}
                                value={project.base_positive_prompt}
                                onChange={(e) => handleProjectChange(project.id, 'base_positive_prompt', e.target.value)}
                                disabled={status.isSaving}
                              />
                          </Form.Group>
                          <Form.Group className="mb-3">
                              <Form.Label>Базовый негативный промпт</Form.Label>
                              <Form.Control
                                as="textarea" rows={3}
                                value={project.base_negative_prompt}
                                onChange={(e) => handleProjectChange(project.id, 'base_negative_prompt', e.target.value)}
                                disabled={status.isSaving}
                              />
                          </Form.Group>
                          <Row>
                              <Col md={6}>
                                  <Form.Group className="mb-3">
                                      <Form.Label>Ширина по умолч.</Form.Label>
                                      <Form.Control type="number" min="64" step="8"
                                          value={project.default_width}
                                          onChange={(e) => handleProjectChange(project.id, 'default_width', e.target.value)}
                                          disabled={status.isSaving}/>
                                  </Form.Group>
                              </Col>
                              <Col md={6}>
                                  <Form.Group className="mb-3">
                                      <Form.Label>Высота по умолч.</Form.Label>
                                      <Form.Control type="number" min="64" step="8"
                                          value={project.default_height}
                                          onChange={(e) => handleProjectChange(project.id, 'default_height', e.target.value)}
                                          disabled={status.isSaving}/>
                                  </Form.Group>
                              </Col>
                          </Row>
                          <Form.Group className="mb-3">
                              <Form.Label>Доп. параметры (JSON)</Form.Label>
                              <Form.Control
                                as="textarea" rows={5} 
                                value={project.jsonString}
                                onChange={(e) => handleProjectChange(project.id, 'jsonString', e.target.value)}
                                isInvalid={!!status.jsonError}
                                disabled={status.isSaving}
                              />
                              <Form.Control.Feedback type="invalid">
                                  {status.jsonError}
                              </Form.Control.Feedback>
                          </Form.Group>
                          <div className="d-flex justify-content-end">
                              <Button 
                                 variant="primary" 
                                 type="submit"
                                 disabled={status.isSaving || !!status.jsonError}
                                 onClick={() => handleSaveProject(project.id)}
                              >
                                  {status.isSaving ? <Spinner as="span" size="sm" /> : <Save className="me-1"/>} Сохранить
                              </Button>
                          </div>
                      </Form>
                       <hr />
                       <small className="text-muted">
                           ID: {project.id} | 
                           Создан: {new Date(project.created_at).toLocaleString()} | 
                           Обновлен: {new Date(project.updated_at).toLocaleString()}
                       </small>
                  </Accordion.Body>
                </Accordion.Item>
              )
            })
          )}
        </Accordion>
      )}

      <AddProjectModal 
        show={showAddModal}
        onHide={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />
    </Container>
  );
};

export default ProjectsPage; 