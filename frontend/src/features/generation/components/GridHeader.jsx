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
      <tr>
        <th>
          <Form.Check
            type="checkbox"
            id="select-all-collections"
            checked={allVisibleCollectionsSelected}
            onChange={(e) => handleSelectAllCollections(e.target.checked)}
            title="Выбрать все видимые на странице"
            className="float-start me-2"
            disabled={sortedAndFilteredCollections.length === 0}
          />
          Title / ID
        </th>
        {visibleProjects.map((project) => (
          <th key={project.id}>{project.name}</th>
        ))}
        {shouldShowPromptColumn && <th>Prompt / Комментарий</th>}
      </tr>
    </thead>
  );
};

export default GridHeader;
