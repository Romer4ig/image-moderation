import React from "react";
import { Row, Col, Spinner } from "react-bootstrap";
import { useSelectionContext } from "../context/SelectionContext";
import AttemptGridItem from "./AttemptGridItem";
import SkeletonLoader from "./SkeletonLoader";

const AttemptGrid = () => {
  const { loadingAttempts, displayedAttempts } = useSelectionContext();

  // На время самой первой загрузки показываем полный набор скелетов
  if (loadingAttempts && displayedAttempts.length === 0) {
    return (
      <Row className="g-0 bottom-grid-scroll">
        {Array.from({ length: 12 }).map((_, index) => (
          <SkeletonLoader key={`skel-initial-${index}`} />
        ))}
      </Row>
    );
  }

  return (
    <Row className="g-0 bottom-grid-scroll">
      {/* Сначала рендерим уже загруженные элементы */}
      {displayedAttempts.map((attempt) => (
        <AttemptGridItem key={attempt.generated_file_id} attempt={attempt} />
      ))}

      {/* Если идет дозагрузка, показываем в конце несколько скелетов */}
      {loadingAttempts &&
        Array.from({ length: 6 }).map((_, index) => (
          <SkeletonLoader key={`skel-loading-${index}`} />
        ))}

      {/* Если загрузка окончена и ничего нет, показываем сообщение */}
      {!loadingAttempts && displayedAttempts.length === 0 && (
        <Col>
          <p>Нет завершенных генераций для выбранных проектов и коллекции.</p>
        </Col>
      )}
    </Row>
  );
};

export default AttemptGrid;
