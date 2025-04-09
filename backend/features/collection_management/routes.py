from flask import Blueprint, request, jsonify
from backend.models import db, Project, Collection # Используем абсолютный импорт

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
    collection.type = data.get('type', collection.type)
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


# # --- Project-related Collection Routes --- 
# # Примечание: этот маршрут связывает две сущности. В идеале, его можно вынести
# # в отдельный модуль связей или оставить в более общей "коллекционной" фиче.
# @collections_bp.route('/projects/<string:project_id>/collections', methods=['GET'])
# def get_project_collections(project_id):
#     project = Project.query.get_or_404(project_id) # Проверяем, что проект существует
#     # Ищем коллекции, связанные с этим проектом через Generation или SelectedCover?
#     # Текущая модель Collection не имеет прямой связи project_id. 
#     # Этот эндпоинт, возможно, не имеет смысла в текущей схеме или требует JOIN.
#     # Пока что возвращаем ВСЕ коллекции, как в старом /collections GET.
#     # !!! НЕОБХОДИМО ПЕРЕСМОТРЕТЬ ЛОГИКУ ЭТОГО ЭНДПОИНТА !!!
#     collections = Collection.query.order_by(Collection.name).all()
#     print(f"WARNING: Endpoint /projects/{project_id}/collections currently returns ALL collections. Logic needs review.") # Логгирование!
#     return jsonify([c.to_dict() for c in collections]) 