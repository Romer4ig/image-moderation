import os
import logging
from flask import Blueprint, jsonify, current_app, send_from_directory
# Используем абсолютные импорты (если понадобятся модели для проверки)
# from backend.models import Generation, ModerationStatus 

logger = logging.getLogger(__name__)

# Создаем Blueprint для этого среза
# Не используем префикс /api
file_serving_bp = Blueprint('file_serving', __name__)

@file_serving_bp.route('/generated_files/<path:filepath>')
def serve_generated_file(filepath):
    """ Отдает сгенерированный файл. ВНИМАНИЕ: Требует доработки безопасности! """
    
    # ** ВНИМАНИЕ: Добавить проверку статуса модерации и прав доступа! **
    # Пример псевдокода:
    # try:
    #     # Извлекаем generation_id из пути (первая часть пути)
    #     generation_id = filepath.split(os.sep, 1)[0]
    #     generation = Generation.query.get(generation_id)
    #     if not generation:
    #         raise FileNotFoundError("Generation not found") 
    #     # Проверка модерации (или является ли пользователь модератором)
    #     is_moderator = False # Заменить на реальную проверку роли
    #     if generation.moderation_status != ModerationStatus.APPROVED and not is_moderator:
    #         logging.warning(f"Access denied for file {filepath}. Moderation status: {generation.moderation_status}")
    #         return jsonify({"error": "Access denied due to moderation status"}), 403
    # except Exception as auth_err:
    #     logging.error(f"Error during access check for {filepath}: {auth_err}")
    #     return jsonify({"error": "Access check failed"}), 500
        
    logger.info(f"Attempting to serve file: {filepath}")
    directory = current_app.config['GENERATED_FILES_FOLDER']
    
    # Безопасное соединение пути и проверка выхода за пределы директории
    # Используем os.path.abspath для получения канонического пути
    # Важно: filepath УЖЕ содержит generation_id/filename.ext
    requested_path = os.path.abspath(os.path.join(directory, filepath)) 
    base_directory = os.path.abspath(directory)

    # Проверяем, что результирующий путь начинается с базовой директории
    # Добавляем os.sep в конце base_directory для корректного сравнения
    if not requested_path.startswith(base_directory + os.sep):
        logger.warning(f"Forbidden path traversal attempt: {filepath} (Resolved: {requested_path}, Base: {base_directory})")
        return jsonify({"error": "Forbidden path"}), 403
        
    # Используем send_from_directory для безопасной отдачи
    # Он принимает АБСОЛЮТНЫЙ путь к директории и ОТНОСИТЕЛЬНОЕ имя файла
    try:
        # Передаем базовую директорию и сам filepath (который уже generation_id/filename.ext)
        return send_from_directory(directory, 
                                   filepath, # Передаем оригинальный путь
                                   as_attachment=False) # Отдавать как inline, а не скачивание
    except FileNotFoundError:
        logger.error(f"File not found. Directory: '{directory}', Filepath: '{filepath}'")
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
         logger.exception(f"Error serving file {filepath}") # Используем logger.exception
         return jsonify({"error": "Could not serve file"}), 500 