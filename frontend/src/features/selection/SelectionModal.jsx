import React, { useState, useEffect } from "react";
import "./SelectionModal.css";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import { useSelectionData } from "./hooks/useSelectionData";
import { useAttemptSelection } from "./hooks/useAttemptSelection";
import TopRowPreview from "./components/TopRowPreview";
import ProjectFilters from "./components/ProjectFilters";
import AttemptGrid from "./components/AttemptGrid";

const SelectionModal = ({ show, onHide, collectionId, projectId: initialProjectId, onSelectionConfirmed }) => {
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  useEffect(() => {
    if (show) {
        setActiveProjectId(initialProjectId);
    } else {
        setActiveProjectId(null);
    }
  }, [show, initialProjectId]);

  const {
    modalData,
    loading,
    error,
    topRowItems,
    setTopRowItems,
    selectedProjectIds,
    displayedAttempts,
    loadingAttempts,
    handleCheckboxChange,
    persistedSelectedFileId,
  } = useSelectionData(show, collectionId, activeProjectId);

  const { selectedAttempt, isSubmitting, handleAttemptClick, handleConfirmSelection } =
    useAttemptSelection(collectionId, activeProjectId, setTopRowItems, onSelectionConfirmed, onHide);

  const handleProjectClick = (projectId) => {
    setActiveProjectId(projectId);
  };

  const renderModalContent = () => {
    if (loading) {
      return (
        <div className="text-center p-5">
          <Spinner animation="border" /> Загрузка...
        </div>
      );
    }
    if (error) {
      return <Alert variant="danger">{error}</Alert>;
    }
    if (!modalData) {
      return <Alert variant="warning">Нет данных для отображения.</Alert>;
    }

    return (
      <>
        <TopRowPreview topRowItems={topRowItems} projectId={activeProjectId} onProjectClick={handleProjectClick} />

        <h5 className="mt-4 fw-semibold">
          Выбор обложки для проекта "{modalData.target_project?.name}"
        </h5>
        <ProjectFilters
          projects={modalData.top_row_projects}
          selectedProjectIds={selectedProjectIds}
          handleCheckboxChange={handleCheckboxChange}
        />
        <Row className="align-items-center mb-3">
          <Col md={8}>
            <Form.Control
              as="textarea"
              rows={1}
              placeholder="Комментарий: Ну картинки сильно одинаковые, перегенерируйте"
            />
          </Col>
          <Col md={4} className="text-end">
            <Button variant="outline-primary">Отправить</Button>
          </Col>
        </Row>

        <AttemptGrid
          loadingAttempts={loadingAttempts}
          displayedAttempts={displayedAttempts}
          selectedAttempt={selectedAttempt}
          persistedSelectedFileId={persistedSelectedFileId}
          handleAttemptClick={handleAttemptClick}
        />
      </>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title as="h6">
          Выбранные обложки для сборника "{modalData?.collection?.name}"
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="px-3" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        {renderModalContent()}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Отмена
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirmSelection}
          disabled={!selectedAttempt.generated_file_id || isSubmitting || loading}
        >
          {isSubmitting ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
              Сохранение...
            </>
          ) : (
            "Установить выбранную"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default SelectionModal;
