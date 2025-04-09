from flask import Blueprint, request, jsonify
from backend.models import db, Project # Используем абсолютный импорт

# Создаем Blueprint для этого среза
projects_bp = Blueprint('project_management', __name__, url_prefix='/api')

@projects_bp.route('/projects', methods=['POST'])
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