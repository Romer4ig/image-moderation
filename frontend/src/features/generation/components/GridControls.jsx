import React, { useRef, useState } from "react";
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
  ToastContainer,
  Toast,
} from "react-bootstrap";
import { SortDown, SortUp, FunnelFill, TagFill, Upload } from "react-bootstrap-icons";
import { importCollectionsCSV } from "../../../services/api";

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
  generationStatusFilter,
  setGenerationStatusFilter,
  onImportSuccess,
}) => {
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importToast, setImportToast] = useState({ show: false, message: "", variant: "success" });

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportToast({ show: false, message: "", variant: "success" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await importCollectionsCSV(formData);
      setImportToast({
        show: true,
        variant: "success",
        message: `Импорт завершен: Добавлено ${result.added_count}, Пропущено дубликатов: ${result.skipped_duplicates}, Ошибки: ${result.skipped_errors}`,
      });
      if (result.added_count > 0 && typeof onImportSuccess === 'function') {
        onImportSuccess();
      }
      console.log("Import result:", result);
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || "Неизвестная ошибка импорта";
      setImportToast({ show: true, variant: "danger", message: `Ошибка импорта: ${errorMsg}` });
      console.error("Error importing CSV:", error);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <Accordion
        defaultActiveKey={["1"]}
        alwaysOpen
        className="mb-3 generation-grid-accordion"
      >
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
              className="figma-checkbox"
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
                  className="figma-checkbox"
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
                  className="figma-checkbox"
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
                      className="figma-checkbox"
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
                  className="figma-checkbox"
                />
                <Form.Check
                  type="checkbox"
                  id="show-negative-prompt"
                  label="Negative Prompt"
                  checked={showNegativePrompt}
                  onChange={(e) => setShowNegativePrompt(e.target.checked)}
                  className="figma-checkbox"
                />
                <Form.Check
                  type="checkbox"
                  id="show-collection-comment"
                  label="Комментарий"
                  checked={showCollectionComment}
                  onChange={(e) => setShowCollectionComment(e.target.checked)}
                  className="figma-checkbox"
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
                    className="w-100 text-start figma-button figma-button-outline-secondary"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>
                    {{
                      created_at: "Дата создания",
                      name: "Название",
                      last_generation_at: "Дата генерации",
                    }[sortConfig.key] || "???"}
                    </span>
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
                    className="w-100 text-start figma-button figma-button-outline-secondary"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>
                    {
                      {
                        all: "Все",
                        empty_positive: "Пустой Positive",
                        no_dynamic: "Нет Dynamic Prompts",
                        has_comment: "Есть комментарий",
                      }[advancedFilter] || "???"
                    }
                    </span>
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
                    id="dropdown-type-filter"
                    className="w-100 text-start figma-button figma-button-outline-secondary"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span>
                    {typeFilter === "all" ? "Все типы" : typeFilter}
                    </span>
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

      <Row className="mb-3 gx-2 align-items-center">
        <Col md={5}>
          <InputGroup size="sm" className="figma-search-group">
            <Form.Control
              type="text"
              placeholder="Найти сборник по ID или названию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button variant="primary">
              Найти
            </Button>
          </InputGroup>
        </Col>
        <Col md={4}>
          <ButtonGroup className="w-100 figma-status-filter">
            <Button
              variant={generationStatusFilter === "all" ? "primary" : "outline-primary"}
              className={generationStatusFilter === "all" ? "active" : ""}
              onClick={() => setGenerationStatusFilter("all")}
            >
              Все
            </Button>
            <Button
              variant={generationStatusFilter === "not_selected" ? "primary" : "outline-primary"}
              className={generationStatusFilter === "not_selected" ? "active" : ""}
              onClick={() => setGenerationStatusFilter("not_selected")}
            >
              Не выбрано
            </Button>
            <Button
              variant={generationStatusFilter === "not_generated" ? "primary" : "outline-primary"}
              className={generationStatusFilter === "not_generated" ? "active" : ""}
              onClick={() => setGenerationStatusFilter("not_generated")}
            >
              Не сгенерировано
            </Button>
          </ButtonGroup>
        </Col>
        <Col md={3} className="text-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
            accept=".csv"
            disabled={isImporting}
          />
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleImportClick}
            disabled={isImporting}
            className="me-2 figma-button figma-button-outline-secondary"
          >
            {isImporting ? (
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
            ) : (
              <Upload className="me-1" />
            )}
            Импорт CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="me-2 figma-button figma-button-primary"
          >
            Добавить сборник
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={handleGenerateSelected}
            disabled={isSubmittingGenerations || selectedCollectionIds.size === 0}
            className="figma-button figma-button-primary"
          >
            {isSubmittingGenerations ? (
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
            ) : (
              "Сгенерировать"
            )}
          </Button>
        </Col>
      </Row>
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1050 }}>
        <Toast
          onClose={() => setImportToast({ ...importToast, show: false })}
          show={importToast.show}
          delay={5000}
          autohide
          bg={importToast.variant}
        >
          <Toast.Header closeButton={true}>
            <strong className="me-auto">Импорт CSV</strong>
          </Toast.Header>
          <Toast.Body className={importToast.variant === 'danger' ? 'text-white' : ''}>
             {importToast.message}
           </Toast.Body>
        </Toast>
      </ToastContainer>
    </>
  );
};

export default GridControls;
