import React from 'react';
import { Col } from 'react-bootstrap';

const SkeletonLoader = () => {
  return (
    <Col xs="auto">
      <div className="bottom-grid-item skeleton-loader" />
    </Col>
  );
};

export default SkeletonLoader; 