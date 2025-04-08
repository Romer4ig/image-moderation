import enum
import uuid
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask import url_for

db = SQLAlchemy() # Создаем экземпляр SQLAlchemy здесь

# Определяем Enum для статусов генерации
class GenerationStatus(enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    COMPLETED = "completed"
    FAILED = "failed"

# Определяем Enum для статусов модерации
class ModerationStatus(enum.Enum):
    PENDING_MODERATION = "pending_moderation"
    APPROVED = "approved"
    REJECTED = "rejected"

# Определяем Enum для типов Коллекций (ПРИМЕР - уточнить список!)
class CollectionType(enum.Enum):
    CHARACTER = "character"
    STYLE = "style"
    OBJECT = "object"
    SCENE = "scene"
    # ... другие типы ...

class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(120), nullable=False)
    base_generation_params_json = db.Column(db.JSON, nullable=True, default=lambda: {}) # Используем lambda для default
    base_positive_prompt = db.Column(db.Text, nullable=True, default='')
    base_negative_prompt = db.Column(db.Text, nullable=True, default='')
    default_width = db.Column(db.Integer, nullable=False, default=512)
    default_height = db.Column(db.Integer, nullable=False, default=512)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    collections = db.relationship('Collection', back_populates='project', lazy='dynamic', cascade="all, delete-orphan")
    generations = db.relationship('Generation', back_populates='project', lazy='dynamic')

    def __repr__(self):
        return f'<Project {self.name} ({self.id})>'

    def to_dict(self): # Метод для сериализации в JSON
        return {
            'id': self.id,
            'name': self.name,
            'base_generation_params_json': self.base_generation_params_json,
            'base_positive_prompt': self.base_positive_prompt,
            'base_negative_prompt': self.base_negative_prompt,
            'default_width': self.default_width,
            'default_height': self.default_height,
            'created_at': self.created_at.isoformat() + 'Z',
            'updated_at': self.updated_at.isoformat() + 'Z'
        }


