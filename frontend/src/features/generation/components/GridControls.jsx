import React from "react";
import {
  Accordion,
  Form,
  Row,
  Col,
  Dropdown,
  InputGroup,
  ButtonGroup,
  Button,
  Spinner,
} from "react-bootstrap";
import {
  SortDown,
  SortUp,
  FunnelFill,
  TagFill,
} from "react-bootstrap-icons";

const GridControls = ({
  // Состояния и обработчики для опций генерации
  allProjectsList,
  projectsForGenerationIds,
  allGenerationProjectsSelected,
  handleGenerationProjectSelectionChange,
  handleSelectAllGenerationProjects,
  // Состояния и обработчики для опций отображения
  visibleColumnProjectIds,
  allColumnProjectsSelected,
  handleColumnProjectSelectionChange,
  handleSelectAllColumnProjects,
  showPositivePrompt,
  setShowPositivePrompt,
  showNegativePrompt,
  setShowNegativePrompt,
  showCollectionComment,
  setShowCollectionComment,
  // Состояния и обработчики для сортировки/фильтров
  sortConfig,
  setSortConfig,
  advancedFilter,
  setAdvancedFilter,
  typeFilter,
  setTypeFilter,
  collectionTypes,
  // Состояния и обработчики для поиска и действий
  searchTerm,
  setSearchTerm,
  setShowAddModal,
  handleGenerateSelected,
  isSubmittingGenerations,
  selectedCollectionIds,
}) => {
  return (
    <>
      <Accordion defaultActiveKey={["1"]} alwaysOpen className="mb-3">
        <Accordion.Item eventKey="0">
          <Accordion.Header>Параметры генерации</Accordion.Header>
          <Accordion.Body>
            <h5>Проекты для запуска генерации</h5>
            <Form.Check
              type="checkbox"
              id="select-all-generation-projects"
              label={`Все проекты (${allProjectsList.length})`}
              checked={allGenerationProjectsSelected}
              onChange={(e) => handleSelectAllGenerationProjects(e.target.checked)}
            />
            <div className="mt-2 mb-3" style={{ maxHeight: "100px", overflowY: "auto" }}>
              {allProjectsList.map((project) => (
                <Form.Check
                  key={`gen-${project.id}`}
                  type="checkbox"
                  id={`gen-project-${project.id}`}
                  label={project.name}
                  checked={projectsForGenerationIds.has(project.id)}
                  onChange={(e) =>
                    handleGenerationProjectSelectionChange(project.id, e.target.checked)
                  }
                  inline
                />
              ))}
            </div>
          </Accordion.Body>
        </Accordion.Item>
        <Accordion.Item eventKey="1">
          <Accordion.Header>Опции отображения грида</Accordion.Header>
          <Accordion.Body>
            <Row className="mb-3">
              <Col md={8}>
                <h5>Видимые колонки (Проекты)</h5>
                <Form.Check
                  type="checkbox"
                  id="select-all-column-projects"
                  label={`Все колонки (${allProjectsList.length})`}
                  checked={allColumnProjectsSelected}
                  onChange={(e) => handleSelectAllColumnProjects(e.target.checked)}
                />
                <div className="mt-2" style={{ maxHeight: "100px", overflowY: "auto" }}>
                  {allProjectsList.map((project) => (
                    <Form.Check
                      key={project.id}
                      type="checkbox"
                      id={`col-project-${project.id}`}
                      label={project.name}
                      checked={visibleColumnProjectIds.has(project.id)}
                      onChange={(e) =>
                        handleColumnProjectSelectionChange(project.id, e.target.checked)
                      }
                      inline
                    />
                  ))}
                </div>
              </Col>
              <Col md={4}>
                <h5>Отображать в таблице</h5>
                <Form.Check
                  type="checkbox"
                  id="show-positive-prompt"
                  label="Positive Prompt"
                  checked={showPositivePrompt}
                  onChange={(e) => setShowPositivePrompt(e.target.checked)}
                />
                <Form.Check
                  type="checkbox"
                  id="show-negative-prompt"
                  label="Negative Prompt"
                  checked={showNegativePrompt}
                  onChange={(e) => setShowNegativePrompt(e.target.checked)}
                />
                <Form.Check
                  type="checkbox"
                  id="show-collection-comment"
                  label="Комментарий"
                  checked={showCollectionComment}
                  onChange={(e) => setShowCollectionComment(e.target.checked)}
                />
              </Col>
            </Row>
            <Row className="mt-3 gx-2">
              <Col md={4}>
                <Form.Label>Сортировка</Form.Label>
                <Dropdown size="sm">
                  <Dropdown.Toggle
                    variant="outline-secondary"
                    id="dropdown-sort"
                    className="w-100 text-start"
                  >
                    {sortConfig.direction === "ascending" ? (
                      <SortUp className="me-1" />
                    ) : (
                      <SortDown className="me-1" />
                    )}
                    {{
                      created_at: "Дата создания",
                      name: "Название",
                      last_generation_at: "Дата генерации",
                    }[sortConfig.key] || "???"}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item
                      onClick={() =>
                        setSortConfig({ key: "last_generation_at", direction: "descending" })
                      }
                      active={
                        sortConfig.key === "last_generation_at" &&
                        sortConfig.direction === "descending"
                      }
                    >
                      Дата генерации (сначала новые)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() =>
                        setSortConfig({ key: "last_generation_at", direction: "ascending" })
                      }
                      active={
                        sortConfig.key === "last_generation_at" &&
                        sortConfig.direction === "ascending"
                      }
                    >
                      Дата генерации (сначала старые)
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      onClick={() => setSortConfig({ key: "created_at", direction: "descending" })}
                      active={
                        sortConfig.key === "created_at" && sortConfig.direction === "descending"
                      }
                    >
                      Дата создания (сначала новые)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => setSortConfig({ key: "created_at", direction: "ascending" })}
                      active={
                        sortConfig.key === "created_at" && sortConfig.direction === "ascending"
                      }
                    >
                      Дата создания (сначала старые)
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      onClick={() => setSortConfig({ key: "name", direction: "ascending" })}
                      active={sortConfig.key === "name" && sortConfig.direction === "ascending"}
                    >
                      Название (А-Я)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => setSortConfig({ key: "name", direction: "descending" })}
                      active={sortConfig.key === "name" && sortConfig.direction === "descending"}
                    >
                      Название (Я-А)
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </Col>
              <Col md={4}>
                <Form.Label>Фильтр</Form.Label>
                <Dropdown size="sm">
                  <Dropdown.Toggle
                    variant="outline-secondary"
                    id="dropdown-filter"
                    className="w-100 text-start"
                  >
                    <FunnelFill className="me-1" />
                    {
                      {
                        all: "Все",
                        empty_positive: "Пустой Positive",
                        no_dynamic: "Нет Dynamic Prompts",
                        has_comment: "Есть комментарий",
                      }[advancedFilter]
                    }
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item
                      onClick={() => setAdvancedFilter("all")}
                      active={advancedFilter === "all"}
                    >
                      Все
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => setAdvancedFilter("empty_positive")}
                      active={advancedFilter === "empty_positive"}
                    >
                      Пустой Positive Prompt
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => setAdvancedFilter("no_dynamic")}
                      active={advancedFilter === "no_dynamic"}
                    >
                      Нет Dynamic Prompts ({}, |)
                    </Dropdown.Item>
                    <Dropdown.Item
                      onClick={() => setAdvancedFilter("has_comment")}
                      active={advancedFilter === "has_comment"}
                    >
                      Есть комментарий
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </Col>
              <Col md={4}>
                <Form.Label>Тип сборника</Form.Label>
                <Dropdown size="sm">
                  <Dropdown.Toggle
                    variant="outline-secondary"
                    id="dropdown-type"
                    className="w-100 text-start"
                  >
                    <TagFill className="me-1" />
                    {typeFilter === "all" ? "Все типы" : typeFilter}
                  </Dropdown.Toggle>
                  <Dropdown.Menu style={{ maxHeight: "200px", overflowY: "auto" }}>
                    <Dropdown.Item
                      onClick={() => setTypeFilter("all")}
                      active={typeFilter === "all"}
                    >
                      Все типы
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    {collectionTypes.map((type) => (
                      <Dropdown.Item
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        active={typeFilter === type}
                      >
                        {type}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Col>
            </Row>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      <Row className="mb-3 align-items-center gx-2">
        <Col md={8} lg={9}>
          <InputGroup size="sm">
            <Form.Control
              placeholder="Найти сборник..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col md={4} lg={3} className="text-end">
          <ButtonGroup size="sm">
            <Button variant="outline-primary" onClick={() => setShowAddModal(true)}>
              Добавить
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateSelected}
              disabled={
                isSubmittingGenerations ||
                selectedCollectionIds.size === 0 ||
                projectsForGenerationIds.size === 0
              }
              title="Сгенерировать для выбранных коллекций и проектов (выбранных в параметрах генерации)"
            >
              {isSubmittingGenerations ? (
                <>
                  <Spinner as="span" animation="border" size="sm" /> Запуск...
                </>
              ) : (
                "Сгенерировать выбранные"
              )}
            </Button>
          </ButtonGroup>
        </Col>
      </Row>
    </>
  );
};

export default GridControls; 