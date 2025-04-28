from flask import Blueprint, request, jsonify
from backend.models import db, Project, Collection # Используем абсолютный импорт
import csv
import io # Для работы с потоком файла в памяти
import logging # Используем logging

# Настраиваем логгер
logger = logging.getLogger(__name__)

# Создаем Blueprint для этого среза
collections_bp = Blueprint('collection_management', __name__, url_prefix='/api')

# --- Collection API Routes (Standalone) --- 

@collections_bp.route('/collections', methods=['GET'])
def get_collections():
    """ Возвращает список всех коллекций. """
    try:
        collections = Collection.query.order_by(Collection.name).all()
        return jsonify([c.to_dict() for c in collections])
    except Exception as e:
        print(f"Error fetching collections: {e}") # Лучше использовать logging
        return jsonify({"error": "Failed to fetch collections"}), 500

@collections_bp.route('/collections', methods=['POST'])
def add_collection():
    """ Добавляет новый независимый сборник в базу данных. """
    data = request.json
    
    # Оставляем только name и id обязательными
    required_fields = ['id', 'name'] 
    if not data or not all(field in data and (data[field] is not None and data[field] != '') for field in required_fields):
        missing = [field for field in required_fields if not data or field not in data or (data[field] is None or data[field] == '')]
        return jsonify({"error": f"Missing or empty required fields: {', '.join(missing)}"}), 400

    try:
        collection_id = int(data['id']) # Преобразуем ID в число
    except (ValueError, TypeError):
         return jsonify({"error": "Invalid ID format. ID must be an integer."}), 400

    name = data['name']
    # Получаем тип, если он есть, иначе None
    collection_type = data.get('type', None) 
    
    # Проверка на уникальность ID
    if Collection.query.get(collection_id):
        return jsonify({"error": f"Collection with ID '{collection_id}' already exists"}), 409

    try:
        new_collection = Collection(
            id=collection_id, # Передаем ID из запроса
            name=name,
            type=collection_type, # Передаем тип (может быть None)
        )
        db.session.add(new_collection)
        db.session.commit()
        print(f"Added new collection: ID={new_collection.id}, Name={new_collection.name}") # Лучше использовать logging
        return jsonify({"message": "Collection added successfully", "collection": new_collection.to_dict()}), 201 

    except Exception as e:
        db.session.rollback()
        print(f"Error adding collection: {e}") # Лучше использовать logging
        return jsonify({"error": "Failed to add collection to database"}), 500

@collections_bp.route('/collections/<string:collection_id>', methods=['GET'])
def get_collection(collection_id):
    collection = Collection.query.get_or_404(collection_id)
    return jsonify(collection.to_dict())

@collections_bp.route('/collections/<string:collection_id>', methods=['PUT'])
def update_collection(collection_id):
    collection = Collection.query.get_or_404(collection_id)
    data = request.json
    if not data: return jsonify({"error": "No data provided"}), 400

    collection.name = data.get('name', collection.name)
    # Позволяем установить type в None или строку
    if 'type' in data:
        collection.type = data['type'] if data['type'] != '' else None
    collection.collection_positive_prompt = data.get('collection_positive_prompt', collection.collection_positive_prompt)
    collection.collection_negative_prompt = data.get('collection_negative_prompt', collection.collection_negative_prompt)
    collection.comment = data.get('comment', collection.comment)

    db.session.commit()
    return jsonify(collection.to_dict())

@collections_bp.route('/collections/<string:collection_id>', methods=['DELETE'])
def delete_collection(collection_id):
    collection = Collection.query.get_or_404(collection_id)
    # TODO: Проверить cascade удаление связанных Generation, SelectedCover?
    db.session.delete(collection)
    db.session.commit()
    return jsonify({"message": f"Collection '{collection.name}' deleted"}), 200

