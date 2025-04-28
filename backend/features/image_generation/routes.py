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
    logger.info(f"Callback received for {generation_id}. Content-Type: {request.content_type}")

    def return_error(msg, code=400):
        logger.error(f"Callback for {generation_id}: {msg}")
        return jsonify({"error": msg}), code

    form_data = None
    callback_data = None
    received_files = None

    # --- Обработка form-data ---
    if request.form:
        try:
            form_data = request.form.to_dict()
            received_files = {}
            # Если ключ 'files' есть в request.files, используем getlist для всех файлов
            if 'files' in request.files:
                received_files['files'] = request.files.getlist('files')
            logger.info(f"Received form-data for {generation_id}. Fields: {list(form_data.keys())}")
            if received_files:
                for field, files in received_files.items():
                    for file in files:
                        logger.info(f"File: {field}, name={file.filename}, type={file.content_type}, size={getattr(file, 'content_length', '?')}")
            else:
                logger.info("No files received via request.files.")
            success, message = process_scheduler_callback(generation_id, form_data=form_data, files=received_files)
        except Exception as e:
            return return_error(f"Failed to read form data/files: {e}")
    # --- Обработка JSON ---
    elif request.is_json:
        try:
            callback_data = request.get_json()
            logger.info(f"Received JSON for {generation_id}. Keys: {list(callback_data.keys()) if callback_data else 'empty'}")
            success, message = process_scheduler_callback(generation_id, callback_data=callback_data)
        except Exception as e:
            return return_error(f"Failed to parse JSON data: {e}")
    else:
        raw_preview = request.data[:500] if request.data else b''
        return return_error(f"Unsupported Media Type or empty data. Preview: {raw_preview}", code=415)

    if success:
        logger.info(f"Callback for {generation_id} processed successfully.")
        return jsonify({"message": message}), 200
    else:
        return return_error(f"Callback processing failed: {message}") 