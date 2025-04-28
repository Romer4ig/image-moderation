import React, { useState } from "react";
import axios from "axios";
import { Modal, Button, Form, Row, Col, InputGroup, Spinner, Alert } from "react-bootstrap";
import { PlusCircleFill, TrashFill } from "react-bootstrap-icons";

const API_URL = "http://localhost:5001/api";

const AddCollectionModal = ({ show, onHide, onSuccess }) => {
  const initialRow = { rowKey: Date.now(), id: "", type: "", name: "" };
  const [rows, setRows] = useState(() =>
    Array.from({ length: 5 }, (_, i) => ({ ...initialRow, rowKey: Date.now() + i }))
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResults, setSubmitResults] = useState({ success: 0, errors: [] });
  const [showResults, setShowResults] = useState(false);

  const collectionTypes = ["character", "style", "object", "scene", "other"];

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, { ...initialRow, rowKey: Date.now() }]);
  };

  const removeRow = (index) => {
    if (rows.length <= 1) return;
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  };

  const handleBatchSubmit = async () => {
    setIsSubmitting(true);
    setSubmitResults({ success: 0, errors: [] });
    setShowResults(false);

    const results = { success: 0, errors: [] };

    const validRows = rows.filter((row) => {
      const numericId = parseInt(row.id, 10);
      return !isNaN(numericId) && row.name;
    });

    const invalidFormatRows = rows.filter((row) => row.id && isNaN(parseInt(row.id, 10)));
    const missingFieldsRows = rows.filter(
      (row) => !(row.id && row.name) && (row.id || row.name || row.type)
    );

    if (
      validRows.length === 0 &&
      invalidFormatRows.length === 0 &&
      missingFieldsRows.length === 0
    ) {
      setSubmitResults({
        success: 0,
        errors: ["Нет данных для добавления. Заполните ID (число) и Название."],
      });
      setShowResults(true);
      setIsSubmitting(false);
      return;
    }

    if (invalidFormatRows.length > 0) {
      results.errors.push(
        `Обнаружены строки с неверным форматом ID (требуется число): ${invalidFormatRows.length} шт.`
      );
    }
    if (missingFieldsRows.length > 0) {
      results.errors.push(
        `Обнаружены не полностью заполненные строки (требуется ID, Название): ${missingFieldsRows.length} шт.`
      );
    }

    for (const row of validRows) {
      try {
        await axios.post(`${API_URL}/collections`, {
          id: parseInt(row.id, 10),
          name: row.name,
          type: row.type,
        });
        results.success += 1;
      } catch (err) {
        let errorMsg = `Ошибка при добавлении ID ${row.id} ('${row.name}')`;
        if (err.response?.data?.error) {
          errorMsg += `: ${err.response.data.error}`;
        } else if (err.message) {
          errorMsg += `: ${err.message}`;
        }
        results.errors.push(errorMsg);
        console.error(`Error adding collection ID ${row.id}:`, err);
      }
    }

    setSubmitResults(results);
    setShowResults(true);
    setIsSubmitting(false);

    if (results.success > 0) {
      onSuccess();
      setRows(() =>
        Array.from({ length: 5 }, (_, i) => ({ ...initialRow, rowKey: Date.now() + i }))
      );
    }
  };

  const handleClose = () => {
    setRows(() => Array.from({ length: 5 }, (_, i) => ({ ...initialRow, rowKey: Date.now() + i })));
    setSubmitResults({ success: 0, errors: [] });
    setShowResults(false);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="xl" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title as="h6">Добавить сборники</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {showResults && (
          <Alert variant={submitResults.errors.length > 0 ? "warning" : "success"}>
            {submitResults.success > 0 && <p>Успешно добавлено: {submitResults.success}</p>}
            {submitResults.errors.length > 0 && (
              <>
                <p>Итоги:</p>
                <ul>
                  {submitResults.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </>
            )}
          </Alert>
        )}

        <Row className="mb-2 fw-semibold gx-2">
          <Col xs={2}>ID*</Col>
          <Col xs={3}>Тип</Col>
          <Col xs={6}>Название*</Col>
          <Col xs={1}></Col>
        </Row>

        {rows.map((row, index) => (
          <Row key={row.rowKey} className="mb-2 align-items-center gx-2">
            <Col xs={2}>
              <Form.Control
                type="number"
                placeholder="Числовой ID"
                value={row.id}
                onChange={(e) => handleRowChange(index, "id", e.target.value)}
                disabled={isSubmitting}
                size="sm"
                required
              />
            </Col>
            <Col xs={3}>
              <Form.Select
                size="sm"
                value={row.type}
                onChange={(e) => handleRowChange(index, "type", e.target.value)}
                disabled={isSubmitting}
              >
                <option value="" >
                  Выберите тип...
                </option>
                {collectionTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={6}>
              <Form.Control
                size="sm"
                type="text"
                placeholder="Название сборника"
                value={row.name}
                onChange={(e) => handleRowChange(index, "name", e.target.value)}
                disabled={isSubmitting}
                required
              />
            </Col>
            <Col xs={1} className="text-center">
              {rows.length > 1 && (
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => removeRow(index)}
                  disabled={isSubmitting}
                  title="Удалить строку"
                >
                  <TrashFill />
                </Button>
              )}
            </Col>
          </Row>
        ))}

        <Button
          variant="outline-primary"
          size="sm"
          onClick={addRow}
          disabled={isSubmitting}
          className="mt-2"
        >
          <PlusCircleFill className="me-1" /> Еще один
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
          Закрыть
        </Button>
        <Button
          variant="primary"
          onClick={handleBatchSubmit}
          disabled={
            isSubmitting ||
            rows.filter((r) => r.id && r.name && !isNaN(parseInt(r.id, 10))).length === 0
          }
        >
          {isSubmitting ? (
            <>
              <Spinner as="span" animation="border" size="sm" /> Добавление...
            </>
          ) : (
            "Добавить"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddCollectionModal;