@collections_bp.route('/collections/import-csv', methods=['POST'])
def import_collections_csv():
    """
    Импортирует коллекции из CSV файла.
    Ожидаемый формат CSV: id,name,type,collection_positive_prompt
    id и name - обязательные.
    Пропускает строки с существующими ID.
    Автоматически определяет наличие заголовка.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if not file.filename.lower().endswith('.csv'):
         return jsonify({"error": "Invalid file type, please upload a CSV file"}), 400

    # Статистика импорта
    processed_rows = 0
    added_count = 0
    skipped_duplicates = 0
    skipped_errors = 0
    error_messages = []
    new_collections = []

    try:
        # Читаем файл как текстовый поток
        stream = io.StringIO(file.stream.read().decode("UTF-8", errors='ignore'), newline=None) # Добавляем errors='ignore'
        # Определяем наличие заголовка
        try:
            has_header = csv.Sniffer().has_header(stream.read(1024))
            stream.seek(0) # Возвращаемся к началу файла
        except csv.Error:
            logger.warning("Could not determine CSV header, assuming none.")
            has_header = False
            stream.seek(0)

        # Всегда используем csv.reader
        reader = csv.reader(stream)

        if has_header:
            try:
                header_row = next(reader) # Пропускаем заголовок
                logger.info(f"Skipping header row: {header_row}")
            except StopIteration:
                 return jsonify({"error": "CSV file seems to contain only a header row"}), 400
        
        existing_ids = {str(c.id) for c in Collection.query.with_entities(Collection.id).all()}
        logger.info(f"Found {len(existing_ids)} existing collection IDs.")

        for i, row_data in enumerate(reader):
            row_num = i + (2 if has_header else 1) # Номер строки в файле (для ошибок)
            processed_rows += 1
            
            collection_id_str = None
            name = None
            collection_type = None
            positive_prompt = None

            try:
                # Доступ по индексу
                if len(row_data) < 2:
                        raise ValueError("Row has fewer than 2 columns (expected at least id, name)")
                collection_id_str = row_data[0].strip()
                name = row_data[1].strip()
                # Получаем остальные поля по индексу, если они есть
                collection_type = row_data[2].strip() if len(row_data) > 2 and row_data[2] else None
                positive_prompt = row_data[3].strip() if len(row_data) > 3 and row_data[3] else None
                
                # Валидация ID
                if not collection_id_str:
                    raise ValueError("Missing 'id'")
                try:
                    collection_id = int(collection_id_str)
                except ValueError:
                     raise ValueError(f"Invalid 'id' format: '{collection_id_str}'. Must be an integer.")
                
                # Валидация Name
                if not name:
                    raise ValueError("Missing 'name'")

                # Проверка на дубликат ID
                if str(collection_id) in existing_ids:
                    skipped_duplicates += 1
                    logger.debug(f"Skipping duplicate ID {collection_id} at row {row_num}")
                    continue

                # Создаем новую коллекцию
                new_collection = Collection(
                    id=collection_id,
                    name=name,
                    type=collection_type, # Будет None если пусто или отсутствует
                    collection_positive_prompt=positive_prompt # Будет None если пусто или отсутствует
                )
                new_collections.append(new_collection)
                existing_ids.add(str(collection_id)) # Добавляем в сет, чтобы не дублировать внутри файла
                added_count += 1

            except (ValueError, IndexError) as e: # Убрали KeyError, т.к. нет словаря
                error_msg = f"Error processing row {row_num}: {e}. Row data: {row_data}"
                logger.warning(error_msg)
                error_messages.append(error_msg)
                skipped_errors += 1
                continue # Пропускаем строку с ошибкой

        if new_collections:
            db.session.add_all(new_collections)
            db.session.commit()
            logger.info(f"Successfully added {len(new_collections)} new collections from CSV.")
        else:
            logger.info("No new valid collections found in CSV to add.")
            # Не коммитим, если ничего не добавлено


    except Exception as e:
        db.session.rollback() # Откатываем изменения в случае общей ошибки
        logger.exception("Failed to process CSV file")
        return jsonify({"error": f"An error occurred during CSV processing: {e}"}), 500
    finally:
        file.close() # Закрываем файл

    return jsonify({
        "message": "CSV import process completed.",
        "processed_rows": processed_rows,
        "added_count": added_count,
        "skipped_duplicates": skipped_duplicates,
        "skipped_errors": skipped_errors,
        "errors": error_messages
    }), 200
