import os
from backend.app import create_app, socketio # Импортируем фабрику и socketio

app = create_app() # Создаем экземпляр приложения

if __name__ == '__main__':
    # Используем параметры из .env, которые уже загружаются внутри create_app
    socketio.run(app, 
                 debug=os.environ.get('FLASK_DEBUG') == '1', 
                 port=int(os.environ.get('FLASK_PORT', 5001)), # Берем порт из .env или по умолчанию
                 host='0.0.0.0')
