import os
import logging

logging.basicConfig(
    level=logging.INFO,  # или DEBUG, если нужно больше подробностей
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

# # Хак для разрешения относительных импортов при прямом запуске
# # (Должен быть до любых относительных импортов в этом файле)
# import sys
# if __name__ == '__main__' and '__file__' in globals():
#     # Добавляем родительскую директорию (корень проекта) в sys.path
#     # Это позволяет Python найти пакет 'backend' при импорте '.models'
#     current_dir = os.path.dirname(os.path.abspath(__file__))
#     parent_dir = os.path.dirname(current_dir)
#     if parent_dir not in sys.path:
#         sys.path.insert(0, parent_dir)
# # ---- Конец хака ----

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_cors import CORS
from dotenv import load_dotenv
from flask_migrate import Migrate
# Используем абсолютный импорт
from backend.models import db # Импортируем db из models.py

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

socketio = SocketIO()

def create_app():
    app = Flask(__name__)

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback-secret-key') # Обязательно!
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    base_dir = os.path.abspath(os.path.dirname(__file__))
    app.config['GENERATED_FILES_FOLDER'] = os.path.join(base_dir, os.environ.get('GENERATED_FILES_FOLDER', 'generated_images'))
    # Убедимся, что папка существует
    os.makedirs(app.config['GENERATED_FILES_FOLDER'], exist_ok=True)

    # CORS - разрешаем все источники для разработки, для продакшена нужно настроить конкретнее
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Инициализация расширений
    db.init_app(app)
    Migrate(app, db)
    socketio.init_app(app, cors_allowed_origins="*") # Разрешаем CORS для SocketIO

    with app.app_context():
        # Создание таблиц БД
        # Используем абсолютный импорт
        from backend import models # Убедимся, что модели импортированы перед create_all
        db.create_all()

        # --- Регистрация Blueprints (API маршрутов) ---
        # Используем абсолютный импорт
        # from backend.api import projects_api, collections_api, generations_api, files_api # Импортируем blueprints
        # Импортируем Blueprint из нового среза
        from backend.features.project_management.routes import projects_bp
        from backend.features.collection_management.routes import collections_bp
        from backend.features.image_generation.routes import generation_bp
        from backend.features.grid_selection.routes import grid_selection_bp
        from backend.features.file_serving.routes import file_serving_bp
        # Импортируем остальные из старого api.py (пока они там)
        # from backend.api import collections_api, generations_api, files_api 
        # from backend.api import generations_api, files_api # Убираем collections_api
        # from backend.api import files_api # Убираем generations_api из старого
        # from backend.api import files_api 

        # app.register_blueprint(projects_api, url_prefix='/api') # Закомментировано
        app.register_blueprint(projects_bp) # Регистрируем новый Blueprint (префикс /api уже в нем)
        # app.register_blueprint(collections_api, url_prefix='/api') # Закомментировано
        app.register_blueprint(collections_bp) # Регистрируем новый Blueprint (префикс /api уже в нем)
        # app.register_blueprint(generations_api, url_prefix='/api') # Закомментировано
        app.register_blueprint(generation_bp) # Регистрируем новый Blueprint (префикс /api уже в нем)
        app.register_blueprint(grid_selection_bp) # Регистрируем новый Blueprint (префикс /api уже в нем)
        # app.register_blueprint(files_api) # Закомментировано
        app.register_blueprint(file_serving_bp) # Регистрируем новый Blueprint (без префикса)

        # Тестовый маршрут
        @app.route('/api/hello')
        def hello():
            return {"message": "Hello from Flask Backend!"}
            
        # TODO: Добавить маршрут для обслуживания сгенерированных файлов
        # @app.route('/generated_images/<path:filename>')
        # def serve_generated_file(filename):
        #     # Нужна логика проверки прав доступа и статуса модерации!
        #     return send_from_directory(app.config['GENERATED_FILES_FOLDER'], filename)

    # --- Обработчики SocketIO --- 
    # (Будет добавлено позже)
    @socketio.on('connect')
    def handle_connect():
        print('Client connected')

    @socketio.on('disconnect')
    def handle_disconnect():
        print('Client disconnected')

    return app

# Создаем экземпляр приложения для запуска (например, через run.py или gunicorn)
# app = create_app() 

# Если хотим запускать через python app.py (для отладки)
# Этот блок можно закомментировать или удалить, т.к. запуск идет через run.py
# if __name__ == '__main__':
#     app = create_app()
#     # Используем socketio.run для поддержки WebSockets
#     socketio.run(app, 
#                  debug=os.environ.get('FLASK_DEBUG') == '1', 
#                  port=int(os.environ.get('FLASK_PORT', 5001)), # Берем порт из .env
#                  host='0.0.0.0',allow_unsafe_werkzeug=True)
