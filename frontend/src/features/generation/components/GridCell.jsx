import React from "react";
import { Image, Spinner } from "react-bootstrap";
import { CheckCircleFill, XCircleFill } from "react-bootstrap-icons";

const GridCell = ({ cellData, onClick }) => {
  let content = null;
  let cellClass = "align-middle";
  let backgroundClass = "";
  let isClickable = false;
  let cellStyle = {};

  if (!cellData) {
    content = "-";
    cellClass = "text-center text-muted align-middle";
  } else {
    isClickable = cellData.status === "generated_not_selected" || cellData.status === "selected";

    switch (cellData.status) {
      case "not_generated":
        content = <span className="text-white small">Не сгенерировано</span>;
        backgroundClass = "cell-not-generated";
        break;
      case "queued":
        content = (
          <div className="text-center">
            <Spinner animation="border" size="sm" />
            <br />
            <small>В очереди...</small>
          </div>
        );
        backgroundClass = "bg-warning bg-opacity-25";
        break;
      case "error":
        content = (
          <span
            className="text-danger small"
            title={cellData.error_message || "Неизвестная ошибка"}
          >
            <XCircleFill className="me-1" /> Ошибка
          </span>
        );
        backgroundClass = "bg-danger bg-opacity-25";
        break;
      case "generated_not_selected":
        content = (
          <div className="text-center">
            <span className="text-white small d-block">Сгенерировано</span>
            <span className="text-white small d-block">Не выбрано</span>
          </div>
        );
        backgroundClass = "cell-generated-not-selected";
        break;
      default:
        if (cellData.file_url) {
          content = (
            <Image
              src={cellData.file_url}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              alt={`Gen ${cellData.generation_id}`}
              fluid
            />
          );
        } else {
          content = (
            <span className="text-danger small">
              <XCircleFill className="me-1" /> Нет файла
            </span>
          );
          backgroundClass = "bg-danger bg-opacity-10";
        }
        break;
    }
  }

  const handleClick = () => {
    if (onClick && isClickable) {
      onClick();
    }
  };

  return (
    <td
      className={`${backgroundClass} position-relative`}
      style={{ width: "150px", height: "150px", ...cellStyle }}
      onClick={handleClick}
    >
      <div
        className={`d-flex align-items-center justify-content-center w-100 h-100 ${cellClass}`}
        style={{ cursor: isClickable ? "pointer" : "default" }}
      >
        {content}
      </div>
    </td>
  );
};

export default GridCell;
