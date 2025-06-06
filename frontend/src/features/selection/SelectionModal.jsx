import React from "react";
import "./SelectionModal.css";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import TopRowPreview from "./components/TopRowPreview";
import ProjectFilters from "./components/ProjectFilters";
import AttemptGrid from "./components/AttemptGrid";
import { SelectionProvider, useSelectionContext } from "./context/SelectionContext";

const ModalContent = () => {
  const {
    loading,
    error,
    modalData,
    topRowItems,
    activeProjectId,
    handleProjectClick,
    loadingAttempts,
    displayedAttempts,
    selectedAttempt,
    persistedSelectedFileId,
    handleAttemptClick,
    isSubmitting,
    handleConfirmSelection,
    onHide,
    pendingSelections,
  } = useSelectionContext();

  const activeProjectName = 
    topRowItems.find(p => p.project_id === activeProjectId)?.project_name || 
    modalData?.target_project?.name;

  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" /> Загрузка...
      </div>
    );
  }
  if (error) {
    return <Alert variant="danger">{error.message || "Произошла ошибка"}</Alert>;
  }
  if (!modalData) {
    return <Alert variant="warning">Нет данных для отображения.</Alert>;
  }

  return (
    <>
    <Modal.Header closeButton>
      <Modal.Title as="h6">Выбранные обложки для сборника "{modalData?.collection?.name}"</Modal.Title>
    </Modal.Header>
    <Modal.Body className="px-3" style={{ maxHeight: "70vh", overflowY: "auto" }}>
      <TopRowPreview topRowItems={topRowItems} projectId={activeProjectId} onProjectClick={handleProjectClick} />

      <h5 className="mt-4 fw-semibold">Выбор обложки для проекта "{activeProjectName}"</h5>
      
      <ProjectFilters />

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
    </Modal.Body>
    <Modal.Footer>
      <Button variant="secondary" onClick={onHide}>
        Отмена
      </Button>
      <Button
        variant="primary"
        onClick={handleConfirmSelection}
        disabled={Object.keys(pendingSelections).length === 0 || isSubmitting || loading}
      >
        {isSubmitting ? (
          <>
            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
            Сохранение...
          </>
        ) : (
          `Сохранить (${Object.keys(pendingSelections).length})`
        )}
      </Button>
    </Modal.Footer>
  </>
);
};

const SelectionModal = ({ show, onHide, collectionId, projectId: initialProjectId, onSelectionConfirmed }) => {
  // We need to check for `show` to ensure that the provider and all its state
  // are created only when the modal is visible, and destroyed when it's hidden.
  if (!show) {
    return null;
  }

  return (
    <Modal show={show} onHide={onHide} size="xl" centered backdrop="static">
      <SelectionProvider
        show={show}
        onHide={onHide}
        collectionId={collectionId}
        projectId={initialProjectId}
        onSelectionConfirmed={onSelectionConfirmed}
      >
        <ModalContent />
      </SelectionProvider>
    </Modal>
  );
};

export default SelectionModal;
