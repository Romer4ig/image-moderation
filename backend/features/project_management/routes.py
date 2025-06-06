import os # Добавляем импорт os
import logging # Добавляем импорт logging
import re # Для регулярных выражений
import mimetypes # Для определения MIME-типов
import uuid # Для генерации ID для Generation
from flask import Blueprint, request, jsonify, current_app # Добавил current_app
from backend.models import db, Project, Collection, Generation, GeneratedFile, GenerationStatus, ModerationStatus

# Создаем Blueprint для этого среза
projects_bp = Blueprint('project_management', __name__, url_prefix='/api')

logger = logging.getLogger(__name__) # Создаем логгер

@projects_bp.route('/projects', methods=['POST'])
def create_project():
    data = request.json
    if not data or not data.get('name'):
        return jsonify({"error": "Project name is required"}), 400
    
    new_project = Project(
        name=data['name'],
        path=data.get('path'),
        selection_path=data.get('selection_path'),
        base_generation_params_json=data.get('base_generation_params_json', {}),
        base_positive_prompt=data.get('base_positive_prompt', ''),
        base_negative_prompt=data.get('base_negative_prompt', ''),
        default_width=data.get('default_width', 512),
        default_height=data.get('default_height', 512)
    )
    db.session.add(new_project)
    db.session.commit()
    return jsonify(new_project.to_dict()), 201

@projects_bp.route('/projects', methods=['GET'])
def get_projects():
    projects = Project.query.order_by(Project.name).all()
    return jsonify([p.to_dict() for p in projects])

