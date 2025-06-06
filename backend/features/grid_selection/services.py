import logging
import os
import shutil
from sqlalchemy import func, distinct, and_, or_, select, literal_column, case
from sqlalchemy.orm import aliased, contains_eager, selectinload
from sqlalchemy.sql.expression import literal # Добавляем literal
# Используем абсолютные импорты
from backend.models import db, Project, Collection, Generation, GenerationStatus, SelectedCover, GeneratedFile
# Убираем импорт socketio
# from backend.app import socketio # Для WebSocket событий
# Добавляем импорт current_app
from flask import current_app
from datetime import datetime

logger = logging.getLogger(__name__)

def _handle_file_copy_for_selection(selection_path: str, old_file: GeneratedFile | None, new_file: GeneratedFile | None):
    """
    Обрабатывает копирование новой выбранной обложки и удаление старой.
    Эта функция не вызывает исключений, а только логирует ошибки,
    так как файловые операции являются второстепенными по отношению к записи в БД.
    """
    try:
        # Убедимся, что директория для сохранения существует
        os.makedirs(selection_path, exist_ok=True)

        # 1. Удаляем старый файл из папки выбранных, если он там был
        if old_file and old_file.file_path:
            old_filename = os.path.basename(old_file.file_path)
            old_file_dest_path = os.path.join(selection_path, old_filename)
            if os.path.exists(old_file_dest_path):
                os.remove(old_file_dest_path)
                logger.info(f"Removed old selected cover: {old_file_dest_path}")

        # 2. Копируем новый файл в папку выбранных
        if new_file and new_file.file_path:
            source_path = new_file.file_path
            if os.path.exists(source_path):
                shutil.copy(source_path, selection_path)
                logger.info(f"Copied new selected cover from {source_path} to {selection_path}")
            else:
                logger.error(f"Source file for new selection does not exist: {source_path}")

    except Exception as e:
        logger.exception(f"Error during file operations for selection path '{selection_path}': {e}")

# Функция-хелпер для безопасного получения ID проектов
def _parse_project_ids(ids_str: str | None) -> list[str] | None:
    if not ids_str:
        return None
    ids_list = [pid.strip() for pid in ids_str.split(',') if pid.strip()]
    return ids_list if ids_list else None

