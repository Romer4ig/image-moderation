from flask import Blueprint, request, jsonify, current_app, url_for, send_from_directory
from .models import db, Project, Collection, Generation, GenerationStatus, GeneratedFile, SelectedCover
import json
import requests # Добавляем requests
import os # Добавляем os для работы с env
import uuid
from sqlalchemy import func, distinct # Для агрегатных функций и distinct
from sqlalchemy.orm import joinedload, selectinload # Добавляем selectinload
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert # Используем для UPSERT на SQLite
import logging # Добавляем logging

# Создаем Blueprints
projects_api = Blueprint('projects_api', __name__)
collections_api = Blueprint('collections_api', __name__)
generations_api = Blueprint('generations_api', __name__) # Новый blueprint
files_api = Blueprint('files_api', __name__) # Blueprint для файлов

# --- Вспомогательная функция для наследования параметров ---

def merge_generation_parameters(project_id: str, collection_id: str) -> tuple[dict, str, str]:
    """ 
    Объединяет параметры генерации из Проекта и Коллекции.
    Возвращает кортеж: (final_params_dict, final_positive_prompt, final_negative_prompt)
    """
    project = Project.query.get_or_404(project_id)
    collection = Collection.query.get_or_404(collection_id)

    # 1. Начинаем с базовых параметров проекта (если они есть)
    final_params = project.base_generation_params_json or {}

    # 2. Устанавливаем/Перезаписываем размеры
    # TODO: Учесть возможные переопределения из запроса пользователя, если нужно
    final_params['width'] = project.default_width
    final_params['height'] = project.default_height

    # 3. Собираем позитивный промпт
    positive_parts = [p for p in [project.base_positive_prompt, collection.collection_positive_prompt] if p]
    final_positive = ", ".join(positive_parts)
    
    # 4. Собираем негативный промпт
    negative_parts = [p for p in [project.base_negative_prompt, collection.collection_negative_prompt] if p]
    final_negative = ", ".join(negative_parts)

    # 5. Добавляем/Перезаписываем промпты в параметры
    final_params['prompt'] = final_positive
    if final_negative: # Добавляем негативный, только если он не пустой
        final_params['negative_prompt'] = final_negative
    elif 'negative_prompt' in final_params: # Удаляем, если он был в базовых, но стал пустым
        del final_params['negative_prompt']

    # TODO: Добавить сюда логику мержа других параметров, если Коллекция 
    # должна переопределять или добавлять что-то еще из base_generation_params_json?
    # Например, если коллекция типа "style", она может добавлять свой trigger word в prompt?

    return final_params, final_positive, final_negative


# --- Project API Routes --- 

@projects_api.route('/projects', methods=['POST'])
def create_project():
    data = request.json
    if not data or not data.get('name'):
        return jsonify({"error": "Project name is required"}), 400
    
    new_project = Project(
        name=data['name'],
        base_generation_params_json=data.get('base_generation_params_json', {}),
        base_positive_prompt=data.get('base_positive_prompt', ''),
        base_negative_prompt=data.get('base_negative_prompt', ''),
        default_width=data.get('default_width', 512),
        default_height=data.get('default_height', 512)
    )
    db.session.add(new_project)
    db.session.commit()
    return jsonify(new_project.to_dict()), 201

@projects_api.route('/projects', methods=['GET'])
def get_projects():
    projects = Project.query.order_by(Project.name).all()
    return jsonify([p.to_dict() for p in projects])

@projects_api.route('/projects/<string:project_id>', methods=['GET'])
def get_project(project_id):
    project = Project.query.get_or_404(project_id)
    return jsonify(project.to_dict())

@projects_api.route('/projects/<string:project_id>', methods=['PUT'])
def update_project(project_id):
    project = Project.query.get_or_404(project_id)
    data = request.json
    if not data: return jsonify({"error": "No data provided"}), 400

    project.name = data.get('name', project.name)
    # Обновляем JSON аккуратно
    if 'base_generation_params_json' in data:
         project.base_generation_params_json = data['base_generation_params_json']
    project.base_positive_prompt = data.get('base_positive_prompt', project.base_positive_prompt)
    project.base_negative_prompt = data.get('base_negative_prompt', project.base_negative_prompt)
    project.default_width = data.get('default_width', project.default_width)
    project.default_height = data.get('default_height', project.default_height)
    
    db.session.commit()
    return jsonify(project.to_dict())

