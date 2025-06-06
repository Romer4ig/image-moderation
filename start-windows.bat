@echo off
CHCP 65001 > nul
ECHO "Запускаю бэкенд..."
REM Предполагается, что виртуальное окружение находится в backend/venv
START "Backend" cmd /k "call backend\\venv\\Scripts\\activate.bat && python run.py"

ECHO "Запускаю фронтенд..."
START "Frontend" cmd /k "cd frontend && npm i && npm run build && npm run preview" 