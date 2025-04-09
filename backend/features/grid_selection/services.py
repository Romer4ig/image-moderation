import logging
from sqlalchemy import func, distinct
from sqlalchemy.orm import joinedload, selectinload
# Используем абсолютные импорты
from backend.models import db, Project, Collection, Generation, GenerationStatus, SelectedCover, GeneratedFile
# Убираем импорт socketio
# from backend.app import socketio # Для WebSocket событий
# Добавляем импорт current_app
from flask import current_app

logger = logging.getLogger(__name__)

def get_grid_data_service(visible_project_ids_str: str | None) -> dict:
    """ 
    Сервисная функция для получения данных грида.
    Возвращает словарь с данными или вызывает исключение.
    """
    visible_ids_list = None
    if visible_project_ids_str:
        visible_ids_list = [pid.strip() for pid in visible_project_ids_str.split(',') if pid.strip()]
        if not visible_ids_list:
            return {'projects': [], 'collections': []}

    # 1. Получаем Проекты (фильтруем по visible_ids_list, если он передан)
    projects_query = Project.query.order_by(Project.name)
    if visible_ids_list:
        projects_query = projects_query.filter(Project.id.in_(visible_ids_list))
    
    projects_to_include = projects_query.all()
    projects_data = [p.to_dict() for p in projects_to_include]

    # 2. Получаем все Коллекции
    all_collections = Collection.query.order_by(Collection.name).all()
    collections_data_filtered = []

    # 3. Для каждой коллекции собираем данные ячеек
    for collection in all_collections:
        collection_dict = collection.to_dict()
        cells = {}
        has_relevant_data_in_visible_columns = False

        last_gen_date_query = db.session.query(func.max(Generation.updated_at)) \
                                     .filter(Generation.collection_id == collection.id) \
                                     .scalar()
        collection_dict['last_generation_at'] = last_gen_date_query.isoformat() + 'Z' if last_gen_date_query else None

        for project in projects_to_include:
            cell_key = project.id
            cell_data = {
                'status': 'not_generated',
                'generation_id': None,
                'file_url': None,
                'is_selected': False,
                'error_message': None
            }
            current_cell_is_relevant = False

            selected = SelectedCover.query.filter_by(
                collection_id=collection.id,
                project_id=project.id
            ).options(
                selectinload(SelectedCover.generation) # Оставляем загрузку самой генерации
                # .selectinload(Generation.generated_files) # Убираем загрузку файлов здесь
            ).first()

            if selected:
                cell_data['is_selected'] = True
                file_to_display = None
                if selected.generated_file_id:
                    # Если есть ID файла, загружаем его явно
                    file_to_display = GeneratedFile.query.get(selected.generated_file_id)
                elif selected.generation and selected.generation.generated_files:
                    # Иначе берем первый файл из уже загруженных (если есть)
                    file_to_display = next((f for f in selected.generation.generated_files), None)

                if selected.generation and file_to_display:
                    cell_data['generation_id'] = selected.generation.id
                    cell_data['status'] = 'selected'
                    cell_data['file_url'] = file_to_display.get_url()
                    cell_data['file_path'] = file_to_display.file_path
                    current_cell_is_relevant = True
                elif selected.generation:
                    cell_data['generation_id'] = selected.generation.id
                    cell_data['status'] = 'error'
                    cell_data['error_message'] = 'Selected cover data inconsistent (file missing?)'
                    current_cell_is_relevant = True
                else:
                    cell_data['status'] = 'error'
                    cell_data['error_message'] = 'Selected cover data inconsistent (generation missing?)'
                    current_cell_is_relevant = True
            else:
                last_generation = Generation.query.filter_by(
                    collection_id=collection.id,
                    project_id=project.id
                ).order_by(Generation.updated_at.desc()).first()

                if last_generation:
                    cell_data['generation_id'] = last_generation.id
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
                    else:
                        cell_data['status'] = 'unknown'
                        current_cell_is_relevant = True

            cells[cell_key] = cell_data
            if current_cell_is_relevant:
                has_relevant_data_in_visible_columns = True

        # Включаем коллекцию, если для нее есть релевантные данные в видимых колонках
        # (или если фильтр по проектам не используется)
        # if has_relevant_data_in_visible_columns or not visible_ids_list: 
        # Упрощенная логика: пока возвращаем все строки, фильтрация на фронте
        collection_dict['cells'] = cells
        collections_data_filtered.append(collection_dict)

    return {
        'projects': projects_data,
        'collections': collections_data_filtered
    }