def get_grid_data_service(visible_project_ids_str: str | None, search=None, type_=None, advanced=None, sort=None, order=None, generation_status_filter=None, page=1, per_page=100) -> dict:
    """
    Оптимизированная сервисная функция для получения данных грида.
    """
    requested_project_ids = _parse_project_ids(visible_project_ids_str)
    # logger.info(f"get_grid_data_service called with requested_project_ids: {requested_project_ids}") # Убираем лог

    # --- 1. Получаем проекты для заголовка ---
    projects_query = db.session.query(Project).order_by(Project.name)
    if requested_project_ids:
        projects_query = projects_query.filter(Project.id.in_(requested_project_ids))
        # logger.info(f"Fetching specific projects for header: {requested_project_ids}") # Убираем лог
    else:
        # logger.info("No specific projects requested, fetching all projects for header.") # Убираем лог
        pass # Просто получаем все проекты

    projects_for_header = projects_query.all()
    projects_data = [p.to_dict() for p in projects_for_header]

    # --- Определяем ID проектов, для которых будем искать данные ячеек ---
    project_ids_for_cells = requested_project_ids if requested_project_ids is not None else [p['id'] for p in projects_data]

    # logger.info(f"Project IDs to be used for fetching cell data: {project_ids_for_cells}") # Убираем лог

    # !!! Убрана проверка и ранний выход при отсутствии проектов !!!

    # --- 2. Строим основной запрос для коллекций ---
    base_query = db.session.query(Collection)

    # УБИРАЕМ outerjoin и add_columns отсюда
    query = base_query 

    # --- Применяем базовые фильтры ---
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Collection.name.ilike(search_term),
                func.cast(Collection.id, db.String).ilike(search_term)
            )
        )
    if type_ and type_ != 'all':
        query = query.filter(Collection.type == type_)

    # --- Применяем advanced фильтры ---
    if advanced == 'empty_positive':
        query = query.filter(or_(Collection.collection_positive_prompt == None, Collection.collection_positive_prompt == ''))
    elif advanced == 'has_comment':
        query = query.filter(and_(Collection.comment != None, Collection.comment != ''))
    elif advanced == 'no_dynamic':
         query = query.filter(
            or_(
                Collection.collection_positive_prompt == None,
                Collection.collection_positive_prompt == '',
                 ~Collection.collection_positive_prompt.contains('{')
            )
        )

    # --- Применяем фильтр по статусу генерации --- 
    if generation_status_filter == 'not_selected':
        if project_ids_for_cells: # Применяем фильтр только если есть видимые проекты
            # Подзапрос для подсчета количества проектов, для которых выбрана обложка для данной коллекции
            selected_covers_count_subquery = select(
                func.count(func.distinct(SelectedCover.project_id)) # Считаем уникальные project_id
            ).where(
                and_(
                    SelectedCover.collection_id == func.cast(Collection.id, db.String),
                    SelectedCover.project_id.in_(project_ids_for_cells)
                )
            ).correlate(Collection).as_scalar()

            # Коллекция должна оставаться, если количество выбранных обложек МЕНЬШЕ, чем общее количество видимых проектов
            query = query.filter(selected_covers_count_subquery < len(project_ids_for_cells))
        # Если project_ids_for_cells пуст, то фильтр 'not_selected' не имеет смысла или должен быть проигнорирован.
        # Текущая логика (если убрать if project_ids_for_cells) оставит все коллекции, что может быть ожидаемо.
    elif generation_status_filter == 'not_generated':
         subquery_generated = select(literal(1)).where(
            and_(
                Generation.collection_id == func.cast(Collection.id, db.String),
                Generation.project_id.in_(project_ids_for_cells) 
            )
        ).exists()
         query = query.filter(~subquery_generated)

    # --- Определяем поле для сортировки (НО НЕ СОРТИРУЕМ ПО last_generation_at ЗДЕСЬ) ---
    sort_direction = 'desc' if order != 'asc' and order != 'ascending' else 'asc'
    sort_field = Collection.id # Сортировка по умолчанию

    if sort == 'name':
        sort_field = Collection.name
    elif sort == 'created_at':
        sort_field = Collection.created_at
    elif sort == 'type':
        sort_field = Collection.type
    # Сортировку по last_generation_at будем делать в Python после получения данных

    if sort != 'last_generation_at': # Применяем сортировку в БД только для других полей
        if sort_direction == 'asc':
            query = query.order_by(sort_field.asc().nullslast())
        else:
            query = query.order_by(sort_field.desc().nullslast())

    # --- Применяем пагинацию к базовому запросу --- 
    try:
        pagination = db.paginate(query, page=page, per_page=per_page, error_out=False)
    except Exception as e:
         logger.exception("Error during pagination query")
         return {
             'projects': projects_data,
             'collections': {
                 'items': [], 'page': page, 'per_page': per_page, 'total': 0,
                 'pages': 0, 'has_next': False, 'has_prev': False
             }
         }

    paginated_collections = pagination.items # Теперь это список объектов Collection
    total_items = pagination.total
    collection_ids_on_page = [c.id for c in paginated_collections]

    # --- Получаем last_generation_at для коллекций на странице ОТДЕЛЬНО ---
    last_gen_times = {}
    if collection_ids_on_page:
        last_gen_query = db.session.query(
            Generation.collection_id,
            func.max(Generation.updated_at)
        ).filter(
            # Сравниваем строки
            Generation.collection_id.in_([str(cid) for cid in collection_ids_on_page])
        ).group_by(Generation.collection_id).all()
        
        # Преобразуем результат в словарь {id: datetime}
        last_gen_times = {str_cid: dt for str_cid, dt in last_gen_query}

    # --- Получаем данные ячеек ---
    # !!! ВОЗВРАЩАЕМ ЛОГИКУ !!!
    cells_data = {} # Структура: { collection_id(int): { project_id(str): { cell_data } } }

    if collection_ids_on_page and project_ids_for_cells: # Выполняем только если есть коллекции и проекты
        # --- Получаем выбранные обложки ---
        selected_covers_list = db.session.query(SelectedCover).filter(
            # Сравниваем Int c Int, Str с Str
            SelectedCover.collection_id.in_(collection_ids_on_page),
            SelectedCover.project_id.in_(project_ids_for_cells)
        ).options(
            selectinload(SelectedCover.generation).selectinload(Generation.generated_files),
            selectinload(SelectedCover.generated_file)
        ).all()

        selected_covers_dict = {}
        for sc in selected_covers_list:
            # Ключ: (collection_id(int), project_id(str))
            selected_covers_dict[(int(sc.collection_id), sc.project_id)] = sc 

        # --- Получаем последние генерации (где нет выбранной обложки) ---
        generation_cte = select(
            Generation.id,
            Generation.collection_id,
            Generation.project_id,
            Generation.status,
            Generation.error_message,
            Generation.updated_at,
            func.row_number().over(
                partition_by=(Generation.collection_id, Generation.project_id),
                order_by=Generation.updated_at.desc()
            ).label('rn')
        ).where(
            # Сравниваем строки с результатом func.cast
            Generation.collection_id.in_([str(cid) for cid in collection_ids_on_page]),
            Generation.project_id.in_(project_ids_for_cells)
        ).cte('generation_ranked')

        latest_generation_query = db.session.query(
            generation_cte.c.id,
            generation_cte.c.collection_id, # Это строка
            generation_cte.c.project_id,
            generation_cte.c.status,
            generation_cte.c.error_message
        ).filter(generation_cte.c.rn == 1)

        latest_generations_dict = {}
        for lg in latest_generation_query.all():
            coll_id_int = int(lg.collection_id) # Преобразуем ID коллекции обратно в int
            # Ключ: (collection_id(int), project_id(str))
            if (coll_id_int, lg.project_id) not in selected_covers_dict:
                 latest_generations_dict[(coll_id_int, lg.project_id)] = {
                     'id': lg.id,
                     'status': lg.status,
                     'error_message': lg.error_message
                 }

        # --- Формируем данные ячеек ---
        for coll_id in collection_ids_on_page: # coll_id здесь int
            cells_data[coll_id] = {}
            for proj_id in project_ids_for_cells: # proj_id здесь str
                cell_key = proj_id # Ключ - ID проекта (строка)
                cell_info = {
                    'status': 'not_generated',
                    'generation_id': None,
                    'file_url': None,
                    'file_path': None,
                    'is_selected': False,
                    'error_message': None
                }

                # Ключ: (collection_id(int), project_id(str))
                selected_cover = selected_covers_dict.get((coll_id, proj_id))
                latest_gen = latest_generations_dict.get((coll_id, proj_id))

                if selected_cover:
                    # ... (логика для selected_cover как была раньше) ...
                    cell_info['is_selected'] = True
                    cell_info['generation_id'] = selected_cover.generation_id
                    file_to_display = selected_cover.generated_file
                    if not file_to_display and selected_cover.generation and selected_cover.generation.generated_files:
                        file_to_display = next((f for f in selected_cover.generation.generated_files), None)
                        logger.warning(f"SelectedCover (C:{coll_id}, P:{proj_id}) has no generated_file_id, using first file from Generation {selected_cover.generation_id}")
                    if file_to_display:
                        cell_info['status'] = 'selected'
                        cell_info['file_url'] = file_to_display.get_url()
                        cell_info['file_path'] = file_to_display.file_path
                    elif selected_cover.generation:
                         cell_info['status'] = 'error'
                         cell_info['error_message'] = 'Selected cover points to generation, but file is missing.'
                         logger.error(f"Selected cover file missing for C:{coll_id}, P:{proj_id}, G:{selected_cover.generation_id}, FileID:{selected_cover.generated_file_id}")
                    else:
                         cell_info['status'] = 'error'
                         cell_info['error_message'] = 'Selected cover data inconsistent (generation missing?).'
                         logger.error(f"Selected cover generation missing for C:{coll_id}, P:{proj_id}, G:{selected_cover.generation_id}")

                elif latest_gen:
                   # ... (логика для latest_gen как была раньше) ...
                    cell_info['generation_id'] = latest_gen['id']
                    if latest_gen['status'] == GenerationStatus.COMPLETED:
                        cell_info['status'] = 'generated_not_selected'
                    elif latest_gen['status'] in [GenerationStatus.PENDING, GenerationStatus.QUEUED]:
                        cell_info['status'] = 'queued'
                    elif latest_gen['status'] == GenerationStatus.FAILED:
                        cell_info['status'] = 'error'
                        cell_info['error_message'] = latest_gen['error_message']
                    else:
                        cell_info['status'] = 'unknown'
                        cell_info['error_message'] = f"Unknown generation status: {latest_gen['status']}"

                cells_data[coll_id][cell_key] = cell_info

    # --- 4. Собираем финальный ответ --- 
    collections_processed = [] # Определяем список ЗДЕСЬ
    for collection in paginated_collections: # collection.id здесь int
        collection_dict = collection.to_dict()
        last_gen_time = last_gen_times.get(str(collection.id)) 
        collection_dict['last_generation_at_raw'] = last_gen_time
        collection_dict['last_generation_at'] = last_gen_time.isoformat() + 'Z' if last_gen_time else None
        collection_dict['cells'] = cells_data.get(collection.id, {}) # Используем int ID коллекции для доступа к cells_data
        collections_processed.append(collection_dict)

    # --- Сортировка в Python (если выбрано last_generation_at) --- 
    # Переносим сортировку СЮДА, после формирования collections_processed
    if sort == 'last_generation_at':
        collections_processed.sort(
            key=lambda c: c['last_generation_at_raw'] or datetime.min, 
            reverse=(sort_direction == 'desc')
        )
        # Удаляем временное поле после сортировки
        for c_dict in collections_processed:
             # Используем try-except на случай, если поля уже нет (хотя не должно)
             try:
                 del c_dict['last_generation_at_raw']
             except KeyError:
                 pass 

    return {
        'projects': projects_data,
        'collections': {
            'items': collections_processed, # Используем обработанный список
            'page': page,
            'per_page': per_page,
            'total': total_items,
            'pages': pagination.pages,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev
        }
    }