@projects_api.route('/projects/<string:project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = Project.query.get_or_404(project_id)
    # SQLAlchemy cascade должен удалить связанные коллекции
    db.session.delete(project)
    db.session.commit()
    return jsonify({"message": f"Project '{project.name}' deleted"}), 200

# --- Collection API Routes --- 

@collections_api.route('/collections', methods=['GET'])
def get_collections():
    """ Возвращает список всех коллекций. """
    try:
        collections = Collection.query.order_by(Collection.name).all()
        return jsonify([c.to_dict() for c in collections])
    except Exception as e:
        print(f"Error fetching collections: {e}")
        return jsonify({"error": "Failed to fetch collections"}), 500

@collections_api.route('/collections', methods=['POST'])
def add_collection():
    """ Добавляет новый независимый сборник в базу данных. """
    data = request.json
    
    # Добавляем id в обязательные поля
    required_fields = ['id', 'name', 'type'] 
    if not data or not all(field in data and (data[field] is not None and data[field] != '') for field in required_fields):
        missing = [field for field in required_fields if not data or field not in data or (data[field] is None or data[field] == '')]
        return jsonify({"error": f"Missing or empty required fields: {', '.join(missing)}"}), 400

    try:
        collection_id = int(data['id']) # Преобразуем ID в число
    except (ValueError, TypeError):
         return jsonify({"error": "Invalid ID format. ID must be an integer."}), 400

    name = data['name']
    collection_type = data['type']
    
    # Проверка на уникальность ID
    if Collection.query.get(collection_id):
        return jsonify({"error": f"Collection with ID '{collection_id}' already exists"}), 409

    try:
        new_collection = Collection(
            id=collection_id, # Передаем ID из запроса
            name=name,
            type=collection_type,
        )
        db.session.add(new_collection)
        db.session.commit()
        print(f"Added new collection: ID={new_collection.id}, Name={new_collection.name}")
        return jsonify({"message": "Collection added successfully", "collection": new_collection.to_dict()}), 201 

    except Exception as e:
        db.session.rollback()
        print(f"Error adding collection: {e}")
        return jsonify({"error": "Failed to add collection to database"}), 500

@collections_api.route('/projects/<string:project_id>/collections', methods=['GET'])
def get_project_collections(project_id):
    project = Project.query.get_or_404(project_id)
    collections = Collection.query.filter_by(project_id=project_id).order_by(Collection.name).all()
    return jsonify([c.to_dict() for c in collections])

@collections_api.route('/collections/<string:collection_id>', methods=['GET'])
def get_collection(collection_id):
    collection = Collection.query.get_or_404(collection_id)
    return jsonify(collection.to_dict())

@collections_api.route('/collections/<string:collection_id>', methods=['PUT'])
def update_collection(collection_id):
    collection = Collection.query.get_or_404(collection_id)
    data = request.json
    if not data: return jsonify({"error": "No data provided"}), 400

    collection.name = data.get('name', collection.name)
    collection.type = data.get('type', collection.type)
    collection.collection_positive_prompt = data.get('collection_positive_prompt', collection.collection_positive_prompt)
    collection.collection_negative_prompt = data.get('collection_negative_prompt', collection.collection_negative_prompt)
    collection.comment = data.get('comment', collection.comment)

    db.session.commit()
    return jsonify(collection.to_dict())

@collections_api.route('/collections/<string:collection_id>', methods=['DELETE'])
def delete_collection(collection_id):
    collection = Collection.query.get_or_404(collection_id)
    db.session.delete(collection)
    db.session.commit()
    return jsonify({"message": f"Collection '{collection.name}' deleted"}), 200

# --- Generation API Routes --- 

@generations_api.route('/generate-batch', methods=['POST'])
def generate_batch():
    data = request.json
    if not data or 'pairs' not in data or not isinstance(data['pairs'], list):
        return jsonify({"error": "Invalid input. Expected {'pairs': [{'project_id': '', 'collection_id': ''}]} "}), 400

    generation_tasks_started = []
    errors = []

    A1111_API_URL = os.environ.get('A1111_SCHEDULER_URL')
    if not A1111_API_URL:
        return jsonify({"error": "A1111_SCHEDULER_URL is not configured in .env"}), 500
    SCHEDULER_ENDPOINT = f"{A1111_API_URL}/agent-scheduler/v1/queue/txt2img"
    FLASK_CALLBACK_URL_BASE = os.environ.get('FLASK_CALLBACK_BASE_URL')
    if not FLASK_CALLBACK_URL_BASE:
        return jsonify({"error": "FLASK_CALLBACK_BASE_URL is not configured in .env"}), 500

    for pair in data['pairs']:
        project_id = pair.get('project_id')
        collection_id = pair.get('collection_id')

        if not project_id or not collection_id:
            errors.append({"pair": pair, "error": "Missing project_id or collection_id"})
            continue

        try:
            # 1. Получаем финальные параметры
            final_params, final_pos, final_neg = merge_generation_parameters(project_id, collection_id)

            # 2. Создаем запись Generation в БД
            new_generation = Generation(
                project_id=project_id,
                collection_id=collection_id,
                status=GenerationStatus.PENDING,
                final_positive_prompt=final_pos,
                final_negative_prompt=final_neg,
                generation_params=final_params # Сохраняем весь JSON параметров
            )
            db.session.add(new_generation)
            db.session.flush() # Получаем ID до коммита
            internal_generation_id = new_generation.id
            db.session.commit() # Коммитим создание Generation

            # 3. Формируем callback URL
            # Используем url_for для генерации URL, '_external=True' делает его абсолютным
            callback_url = url_for('generations_api.handle_scheduler_callback', 
                                     generation_id=internal_generation_id, 
                                     _external=True,
                                     _scheme='http') # Явно указываем http, если нужно
            
            # Переопределяем базовый URL, если он из .env (полезно для ngrok/docker)
            if FLASK_CALLBACK_URL_BASE != 'http://127.0.0.1:5001': # Проверяем, отличается ли от дефолтного
                from urllib.parse import urlparse, urlunparse
                parsed_callback = urlparse(callback_url)
                parsed_base = urlparse(FLASK_CALLBACK_URL_BASE)
                callback_url = urlunparse((parsed_base.scheme, parsed_base.netloc, parsed_callback.path, 
                                           parsed_callback.params, parsed_callback.query, parsed_callback.fragment))
            
            print(f"Generated Callback URL: {callback_url}") # Для отладки

            # 4. Подготавливаем payload для API планировщика
            scheduler_payload = final_params.copy() # Копируем финальные параметры
            scheduler_payload['callback_url'] = callback_url
            # Убедимся, что основные параметры присутствуют (можно добавить больше проверок)
            if 'prompt' not in scheduler_payload:
                 raise ValueError("Missing 'prompt' in final parameters")

            # 5. Вызываем API планировщика
            response = requests.post(SCHEDULER_ENDPOINT, json=scheduler_payload, timeout=15)
            response.raise_for_status() # Вызовет исключение для 4xx/5xx
            
            scheduler_response_data = response.json()
            scheduler_task_id = scheduler_response_data.get('task_id')

            # 6. Обновляем Generation в БД
            new_generation.scheduler_task_id = scheduler_task_id
            new_generation.status = GenerationStatus.QUEUED
            db.session.commit()
            
            generation_tasks_started.append({"internal_generation_id": internal_generation_id, 
                                               "scheduler_task_id": scheduler_task_id})
            
            # TODO: Отправить WebSocket уведомление о постановке в очередь?

        except requests.exceptions.RequestException as e:
            db.session.rollback() # Откатываем создание Generation
            error_msg = f"Failed to call scheduler API for pair {pair}: {e}"
            print(error_msg)
            errors.append({"pair": pair, "error": error_msg})
        except Exception as e:
            db.session.rollback()
            error_msg = f"Error processing pair {pair}: {e}"
            print(error_msg)
            errors.append({"pair": pair, "error": error_msg})
            if 'new_generation' in locals() and db.session.object_session(new_generation):
                 db.session.expunge(new_generation) # Удаляем из сессии, если не закоммичено

    return jsonify({
        "message": f"Attempted to start {len(data['pairs'])} generation tasks.",
        "tasks_started": generation_tasks_started,
        "errors": errors
    }), 207 if errors else 202 # 202 Accepted или 207 Multi-Status

# ЗАМЕНИТЕ ЭТИМ КОДОМ СУЩЕСТВУЮЩУЮ ФУНКЦИЮ get_grid_data в backend/api.py

@generations_api.route('/grid-data', methods=['GET'])
def get_grid_data():
    """ Возвращает данные для построения основного грида UI. 
        Принимает необязательный параметр visible_project_ids (строка ID через запятую)
        для фильтрации колонок и строк.
    """
    visible_project_ids_str = request.args.get('visible_project_ids')
    visible_ids_list = None
    if visible_project_ids_str:
        # Получаем список ID из строки запроса
        visible_ids_list = [pid.strip() for pid in visible_project_ids_str.split(',') if pid.strip()]
        if not visible_ids_list:
            # Если передан пустой список видимых ID, возвращаем пустые данные
            return jsonify({'projects': [], 'collections': []})

    try:
        # 1. Получаем Проекты (фильтруем по visible_ids_list, если он передан)
        projects_query = Project.query.order_by(Project.name)
        if visible_ids_list:
            projects_query = projects_query.filter(Project.id.in_(visible_ids_list))
        
        # Сохраняем список проектов, которые будут в колонках ответа
        projects_to_include = projects_query.all() 
        projects_data = [p.to_dict() for p in projects_to_include]

        # 2. Получаем все Коллекции (фильтрация строк будет позже)
        all_collections = Collection.query.order_by(Collection.name).all()
        
        collections_data_filtered = [] # Здесь будут только те коллекции, что пройдут фильтр

        # 3. Для каждой коллекции собираем данные ячеек ТОЛЬКО для видимых/запрошенных проектов
        for collection in all_collections:
            collection_dict = collection.to_dict()
            cells = {}
            has_relevant_data_in_visible_columns = False # Флаг для фильтрации строк

            # Запрос для последней даты генерации (без изменений)
            last_gen_date_query = db.session.query(func.max(Generation.updated_at))\
                                         .filter(Generation.collection_id == collection.id)\
                                         .scalar() 
            collection_dict['last_generation_at'] = last_gen_date_query.isoformat() + 'Z' if last_gen_date_query else None
            
            # Цикл по проектам, которые ДОЛЖНЫ БЫТЬ в ответе (уже отфильтрованы)
            for project in projects_to_include: 
                cell_key = project.id
                cell_data = {
                    'status': 'not_generated', 
                    'generation_id': None,
                    'file_url': None,
                    'is_selected': False,
                    'error_message': None 
                }
                current_cell_is_relevant = False # Флаг для текущей ячейки

                # --- Определение статуса и релевантности ячейки ---
                # Ищем выбранную обложку
                selected = SelectedCover.query.filter_by(
                    collection_id=collection.id, 
                    project_id=project.id 
                ).first()
                
                if selected:
                    # Логика для выбранной обложки... (как в предыдущем варианте)
                    cell_data['is_selected'] = True
                    generation_to_display = Generation.query.get(selected.generation_id)
                    file_to_display = None
                    if selected.generated_file_id:
                        file_to_display = GeneratedFile.query.get(selected.generated_file_id)
                    elif generation_to_display:
                        file_to_display = generation_to_display.generated_files.first()
                    
                    if generation_to_display and file_to_display:
                        cell_data['generation_id'] = generation_to_display.id
                        cell_data['status'] = 'selected' 
                        cell_data['file_url'] = file_to_display.get_url()
                        cell_data['file_path'] = file_to_display.file_path
                        current_cell_is_relevant = True 
                    elif generation_to_display:
                        cell_data['generation_id'] = generation_to_display.id
                        cell_data['status'] = 'error'
                        cell_data['error_message'] = 'Selected cover data inconsistent (file missing?)' 
                        current_cell_is_relevant = True 
                    else:
                        cell_data['status'] = 'error'
                        cell_data['error_message'] = 'Selected cover data inconsistent (generation missing?)'
                        current_cell_is_relevant = True 
                        
                else: # Если НЕ выбрана, ищем последнюю генерацию
                    last_generation = Generation.query.filter_by(
                        collection_id=collection.id,
                        project_id=project.id 
                    ).order_by(Generation.updated_at.desc()).first() 
                    
                    if last_generation:
                        cell_data['generation_id'] = last_generation.id
                        # Определяем статус и релевантность на основе статуса генерации
                        if last_generation.status == GenerationStatus.COMPLETED:
                            cell_data['status'] = 'generated_not_selected'
                            current_cell_is_relevant = True 
                        elif last_generation.status in [GenerationStatus.PENDING, GenerationStatus.QUEUED]:
                            cell_data['status'] = 'queued' 
                            current_cell_is_relevant = True 
                        elif last_generation.status == GenerationStatus.FAILED:
                            cell_data['status'] = 'error'
                            cell_data['error_message'] = last_generation.error_message
                            current_cell_is_relevant = True 
                        else: # Неизвестный статус
                            cell_data['status'] = 'unknown' 
                            current_cell_is_relevant = True # Считаем релевантным для отображения
                
                # Добавляем данные ячейки в словарь cells
                cells[cell_key] = cell_data
                
                # Если данные в этой ячейке релевантны, взводим флаг для всей строки
                if current_cell_is_relevant:
                    has_relevant_data_in_visible_columns = True 
            # --- Конец цикла по проектам ---

            # Просто добавляем коллекцию в итоговый список.
            collection_dict['cells'] = cells
            collections_data_filtered.append(collection_dict)
        # --- Конец цикла по коллекциям ---

        # Возвращаем отфильтрованные проекты и коллекции
        return jsonify({
            'projects': projects_data, 
            'collections': collections_data_filtered 
        })

    except Exception as e:
        print(f"Error fetching grid data: {e}")
        # logger.exception("Error fetching grid data") # Логирование в продакшене
        return jsonify({"error": "Failed to fetch grid data"}), 500

# --- Остальной код API ... --- 
@generations_api.route('/selection-data', methods=['GET'])
def get_selection_data():
    """ Возвращает данные для модального окна выбора обложки. 
        Принимает collection_id и project_ids (строка ID через запятую).
        Также принимает initial_project_id для определения target_project.
    """
    collection_id = request.args.get('collection_id')
    project_ids_str = request.args.get('project_ids') # ID проектов для загрузки генераций
    initial_project_id = request.args.get('initial_project_id') # ID проекта, для которого открыли окно

    # Убираем проверку только для project_id, проверяем все три
    if not collection_id or not project_ids_str or not initial_project_id:
        return jsonify({"error": "Missing collection_id, project_ids, or initial_project_id parameter"}), 400

    # Парсим ID проектов
    project_ids_list = [pid.strip() for pid in project_ids_str.split(',') if pid.strip()]
    if not project_ids_list:
         return jsonify({"error": "project_ids parameter cannot be empty"}), 400

    try:
        # Проверяем существование основной коллекции и начального проекта
        collection = Collection.query.get_or_404(collection_id)
        # Ищем target_project по initial_project_id
        target_project = Project.query.get_or_404(initial_project_id) 
        
        # 1. Получаем все проекты (для верхнего ряда модалки)
        all_projects = Project.query.order_by(Project.name).all()
        
        # --- Получаем ID проектов, имеющих завершенные генерации для этой коллекции ---
        projects_with_completed_generations = db.session.query(distinct(Generation.project_id))\
            .filter(
                Generation.collection_id == collection_id, 
                Generation.status == GenerationStatus.COMPLETED
            )\
            .all()
        project_ids_with_generations = [pid[0] for pid in projects_with_completed_generations]
        
        # 2. Получаем выбранные обложки для этой коллекции по ВСЕМ проектам
        selected_covers_query = SelectedCover.query.filter_by(collection_id=collection_id)\
            .options(
                selectinload(SelectedCover.generation) # Оставляем только загрузку самой генерации
                ).all()
        
        selected_covers_map = {}
        for sc in selected_covers_query:
            file_to_use = None
            if sc.generated_file_id:
                 file_to_use = GeneratedFile.query.get(sc.generated_file_id)
            elif sc.generation and sc.generation.generated_files:
                 file_to_use = sc.generation.generated_files.first() 
                 
            if file_to_use:
                 selected_covers_map[sc.project_id] = {
                     'generation_id': sc.generation_id,
                     'generated_file_id': file_to_use.id,
                     'file_url': file_to_use.get_url()
                 }

        # Собираем данные для верхнего ряда
        top_row_data = []
        for p in all_projects:
             top_row_data.append({
                 'project_id': p.id,
                 'project_name': p.name,
                 'selected_cover': selected_covers_map.get(p.id)
             })

        # 3. Получаем ВСЕ генерации (с файлами) для ЗАПРОШЕННЫХ project_ids
        #    и сортируем по дате создания (новые первыми)
        generation_attempts_query = Generation.query.filter(
            Generation.collection_id == collection_id,
            Generation.project_id.in_(project_ids_list), # Используем .in_()
            Generation.status == GenerationStatus.COMPLETED # Добавляем сортировку
        ).order_by(Generation.created_at.desc()) # Добавляем сортировку

        generation_attempts = generation_attempts_query.all() 

        attempts_data = []
        # Обработка файлов остается прежней
        for gen in generation_attempts:
            # Добавляем project_id к данным файла, если это нужно фронтенду
            origin_project_id = gen.project_id 
            for file in gen.generated_files.order_by(GeneratedFile.created_at): 
                 attempts_data.append({
                     'generation_id': gen.id, 
                     'generated_file_id': file.id,
                     'file_url': file.get_url(),
                     'created_at': file.created_at.isoformat() + 'Z',
                     'origin_project_id': origin_project_id # Добавляем ID проекта-источника
                 })

        return jsonify({
            'collection': collection.to_dict(),
            # Возвращаем target_project на основе initial_project_id
            'target_project': target_project.to_dict(), 
            'top_row_projects': top_row_data, 
            'generation_attempts': attempts_data, # Возвращаем единый, отсортированный список
            'project_ids_with_generations': project_ids_with_generations 
        })

    except Exception as e:
        print(f"Error fetching selection data: {e}")
        # logger.exception("Error fetching selection data") # Используйте логгер
        return jsonify({"error": "Failed to fetch selection data"}), 500

@generations_api.route('/select-cover', methods=['POST'])
def select_cover():
    """ Устанавливает выбранную обложку для пары (Коллекция, Проект). """
    data = request.json
    required_fields = ['collection_id', 'project_id', 'generation_id']
    if not data or not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields: collection_id, project_id, generation_id"}), 400

    collection_id = data['collection_id']
    project_id = data['project_id']
    generation_id = data['generation_id']
    # generated_file_id опционален, но если передается, используем его
    generated_file_id = data.get('generated_file_id')

    try:
        # Проверяем существование сущностей (опционально, но безопасно)
        if not Collection.query.get(collection_id):
            return jsonify({"error": "Collection not found"}), 404
        if not Project.query.get(project_id):
            return jsonify({"error": "Project not found"}), 404
        generation = Generation.query.get(generation_id)
        if not generation:
            return jsonify({"error": "Generation not found"}), 404
        
        # Если generated_file_id не передан, пытаемся взять первый файл из генерации
        if not generated_file_id:
             first_file = generation.generated_files.first()
             if first_file:
                 generated_file_id = first_file.id
             else:
                  return jsonify({"error": "Cannot select cover: Generation has no files"}), 400
        elif not GeneratedFile.query.get(generated_file_id):
             return jsonify({"error": f"GeneratedFile with id {generated_file_id} not found"}), 404
             
        # Выполняем UPSERT (INSERT OR REPLACE для SQLite)
        # Простой вариант для SQLite: DELETE + INSERT
        # Это гарантирует, что для пары (collection_id, project_id) будет только одна запись
        SelectedCover.query.filter_by(collection_id=collection_id, project_id=project_id).delete()
        db.session.flush() # Применяем удаление перед вставкой
        
        new_selection = SelectedCover(
             collection_id=collection_id,
             project_id=project_id,
             generation_id=generation_id,
             generated_file_id=generated_file_id
             # selected_at будет установлен по умолчанию
        )
        db.session.add(new_selection)
        
        db.session.commit()
        
        # TODO: Отправить WebSocket уведомление об обновлении статуса выбора для грида?
        # socketio.emit('grid_cell_update', { 'collection_id': collection_id, 'project_id': project_id, 'status': 'selected', ... })

        return jsonify({"message": "Cover selected successfully"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error selecting cover: {e}")
        return jsonify({"error": "Failed to select cover"}), 500

@generations_api.route('/scheduler_callback/<string:generation_id>', methods=['POST'])
def handle_scheduler_callback(generation_id):
    """ Обрабатывает callback от sd-webui-agent-scheduler """
    print(f"\n--- Received callback for Generation ID: {generation_id} ---")
    # TODO: Реализовать логику сохранения файлов и обновления статуса Generation
    # TODO: Отправить WebSocket уведомление
    
    scheduler_task_id = request.form.get('task_id')
    status_str = request.form.get('status')
    files = request.files.getlist('files')
    
    print(f"Scheduler Task ID: {scheduler_task_id}")
    print(f"Status: {status_str}")
    print(f"Files received: {len(files)}")
    if files:
        for f in files:
            # Убираем размер из этого лога, т.к. content_length ненадежен
            print(f" - File: {f.filename}, Type: {f.mimetype}") 
            
    # --- Начало реальной обработки --- 
    generation = Generation.query.get(generation_id)
    if not generation:
        print(f"Error: Generation ID {generation_id} not found in DB.")
        # Возвращаем 2xx, чтобы планировщик не пытался повторить callback
        return jsonify({"error": "Generation ID not found"}), 200 

    # Проверяем, совпадает ли scheduler_task_id (опционально, для доп. безопасности)
    if generation.scheduler_task_id and generation.scheduler_task_id != scheduler_task_id:
        print(f"Warning: Scheduler task ID mismatch! DB: {generation.scheduler_task_id}, Callback: {scheduler_task_id}")
        # Можно решить, что делать - игнорировать, логировать и т.д.

    if status_str == 'done' and files:
        saved_file_objects = [] # Временный список для объектов SQLAlchemy
        try:
            # Создаем папку для файлов генерации, если не существует
            generation_folder = os.path.join(current_app.config['GENERATED_FILES_FOLDER'], generation.id)
            os.makedirs(generation_folder, exist_ok=True)
            
            for file_storage in files:
                # Генерируем безопасное и уникальное имя файла
                filename_base = uuid.uuid4().hex
                filename_ext = os.path.splitext(file_storage.filename)[1] if file_storage.filename else '.png' # Берем расширение или ставим .png
                secure_filename = f"{filename_base}{filename_ext}"
                file_rel_path = os.path.join(generation.id, secure_filename) # Путь относительно папки generated_images
                full_save_path = os.path.join(current_app.config['GENERATED_FILES_FOLDER'], file_rel_path)
                
                # Сохраняем файл
                file_storage.save(full_save_path)
                print(f"Saved file to: {full_save_path}")
                
                # Получаем реальный размер файла ПОСЛЕ сохранения
                try:
                    actual_file_size = os.path.getsize(full_save_path)
                except OSError as e:
                    print(f"Warning: Could not get size for {full_save_path}: {e}")
                    actual_file_size = 0 # Ставим 0, если не смогли получить размер

                # TODO: Извлечь infotext, если он передается (как? в имени файла? отдельным полем form?) 
                infotext = None 

                # Создаем запись в БД для файла
                new_file = GeneratedFile(
                    generation_id=generation.id,
                    file_path=file_rel_path,
                    original_filename=file_storage.filename,
                    mime_type=file_storage.mimetype,
                    size_bytes=actual_file_size, # Используем актуальный размер
                    infotext=infotext
                )
                db.session.add(new_file)
                saved_file_objects.append(new_file) # Добавляем объект в список
                
            # Обновляем статус генерации
            generation.status = GenerationStatus.COMPLETED
            generation.error_message = None
            
            # Коммитим все изменения (Generation status и новые GeneratedFile)
            db.session.commit()
            print(f"Generation {generation_id} status updated to COMPLETED and files saved.")
            
            # --- Теперь, ПОСЛЕ коммита, генерируем данные для WebSocket --- 
            saved_files_info = [f.to_dict() for f in saved_file_objects]
            
            # TODO: Отправить WebSocket уведомление об успехе
            from .app import socketio # Импортируем socketio
            socketio.emit('generation_update', {
                'id': generation.id,
                'project_id': generation.project_id, # Добавляем ID для обновления UI
                'collection_id': generation.collection_id, # Добавляем ID для обновления UI
                'status': generation.status.value, 
                'files': saved_files_info
            })
            print(f"Sent WebSocket update for {generation_id}")
            
        except Exception as e:
            db.session.rollback()
            print(f"Error saving files or updating DB for generation {generation_id}: {e}")
            # Пытаемся обновить статус на FAILED, если возможно
            try: 
                 generation.status = GenerationStatus.FAILED
                 generation.error_message = f"Error processing callback: {e}"
                 db.session.commit()
                 # TODO: Отправить WebSocket об ошибке
            except: 
                 db.session.rollback() 
            return jsonify({"error": "Internal server error processing callback data"}), 500

    elif status_str != 'done': # Обрабатываем ошибку от планировщика
        try:
            generation.status = GenerationStatus.FAILED
            # TODO: Пытаться получить сообщение об ошибке из callback? 
            # Зависит от того, передает ли его планировщик в request.form
            generation.error_message = f"Scheduler reported status: {status_str}"
            db.session.commit()
            print(f"Generation {generation_id} status updated to FAILED. Reason: {status_str}")
            # TODO: Отправить WebSocket уведомление об ошибке
            # socketio.emit('generation_update', {'id': generation.id, 'status': 'FAILED', 'error': generation.error_message})
        except Exception as e:
             db.session.rollback()
             print(f"Error updating generation {generation_id} status to FAILED: {e}")
             # Все равно возвращаем 200, чтобы планировщик успокоился
             return jsonify({"error": "Internal server error updating generation status"}), 200
    else:
        # Статус 'done', но нет файлов? Логируем как ошибку или предупреждение.
        print(f"Warning: Received 'done' status for generation {generation_id} but no files were provided.")
        # Можно обновить статус на FAILED или оставить COMPLETED без файлов?
        # Решаем оставить COMPLETED, но без файлов.
        try:
            generation.status = GenerationStatus.COMPLETED
            generation.error_message = "Scheduler reported 'done' but sent no files."
            db.session.commit()
            # TODO: Отправить WebSocket уведомление об успехе (но без файлов)
        except Exception as e:
             db.session.rollback()
             print(f"Error updating generation {generation_id} status to COMPLETED (no files): {e}")
             return jsonify({"error": "Internal server error updating generation status"}), 200


    return jsonify({"message": "Callback received"}), 200

# --- File Serving Route --- 

@files_api.route('/generated_files/<path:filepath>')
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
        
    logging.info(f"Attempting to serve file: {filepath}")
    directory = current_app.config['GENERATED_FILES_FOLDER']
    
    # Безопасное соединение пути и проверка выхода за пределы директории
    # Используем os.path.abspath для получения канонического пути
    requested_path = os.path.abspath(os.path.join(directory, filepath))
    
    # Проверяем, что результирующий путь начинается с базовой директории
    if not requested_path.startswith(os.path.abspath(directory) + os.sep):
        logging.warning(f"Forbidden path traversal attempt: {filepath}")
        return jsonify({"error": "Forbidden path"}), 403
        
    # Используем send_from_directory для безопасной отдачи
    # Он принимает директорию и имя файла (относительно этой директории)
    try:
        # Передаем *полный* путь к директории и сам *файл* как имя
        return send_from_directory(os.path.dirname(requested_path), 
                                   os.path.basename(requested_path),
                                   as_attachment=False) # Отдавать как inline, а не скачивание
    except FileNotFoundError:
        logging.error(f"File not found at path: {requested_path}")
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
         logging.error(f"Error serving file {filepath}: {e}")
         return jsonify({"error": "Could not serve file"}), 500