def get_selection_data_service(collection_id: str, project_ids_str: str, initial_project_id: str) -> dict | None:
    """
    Сервисная функция для получения данных окна выбора.
    Возвращает словарь с данными или None при ошибке 404.
    """
    project_ids_list = [pid.strip() for pid in project_ids_str.split(',') if pid.strip()]
    if not project_ids_list:
        # Если список ID проектов пуст после парсинга
        # Проверяем существование коллекции и начального проекта перед возвратом
        collection = Collection.query.get(collection_id)
        target_project = Project.query.get(initial_project_id)
        if not collection or not target_project:
             return None
        return {
             'collection': collection.to_dict(),
             'target_project': target_project.to_dict(),
             'top_row_projects': [p.to_dict() for p in Project.query.order_by(Project.name).all()], # Все равно нужны все проекты для ряда
             'generation_attempts': [],
             'project_ids_with_generations': []
        }

    # Проверяем существование основной коллекции и начального проекта
    collection = Collection.query.get(collection_id)
    target_project = Project.query.get(initial_project_id)
    if not collection or not target_project:
        return None # Сигнализируем об ошибке 404

    # 1. Получаем все проекты
    all_projects = Project.query.order_by(Project.name).all()

    # Получаем ID проектов с завершенными генерациями
    projects_with_completed_generations = db.session.query(distinct(Generation.project_id)) \
        .filter(
            Generation.collection_id == collection_id,
            Generation.status == GenerationStatus.COMPLETED
        ).all()
    project_ids_with_generations = [pid[0] for pid in projects_with_completed_generations]

    # 2. Получаем выбранные обложки
    selected_covers_query = SelectedCover.query.filter_by(collection_id=collection_id) \
        .options(
            selectinload(SelectedCover.generation).selectinload(Generation.generated_files),
            selectinload(SelectedCover.generated_file) # Загружаем сам файл обложки
        ).all()

    selected_covers_map = {}
    for sc in selected_covers_query:
        file_to_use = sc.generated_file # Предпочитаем прямую ссылку
        if not file_to_use and sc.generation and sc.generation.generated_files:
             file_to_use = next((f for f in sc.generation.generated_files), None)

        if file_to_use:
            selected_covers_map[sc.project_id] = {
                'generation_id': sc.generation_id,
                'generated_file_id': file_to_use.id,
                'file_url': file_to_use.get_url()
            }

    top_row_data = []
    for p in all_projects:
        top_row_data.append({
            'project_id': p.id,
            'project_name': p.name,
            'selected_cover': selected_covers_map.get(p.id)
        })

    # 3. Получаем генерации для запрошенных project_ids
    generation_attempts_query = Generation.query.filter(
        Generation.collection_id == collection_id,
        Generation.project_id.in_(project_ids_list),
        Generation.status == GenerationStatus.COMPLETED
    ).options(
        # selectinload(Generation.generated_files) # Убираем selectinload для dynamic relationship
    ).order_by(Generation.created_at.desc())

    generation_attempts = generation_attempts_query.all()

    attempts_data = []
    for gen in generation_attempts:
        origin_project_id = gen.project_id
        for file in sorted(gen.generated_files, key=lambda f: f.created_at): # Сортируем файлы, если нужно
            attempts_data.append({
                'generation_id': gen.id,
                'generated_file_id': file.id,
                'file_url': file.get_url(),
                'created_at': file.created_at.isoformat() + 'Z',
                'origin_project_id': origin_project_id
            })

    return {
        'collection': collection.to_dict(),
        'target_project': target_project.to_dict(),
        'top_row_projects': top_row_data,
        'generation_attempts': attempts_data,
        'project_ids_with_generations': project_ids_with_generations
    }

def select_cover_service(data: dict) -> tuple[bool, str, int]:
    """
    Сервисная функция для выбора обложки.
    Возвращает кортеж (success: bool, message: str, status_code: int).
    """
    collection_id = data['collection_id']
    project_id = data['project_id']
    generation_id = data['generation_id']
    generated_file_id = data.get('generated_file_id')

    # Проверяем существование сущностей
    collection = Collection.query.get(collection_id)
    project = Project.query.get(project_id)
    generation = Generation.query.get(generation_id)
    if not collection:
        return False, "Collection not found", 404
    if not project:
        return False, "Project not found", 404
    if not generation:
        return False, "Generation not found", 404

    # Если generated_file_id не передан, берем первый файл
    file_to_select = None
    if generated_file_id:
         file_to_select = GeneratedFile.query.get(generated_file_id)
         if not file_to_select:
              return False, f"GeneratedFile with id {generated_file_id} not found", 404
         # Доп. проверка, что файл принадлежит нужной генерации
         if file_to_select.generation_id != generation_id:
              logger.warning(f"Attempt to select file {generated_file_id} which does not belong to generation {generation_id}")
              return False, "File does not belong to the specified generation", 400
    else:
        # Ищем первый файл в генерации (если ID не передан)
        file_to_select = generation.generated_files.first()
        if not file_to_select:
            return False, "Cannot select cover: Generation has no files", 400
        generated_file_id = file_to_select.id # Запоминаем ID найденного файла

    # Выполняем UPSERT
    try:
        SelectedCover.query.filter_by(collection_id=collection_id, project_id=project_id).delete()
        db.session.flush()

        new_selection = SelectedCover(
            collection_id=collection_id,
            project_id=project_id,
            generation_id=generation_id,
            generated_file_id=generated_file_id # Используем ID найденного/проверенного файла
        )
        db.session.add(new_selection)
        db.session.commit()
        
        # Отправляем WebSocket событие
        try:
            socketio = current_app.extensions['socketio']
            socketio.emit('grid_cell_update', { 
                'collection_id': collection_id, 
                'project_id': project_id, 
                'status': 'selected', 
                'generation_id': generation_id,
                'file_url': file_to_select.get_url() # Используем URL найденного/проверенного файла
                # Добавить другие нужные поля?
            })
            logger.info(f"Sent grid_cell_update WebSocket event for C:{collection_id} P:{project_id}")
        except Exception as ws_err:
            logger.error(f"Failed to send grid_cell_update WebSocket event for C:{collection_id} P:{project_id}: {ws_err}")
            
        logger.info(f"Cover selected for C:{collection_id} P:{project_id}")
        return True, "Cover selected successfully", 200
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error selecting cover for C:{collection_id} P:{project_id}")
        return False, "Failed to select cover", 500 