class Collection(db.Model):
    __tablename__ = 'collections'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = db.Column(db.String(36), db.ForeignKey('projects.id'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    type = db.Column(db.String(50), nullable=True, index=True) # TODO: Use db.Enum(CollectionType)
    collection_positive_prompt = db.Column(db.Text, nullable=True, default='')
    collection_negative_prompt = db.Column(db.Text, nullable=True, default='')
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    project = db.relationship('Project', back_populates='collections')
    generations = db.relationship('Generation', back_populates='collection', lazy='dynamic')

    def __repr__(self):
        return f'<Collection {self.name} (Project: {self.project_id})>'

    def to_dict(self): # Метод для сериализации в JSON
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'type': self.type,
            'collection_positive_prompt': self.collection_positive_prompt,
            'collection_negative_prompt': self.collection_negative_prompt,
            'comment': self.comment,
            'created_at': self.created_at.isoformat() + 'Z',
            'updated_at': self.updated_at.isoformat() + 'Z'
        }

class Generation(db.Model):
    __tablename__ = 'generations'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = db.Column(db.String(36), db.ForeignKey('projects.id'), nullable=False, index=True)
    collection_id = db.Column(db.String(36), db.ForeignKey('collections.id'), nullable=False, index=True)
    scheduler_task_id = db.Column(db.String, nullable=True, index=True)
    status = db.Column(db.Enum(GenerationStatus), default=GenerationStatus.PENDING, nullable=False, index=True)
    moderation_status = db.Column(db.Enum(ModerationStatus), default=ModerationStatus.PENDING_MODERATION, nullable=False, index=True)
    final_positive_prompt = db.Column(db.Text, nullable=False)
    final_negative_prompt = db.Column(db.Text, nullable=True)
    generation_params = db.Column(db.JSON, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    project = db.relationship('Project', back_populates='generations')
    collection = db.relationship('Collection', back_populates='generations')
    generated_files = db.relationship('GeneratedFile', back_populates='generation', lazy='dynamic', cascade="all, delete-orphan")
    # selected_in = db.relationship('SelectedCover', backref='generation', uselist=False, cascade="all, delete-orphan") # Может вызвать проблемы при удалении

    def __repr__(self):
        return f'<Generation {self.id} [{self.status.value}/{self.moderation_status.value}]>'

    def to_dict(self, include_files=False): # Метод для сериализации
        data = {
            'id': self.id,
            'project_id': self.project_id,
            'collection_id': self.collection_id,
            'scheduler_task_id': self.scheduler_task_id,
            'status': self.status.value if self.status else None,
            'moderation_status': self.moderation_status.value if self.moderation_status else None,
            'final_positive_prompt': self.final_positive_prompt,
            'final_negative_prompt': self.final_negative_prompt,
            'generation_params': self.generation_params,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() + 'Z',
            'updated_at': self.updated_at.isoformat() + 'Z'
        }
        if include_files:
             data['generated_files'] = [f.to_dict() for f in self.generated_files]
        return data

class GeneratedFile(db.Model):
    __tablename__ = 'generated_files'
    id = db.Column(db.Integer, primary_key=True)
    generation_id = db.Column(db.String(36), db.ForeignKey('generations.id'), nullable=False, index=True)
    file_path = db.Column(db.String, nullable=False, unique=True)
    original_filename = db.Column(db.String, nullable=True)
    mime_type = db.Column(db.String, nullable=True)
    size_bytes = db.Column(db.Integer, nullable=True)
    infotext = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    generation = db.relationship('Generation', back_populates='generated_files')
    # selected_cover = db.relationship('SelectedCover', backref='generated_file', uselist=False, cascade="all, delete-orphan") # Может вызвать проблемы

    def __repr__(self):
        return f'<GeneratedFile {self.file_path} (Gen: {self.generation_id})>'
    
    def get_url(self):
        # Генерирует URL для доступа к файлу через специальный эндпоинт
        # TODO: Создать эндпоинт 'serve_generated_file' в app.py
        try:
            # Используем _external=True для получения полного URL
            # Исправляем имя эндпоинта, добавляя префикс Blueprint
            return url_for('files_api.serve_generated_file', filepath=self.file_path, _external=True, _scheme='http')
        except RuntimeError: 
             # Может возникнуть, если url_for вызывается вне контекста запроса
             # Возвращаем относительный путь как запасной вариант
             # Это нужно будет исправить при реализации отдачи файлов
             return f"/generated_files/{self.file_path}" 

    def to_dict(self): # Метод для сериализации
        return {
            'id': self.id,
            'generation_id': self.generation_id,
            'file_path': self.file_path,
            'original_filename': self.original_filename,
            'mime_type': self.mime_type,
            'size_bytes': self.size_bytes,
            'infotext': self.infotext,
            'created_at': self.created_at.isoformat() + 'Z',
            'url': self.get_url() # Добавляем URL
        }


class SelectedCover(db.Model):
    __tablename__ = 'selected_covers'
    collection_id = db.Column(db.String(36), db.ForeignKey('collections.id'), primary_key=True)
    project_id = db.Column(db.String(36), db.ForeignKey('projects.id'), primary_key=True)
    generation_id = db.Column(db.String(36), db.ForeignKey('generations.id'), nullable=False, index=True)
    generated_file_id = db.Column(db.Integer, db.ForeignKey('generated_files.id'), nullable=True)
    selected_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    # Отношения - необязательны, если доступ нужен через Project/Collection
    # collection = db.relationship('Collection')
    # project = db.relationship('Project')
    generation = db.relationship('Generation')
    generated_file = db.relationship('GeneratedFile')
    __table_args__ = (db.UniqueConstraint('collection_id', 'project_id', name='uq_selected_cover_collection_project'),)

    def __repr__(self):
        return f'<SelectedCover C:{self.collection_id} P:{self.project_id} G:{self.generation_id}>'
