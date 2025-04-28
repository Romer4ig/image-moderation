import React from "react";
import { Form } from "react-bootstrap";

const GridHeader = ({
  allVisibleCollectionsSelected,
  handleSelectAllCollections,
  sortedAndFilteredCollections,
  visibleProjects,
  shouldShowPromptColumn,
}) => {
  return (
    <thead>
      <tr style={{ borderBottom: '2px solid rgba(0, 0, 0, 0.2)' }}>
        <th style={{ width: '180px' }}>
          <Form.Check
            type="checkbox"
            id="select-all-collections"
            checked={allVisibleCollectionsSelected}
            onChange={(e) => handleSelectAllCollections(e.target.checked)}
            title="Выбрать все видимые на странице"
            className="float-start me-2 figma-checkbox"
            disabled={sortedAndFilteredCollections.length === 0}
          />
          Title / ID
        </th>
        {visibleProjects.map((project) => (
          <th key={project.id} style={{ width: '158px' }}>{project.name}</th>
        ))}
        {shouldShowPromptColumn && <th>Prompt / Комментарий</th>}
      </tr>
    </thead>
  );
};

export default GridHeader;