# --- Функции для окна выбора --- 

def get_selection_shell_service(collection_id: str, initial_project_id: str) -> dict | None:
    """
    Получает "оболочку" данных для модального окна: инфо о коллекции,
    целевом проекте и всех проектах для верхнего ряда с их выбранными обложками.
    """
    collection = db.session.get(Collection, collection_id)
    target_project = db.session.get(Project, initial_project_id)
    if not collection or not target_project:
        logger.warning(f"Collection {collection_id} or target Project {initial_project_id} not found.")
        return None

    all_projects = Project.query.order_by(Project.name).all()
    all_project_ids = [p.id for p in all_projects]

    selected_covers = db.session.query(SelectedCover).filter(
        SelectedCover.collection_id == collection_id,
        SelectedCover.project_id.in_(all_project_ids) 
    ).options(selectinload(SelectedCover.generated_file)).all()

    selected_covers_map = {}
    for sc in selected_covers:
        if sc.generated_file:
            selected_covers_map[sc.project_id] = {
                'selected_generated_file_id': sc.generated_file_id,
                'selected_cover_url': sc.generated_file.get_url()
            }
        else:
             logger.warning(f"SelectedCover C:{sc.collection_id} P:{sc.project_id} has no generated_file linked.")

    target_project_dict = target_project.to_dict()
    if selected_info := selected_covers_map.get(target_project.id):
        target_project_dict.update(selected_info)

    top_row_projects_list = []
    for p in all_projects:
        p_dict = p.to_dict()
        if selected_info := selected_covers_map.get(p.id):
            p_dict.update(selected_info)
        top_row_projects_list.append(p_dict)

    return {
        'collection': collection.to_dict(),
        'target_project': target_project_dict,
        'top_row_projects': top_row_projects_list,
    }

