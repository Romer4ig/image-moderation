import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_cors import CORS
from dotenv import load_dotenv

from .models import db # Импортируем db из models.py

# Загружаем переменные окружения из .env файла
load_dotenv()

# Инициализация SocketIO
socketio = SocketIO()

def create_app():
    app = Flask(__name__)

    # Конфигурация из переменных окружения
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback-secret-key') # Обязательно!
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    # Путь к папке для генераций (абсолютный)
    base_dir = os.path.abspath(os.path.dirname(__file__))
    app.config['GENERATED_FILES_FOLDER'] = os.path.join(base_dir, os.environ.get('GENERATED_FILES_FOLDER', 'generated_images'))
    # Убедимся, что папка существует
    os.makedirs(app.config['GENERATED_FILES_FOLDER'], exist_ok=True)

    # CORS - разрешаем все источники для разработки, для продакшена нужно настроить конкретнее
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Инициализация расширений
    db.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*") # Разрешаем CORS для SocketIO

    with app.app_context():
        # Создание таблиц БД
        from . import models # Убедимся, что модели импортированы перед create_all
        db.create_all()

        # --- Регистрация Blueprints (API маршрутов) --- 
        from .api import projects_api, collections_api, generations_api, files_api # Импортируем blueprints
        app.register_blueprint(projects_api, url_prefix='/api')
        app.register_blueprint(collections_api, url_prefix='/api')
        app.register_blueprint(generations_api, url_prefix='/api') 
        app.register_blueprint(files_api) # Без префикса /api для путей файлов

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
if __name__ == '__main__':
    app = create_app()
    # Используем socketio.run для поддержки WebSockets
    socketio.run(app, debug=os.environ.get('FLASK_DEBUG') == '1', port=5001, host='0.0.0.0')
