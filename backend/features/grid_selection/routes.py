from flask import Blueprint, request, jsonify, current_app
import logging
# Используем абсолютные импорты
from backend.models import db, Project, Collection, Generation, GenerationStatus, SelectedCover, GeneratedFile
from .services import get_grid_data_service, get_selection_data_service, select_cover_service

logger = logging.getLogger(__name__)

# Создаем Blueprint для этого среза
grid_selection_bp = Blueprint('grid_selection', __name__, url_prefix='/api')

@grid_selection_bp.route('/grid-data', methods=['GET'])
def get_grid_data_route():
    """ Маршрут для получения данных грида. Делегирует работу сервису. """
    visible_project_ids_str = request.args.get('visible_project_ids')
    try:
        data = get_grid_data_service(visible_project_ids_str)
        return jsonify(data)
    except Exception as e:
        logger.exception("Error in get_grid_data_route")
        return jsonify({"error": "Failed to fetch grid data"}), 500

@grid_selection_bp.route('/selection-data', methods=['GET'])
def get_selection_data_route():
    """ Маршрут для получения данных окна выбора. Делегирует работу сервису. """
    collection_id = request.args.get('collection_id')
    project_ids_str = request.args.get('project_ids')
    initial_project_id = request.args.get('initial_project_id')

    if not collection_id or not project_ids_str or not initial_project_id:
        return jsonify({"error": "Missing collection_id, project_ids, or initial_project_id parameter"}), 400

    try:
        data = get_selection_data_service(collection_id, project_ids_str, initial_project_id)
        if data is None: # Сервис может вернуть None при ошибке 404
             return jsonify({"error": "Required resources not found"}), 404
        return jsonify(data)
    except Exception as e:
        logger.exception("Error in get_selection_data_route")
        return jsonify({"error": "Failed to fetch selection data"}), 500

@grid_selection_bp.route('/select-cover', methods=['POST'])
def select_cover_route():
    """ Маршрут для выбора обложки. Делегирует работу сервису. """
    data = request.json
    required_fields = ['collection_id', 'project_id', 'generation_id']
    if not data or not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields: collection_id, project_id, generation_id"}), 400

    try:
        success, message, status_code = select_cover_service(data)
        return jsonify({"message" if success else "error": message}), status_code
    except Exception as e:
        logger.exception("Error in select_cover_route")
        db.session.rollback() # Дополнительный rollback на всякий случай
        return jsonify({"error": "Failed to select cover"}), 500 