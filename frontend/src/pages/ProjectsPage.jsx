import React from "react";
import { Container, Accordion, Spinner, Alert, Button, Form, Row, Col } from "react-bootstrap";
import { PlusCircleFill } from "react-bootstrap-icons";
import AddProjectModal from "../features/projects/AddProjectModal";
import { useProjects } from "../features/projects/hooks/useProjects";
import ProjectAccordionItem from "../features/projects/components/ProjectAccordionItem";

const ProjectsPage = () => {
  const {
    projects,
    loading,
    error,
    savingStatus,
    showAddModal,
    setShowAddModal,
    handleAddSuccess,
    handleProjectChange,
    handleSaveProject,
    localProjectChanges,
  } = useProjects();

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Проекты</h2>
        <Button variant="success" onClick={() => setShowAddModal(true)}>
          <PlusCircleFill className="me-1" /> Добавить проект
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
            projects.map((project) => (
              <ProjectAccordionItem
                key={project.id}
                project={project}
                localChanges={localProjectChanges[project.id]}
                savingStatus={savingStatus}
                handleProjectChange={handleProjectChange}
                handleSaveProject={handleSaveProject}
              />
            ))
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