def get_project_attempts_service(collection_id: str, project_id: str) -> list:
    """
    Получает все завершенные или неудачные попытки генерации для
    одной коллекции и одного проекта.
    """
    attempts_query = db.session.query(Generation).filter(
        Generation.collection_id == collection_id,
        Generation.project_id == project_id,
        Generation.status.in_([GenerationStatus.COMPLETED, GenerationStatus.FAILED])
    ).options(
        selectinload(Generation.generated_files)
    ).order_by(Generation.updated_at.desc())
    
    generation_attempts_raw = attempts_query.all()
    return [gen.to_dict(include_files=True) for gen in generation_attempts_raw]

def select_cover_service(data: dict) -> tuple[bool, str, int]:
    """
    Сервисная функция для выбора обложки.
    Возвращает (успех, сообщение, http_статус)
    """
    collection_id = data.get('collection_id')
    project_id = data.get('project_id')
    generation_id = data.get('generation_id')
    generated_file_id = data.get('generated_file_id') # Может быть None

    # Валидация входных данных (проверяем существование сущностей)
    collection = db.session.get(Collection, collection_id)
    if not collection:
        return False, f"Collection with ID {collection_id} not found.", 404
    project = db.session.get(Project, project_id)
    if not project:
        return False, f"Project with ID {project_id} not found.", 404
    generation = db.session.get(Generation, generation_id)
    if not generation:
        return False, f"Generation with ID {generation_id} not found.", 404
    
    new_file = None
    if generated_file_id:
        new_file = db.session.get(GeneratedFile, generated_file_id)
        if not new_file:
            return False, f"GeneratedFile with ID {generated_file_id} not found.", 404
        if new_file.generation_id != generation.id:
             return False, f"GeneratedFile {generated_file_id} does not belong to generation {generation_id}.", 400

    # Находим существующую запись, чтобы определить, какой файл удалять
    selected_cover = db.session.query(SelectedCover).filter_by(
        collection_id=collection_id,
        project_id=project_id
    ).first()
    old_file_to_delete = selected_cover.generated_file if selected_cover and selected_cover.generated_file else None

    try:
        if selected_cover:
            logger.info(f"Updating existing SelectedCover for C:{collection_id} P:{project_id}")
            selected_cover.generation_id = generation_id
            selected_cover.generated_file_id = new_file.id if new_file else None
        else:
            logger.info(f"Creating new SelectedCover for C:{collection_id} P:{project_id}")
            selected_cover = SelectedCover(
                collection_id=collection_id,
                project_id=project_id,
                generation_id=generation_id,
                generated_file_id=new_file.id if new_file else None
            )
            db.session.add(selected_cover)

        db.session.commit()
        logger.info(f"Successfully selected cover: C:{collection_id}, P:{project_id}, G:{generation_id}, F:{new_file.id if new_file else 'None'}")
        
        # --- Файловые операции после успешного коммита ---
        if project.selection_path:
            _handle_file_copy_for_selection(
                selection_path=project.selection_path,
                old_file=old_file_to_delete,
                new_file=new_file
            )

        # Оповещение через WebSocket (если нужно)
        # try:
        #     if current_app.config.get('USE_SOCKETIO', False) and socketio:
        #          socketio.emit('grid_cell_updated', {
        #              'collection_id': collection_id,
        #              'project_id': project_id,
        #              'status': 'selected',
        #              'generation_id': generation_id,
        #              'file_url': new_file.get_url() if new_file else None,
        #              'file_path': new_file.file_path if new_file else None
        #          }, namespace='/grid')
        #          logger.info(f"Emitted grid_cell_updated for C:{collection_id} P:{project_id}")
        # except Exception as e:
        #      logger.error(f"Error emitting WebSocket event: {e}")

        return True, "Cover selected successfully", 200

    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error selecting cover for C:{collection_id} P:{project_id}")
        return False, f"Database error: {e}", 500 