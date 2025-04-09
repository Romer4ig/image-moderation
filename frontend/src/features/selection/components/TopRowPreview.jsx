import React from "react";
import { Row, Col, Image } from "react-bootstrap";

const TopRowPreview = ({ topRowItems }) => {
  return (
    <div className="top-row-scroll mb-3">
      <Row className="flex-nowrap">
        {topRowItems.map((item) => (
          <Col key={item.project_id} xs="auto" className={`text-center p-1`}>
            <small
              className="d-block text-truncate fw-medium"
              style={{ fontSize: "0.75rem" }}
              title={item.project_name}
            >
              {item.project_name}
            </small>
            {item.selected_cover ? (
              <Image
                src={item.selected_cover.file_url}
                thumbnail
                className={`top-row-thumb`}
                alt={`Selected for ${item.project_name}`}
              />
            ) : (
              <div className="placeholder-thumb bg-light d-flex align-items-center justify-content-center text-muted small">
                Не выбрано
              </div>
            )}
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default TopRowPreview;
