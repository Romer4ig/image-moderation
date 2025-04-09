import React from "react";
import { Row, Col, Image, Spinner } from "react-bootstrap";
import { CheckCircleFill } from "react-bootstrap-icons";

const AttemptGrid = ({
  loadingAttempts,
  displayedAttempts,
  selectedAttempt,
  handleAttemptClick,
}) => {
  if (loadingAttempts) {
    return (
      <div className="text-center p-3">
        <Spinner animation="border" size="sm" /> Загрузка вариантов...
      </div>
    );
  }

  return (
    <Row className="g-0 bottom-grid-scroll">
      {displayedAttempts.length > 0 ? (
        displayedAttempts.map((attempt) => (
          <Col xs="auto" key={attempt.generated_file_id}>
            <div
              className={`bottom-grid-item position-relative clickable ${selectedAttempt.generated_file_id === attempt.generated_file_id ? "selected-border" : ""}`}
              onClick={() => handleAttemptClick(attempt)}
            >
              <Image
                src={attempt.file_url}
                alt={`Attempt ${attempt.generation_id} (Project ${attempt.origin_project_id})`}
              />
              {selectedAttempt.generated_file_id === attempt.generated_file_id && (
                <CheckCircleFill
                  size={24}
                  className="text-primary position-absolute top-0 end-0 m-1 bg-white rounded-circle"
                />
              )}
            </div>
          </Col>
        ))
      ) : (
        <Col>
          <p>Нет завершенных генераций для выбранных проектов и коллекции.</p>
        </Col>
      )}
    </Row>
  );
};

export default AttemptGrid; 