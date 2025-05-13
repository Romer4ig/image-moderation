import os
import logging
from flask import Blueprint, jsonify, current_app, send_from_directory
# Используем абсолютные импорты (если понадобятся модели для проверки)
# from backend.models import Generation, ModerationStatus 
from backend.models import GeneratedFile 

logger = logging.getLogger(__name__)

# Создаем Blueprint для этого среза
# Не используем префикс /api
file_serving_bp = Blueprint('file_serving', __name__)

@file_serving_bp.route('/generated_files/<int:file_id>')
def serve_generated_file(file_id):
    """ 
    Отдает сгенерированный файл по его ID.
    Может обрабатывать как пути, относительные к GENERATED_FILES_FOLDER,
    так и абсолютные пути, если они были сохранены в GeneratedFile.file_path.
    """
    
    logger.info(f"Attempting to serve file with ID: {file_id}")

    try:
        generated_file = GeneratedFile.query.get_or_404(file_id)
    except Exception as e: # Обработка ошибок, если get_or_404 не срабатывает как ожидается или другая ошибка БД
        logger.error(f"Error fetching GeneratedFile with ID {file_id} from DB: {e}")
        return jsonify({"error": "File record not found or database error"}), 404

    filepath_from_db = generated_file.file_path
    logger.info(f"Retrieved filepath from DB for ID {file_id}: {filepath_from_db}")

    serve_directory: str
    serve_filename: str

    if os.path.isabs(filepath_from_db):
        serve_directory = os.path.dirname(filepath_from_db)
        serve_filename = os.path.basename(filepath_from_db)
        logger.info(f"Serving absolute path. Directory: '{serve_directory}', Filename: '{serve_filename}'")
    else:
        serve_directory = current_app.config['GENERATED_FILES_FOLDER']
        serve_filename = filepath_from_db
        logger.info(f"Serving relative path. Base Directory: '{serve_directory}', Relative Filepath: '{serve_filename}'")

        requested_path_abs = os.path.abspath(os.path.join(serve_directory, serve_filename))
        base_directory_abs = os.path.abspath(serve_directory)

        if not requested_path_abs.startswith(base_directory_abs + os.sep) and requested_path_abs != base_directory_abs:
            logger.warning(
                f"Forbidden path traversal attempt for relative path: {filepath_from_db} "
                f"(Resolved: {requested_path_abs}, Base: {base_directory_abs}) for file ID: {file_id}"
            )
            return jsonify({"error": "Forbidden path"}), 403
        
    try:
        return send_from_directory(serve_directory,
                                   serve_filename,
                                   as_attachment=False)
    except FileNotFoundError:
        logger.error(f"File not found on disk. Calculated serve_directory: '{serve_directory}', Calculated serve_filename: '{serve_filename}' (for file ID: {file_id})")
        return jsonify({"error": "File not found on disk"}), 404
    except Exception as e:
         logger.exception(f"Error serving file. Original DB filepath: {filepath_from_db}, Serve_dir: {serve_directory}, Serve_file: {serve_filename} (for file ID: {file_id})")
         return jsonify({"error": "Could not serve file"}), 500 