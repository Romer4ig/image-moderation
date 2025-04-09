from flask import Blueprint, request, jsonify, current_app, url_for
import os
import logging
# Используем абсолютные импорты
from backend.models import db, Generation, GenerationStatus
from .services import process_generation_request, process_scheduler_callback # Импортируем сервисные функции

logger = logging.getLogger(__name__)

# Создаем Blueprint для этого среза
generation_bp = Blueprint('image_generation', __name__, url_prefix='/api')

@generation_bp.route('/generate-batch', methods=['POST'])
def generate_batch():
    data = request.json
    if not data or 'pairs' not in data or not isinstance(data['pairs'], list):
        return jsonify({"error": "Invalid input. Expected {'pairs': [{'project_id': '', 'collection_id': ''}]} "}), 400

    pairs = data['pairs']
    results = process_generation_request(pairs)

    # Проверяем, есть ли общие ошибки (например, конфигурации)
    if results.get('overall_error'):
        return jsonify({"error": results['overall_error']}), 500

    # Возвращаем информацию о запущенных задачах и ошибках по парам
    return jsonify({
        "message": f"Processed {len(pairs)} pairs.",
        "tasks_started": results.get('tasks_started', []), # Список ID успешно запущенных Generation
        "pair_errors": results.get('pair_errors', []) # Список ошибок для конкретных пар
    }), 200 # Успешный ответ, даже если были ошибки по парам

@generation_bp.route('/scheduler_callback/<string:generation_id>', methods=['POST'])
def handle_scheduler_callback(generation_id):
    logger.info(f"Callback received for {generation_id}. Processing request...")
    logger.info(f"Request Headers: {request.headers}")
    logger.info(f"Request Content-Type: {request.content_type}")
    logger.info(f"Request MIME Type: {request.mimetype}")

    callback_data = None
    form_data = None
    received_files = None

    # Проверяем сначала form data, так как лог это подтвердил
    if request.form:
        try:
            form_data = request.form.to_dict()
            logger.info("Callback data received as Form Data.")
            # Проверяем и логируем request.files
            received_files = request.files
            if received_files:
                 logger.info(f"Received files: {list(received_files.keys())}")
                 # Логируем детали файлов (без чтения содержимого)
                 for field_name, file_storage in received_files.items():
                      logger.info(f"  - File Field: '{field_name}', Filename: '{file_storage.filename}', Content-Type: '{file_storage.content_type}', Size: ?") 
            else:
                 logger.info("No files received via request.files.")
        except Exception as e:
            logger.exception(f"Error reading form data or files for {generation_id}")
            return jsonify({"error": f"Failed to read form data/files: {e}"}), 400
    # Если form пусто, проверяем JSON (на всякий случай)
    elif request.is_json:
        try:
            callback_data = request.get_json()
            logger.info("Callback data parsed as JSON.")
        except Exception as e:
            logger.exception(f"Error parsing JSON data for {generation_id}")
            return jsonify({"error": f"Failed to parse JSON data: {e}"}), 400
    # Если ни то, ни другое - ошибка
    else:
        logger.warning(f"Callback for {generation_id}: Neither Form data nor JSON detected.")
        try:
            raw_data_preview = request.data[:500] 
            logger.warning(f"Request Raw Data Preview: {raw_data_preview}") 
        except Exception:
             logger.warning("Could not read request.data")
        return jsonify({"error": f"Unsupported Media Type or empty data. Received {request.mimetype}"}), 415

    # --- Вызов сервисной функции --- 
    # Передаем либо form_data+received_files, либо callback_data (JSON)
    if form_data is not None: # Отдаем приоритет form data, если оно было
         success, message = process_scheduler_callback(generation_id, 
                                                    form_data=form_data, 
                                                    files=received_files)
    elif callback_data is not None:
         success, message = process_scheduler_callback(generation_id, 
                                                    callback_data=callback_data)
    else:
        # Эта ветка не должна достигаться при текущей логике, но для полноты
        logger.error(f"Callback for {generation_id}: Could not extract any data.")
        return jsonify({"error": "Could not extract callback data"}), 400
    
    # logger.debug(f"Callback data sample: {str(callback_data or form_data)[:500]}") 

    if success:
        logger.info(f"Callback for {generation_id} processed successfully.")
        return jsonify({"message": message}), 200
    else:
        logger.error(f"Callback processing failed for {generation_id}: {message}")
        return jsonify({"error": message}), 400 # Используем 400, если проблема в данных или логике 