@projects_bp.route('/projects/<string:project_id>', methods=['GET'])
def get_project(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify(project.to_dict())

@projects_bp.route('/projects/<string:project_id>', methods=['PUT'])
def update_project(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.json
    if not data: return jsonify({"error": "No data provided"}), 400

    project.name = data.get('name', project.name)
    project.path = data.get('path', project.path)
    project.selection_path = data.get('selection_path', project.selection_path)
    # Обновляем JSON аккуратно
    if 'base_generation_params_json' in data:
         project.base_generation_params_json = data['base_generation_params_json']
    project.base_positive_prompt = data.get('base_positive_prompt', project.base_positive_prompt)
    project.base_negative_prompt = data.get('base_negative_prompt', project.base_negative_prompt)
    project.default_width = data.get('default_width', project.default_width)
    project.default_height = data.get('default_height', project.default_height)
    
    db.session.commit()
    return jsonify(project.to_dict())

@projects_bp.route('/projects/<string:project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)
    # SQLAlchemy cascade должен удалить связанные поколения и т.д., если настроено
    # Важно проверить cascade="all, delete-orphan" на relations в Project
    db.session.delete(project)
    db.session.commit()
    return jsonify({"message": f"Project '{project.name}' deleted"}), 200

@projects_bp.route('/projects/<string:project_id>/reindex', methods=['POST'])
def reindex_project_path(project_id):
    project = Project.query.get_or_404(project_id)

    if not project.path:
        return jsonify({"error": "Project path is not set"}), 400
    project_path_str = project.path.strip()
    if not project_path_str:
        return jsonify({"error": "Project path is empty"}), 400

    if not os.path.isabs(project_path_str):
        logger.error(f"Reindex failed for project {project_id}: Relative path '{project_path_str}' is not supported for reindexing.")
        return jsonify({"error": "Reindexing relative paths is not supported."}), 400
    
    absolute_project_path = os.path.abspath(project_path_str)
    logger.info(f"Attempting to reindex path recursively: {absolute_project_path} for project {project_id}")

    if not os.path.exists(absolute_project_path):
         return jsonify({"error": f"Path does not exist: {absolute_project_path}"}), 404
    if not os.path.isdir(absolute_project_path):
        return jsonify({"error": f"Path is not a directory: {absolute_project_path}"}), 400

    supported_extensions = ('.jpg', '.jpeg', '.png', '.webp')
    # Регулярное выражение: ищет одну или более цифр в САМОМ НАЧАЛЕ строки (^\d+)
    collection_id_regex = re.compile(r"^(\d+)") 

    total_files_scanned = 0
    processed_files = 0
    created_generations = 0
    created_generated_files = 0
    skipped_no_collection_id = 0
    skipped_collection_not_found = 0
    skipped_file_exists_in_db = 0
    skipped_unsupported_extension = 0
    errors = []

    try:
        # Используем os.walk для рекурсивного обхода
        for dirpath, _, filenames in os.walk(absolute_project_path):
            for filename in filenames:
                total_files_scanned += 1 # Считаем все файлы
                file_abs_path = os.path.join(dirpath, filename)

                _, ext = os.path.splitext(filename.lower())
                if ext not in supported_extensions:
                    skipped_unsupported_extension += 1
                    logger.debug(f"Skipping '{file_abs_path}': unsupported extension '{ext}'.")
                    continue
                
                processed_files += 1 # Считаем только файлы с нужным расширением

                # 1. Парсинг Collection ID из имени файла
                match = collection_id_regex.match(filename)
                if not match:
                    skipped_no_collection_id += 1
                    logger.debug(f"Skipping '{filename}' in '{dirpath}': no collection ID pattern found at the beginning.")
                    continue
                
                try:
                    collection_id_from_name = int(match.group(1))
                except ValueError:
                    skipped_no_collection_id += 1
                    logger.warning(f"Skipping '{filename}' in '{dirpath}': could not parse collection ID '{match.group(1)}' as integer.")
                    continue

                # 2. Проверка существования коллекции
                collection = Collection.query.get(collection_id_from_name)
                if not collection:
                    skipped_collection_not_found += 1
                    logger.warning(f"Skipping '{filename}' in '{dirpath}': Collection with ID {collection_id_from_name} not found.")
                    continue

                # 3. Проверка дубликатов GeneratedFile по пути
                existing_db_file = GeneratedFile.query.filter_by(file_path=file_abs_path).first()
                if existing_db_file:
                    skipped_file_exists_in_db += 1
                    logger.info(f"Skipping '{file_abs_path}': already exists in DB (GeneratedFile ID: {existing_db_file.id}).")
                    continue
                
                try:
                    new_generation_id = str(uuid.uuid4())
                    new_generation = Generation(
                        id=new_generation_id,
                        project_id=project.id,
                        collection_id=collection.id,
                        status=GenerationStatus.COMPLETED,
                        moderation_status=ModerationStatus.PENDING_MODERATION,
                        final_positive_prompt=f"Imported: {filename}",
                        final_negative_prompt="",
                        generation_params={"source": "reindex", "original_filename": filename, "original_path": file_abs_path}
                    )
                    db.session.add(new_generation)
                    created_generations += 1

                    mime_type, _ = mimetypes.guess_type(file_abs_path)
                    size_bytes = os.path.getsize(file_abs_path)

                    new_db_file = GeneratedFile(
                        generation_id=new_generation_id,
                        file_path=file_abs_path,
                        original_filename=filename,
                        mime_type=mime_type,
                        size_bytes=size_bytes,
                        infotext=None
                    )
                    db.session.add(new_db_file)
                    created_generated_files += 1
                    logger.info(f"Prepared for import: '{file_abs_path}'. New Generation ID: {new_generation_id}")
                
                except Exception as e_inner:
                    db.session.rollback()
                    error_msg = f"Error processing file '{file_abs_path}' for import: {str(e_inner)}"
                    logger.error(error_msg)
                    errors.append(error_msg)
                    # Сброс счетчиков, если ошибка произошла после инкремента
                    if 'new_generation' in locals() and new_generation in db.session: created_generations -= 1
                    if 'new_db_file' in locals() and new_db_file in db.session: created_generated_files -= 1
                    continue

        db.session.commit()
        
        summary_msg = f"Recursive reindex for project '{project.name}' path '{absolute_project_path}' completed."
        logger.info(summary_msg)
        return jsonify({
            "message": summary_msg,
            "path_checked": absolute_project_path,
            "total_files_scanned": total_files_scanned, # Общее число файлов в директории и поддиректориях
            "processed_image_files": processed_files, # Число файлов с поддерживаемым расширением
            "created_generations": created_generations,
            "created_generated_files": created_generated_files,
            "skipped_details": {
                "unsupported_extension": skipped_unsupported_extension,
                "no_collection_id_pattern": skipped_no_collection_id,
                "collection_not_found_in_db": skipped_collection_not_found,
                "file_already_in_db": skipped_file_exists_in_db
            },
            "processing_errors_count": len(errors),
            "processing_errors_examples": errors[:5]
        }), 200

    except PermissionError:
        logger.error(f"Permission denied during recursive scan of: {absolute_project_path}")
        return jsonify({"error": f"Permission denied for path: {absolute_project_path}"}), 403
    except Exception as e_outer:
        db.session.rollback()
        logger.exception(f"An unexpected error occurred during recursive reindexing of {absolute_project_path}: {e_outer}")
        return jsonify({"error": f"An unexpected error occurred: {str(e_outer)}"}), 500 