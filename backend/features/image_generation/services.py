import os
import requests
import json
import uuid
import logging
from flask import current_app, url_for
from datetime import datetime
# Используем абсолютные импорты
from backend.models import db, Project, Collection, Generation, GenerationStatus, ModerationStatus, GeneratedFile
# Убираем прямой импорт socketio отсюда
# from backend.app import socketio # Импортируем socketio для эвентов

logger = logging.getLogger(__name__)

# --- Вспомогательная функция для наследования параметров (перенесено из api.py) ---

def merge_generation_parameters(project_id: str, collection_id: str) -> tuple[dict, str, str]:
    """
    Объединяет параметры генерации из Проекта и Коллекции.
    Возвращает кортеж: (final_params_dict, final_positive_prompt, final_negative_prompt)
    """
    project = Project.query.get_or_404(project_id)
    collection = Collection.query.get_or_404(collection_id)

    # 1. Начинаем с базовых параметров проекта (если они есть)
    final_params = project.base_generation_params_json or {}

    # 2. Устанавливаем/Перезаписываем размеры
    # TODO: Учесть возможные переопределения из запроса пользователя, если нужно
    final_params['width'] = project.default_width
    final_params['height'] = project.default_height

    # 3. Собираем позитивный промпт
    positive_parts = [p for p in [project.base_positive_prompt, collection.collection_positive_prompt] if p]
    final_positive = ", ".join(positive_parts)

    # 4. Собираем негативный промпт
    negative_parts = [p for p in [project.base_negative_prompt, collection.collection_negative_prompt] if p]
    final_negative = ", ".join(negative_parts)

    # 5. Добавляем/Перезаписываем промпты в параметры
    final_params['prompt'] = final_positive
    if final_negative: # Добавляем негативный, только если он не пустой
        final_params['negative_prompt'] = final_negative
    elif 'negative_prompt' in final_params: # Удаляем, если он был в базовых, но стал пустым
        del final_params['negative_prompt']

    # TODO: Добавить сюда логику мержа других параметров, если Коллекция
    # должна переопределять или добавлять что-то еще из base_generation_params_json?
    # Например, если коллекция типа "style", она может добавлять свой trigger word в prompt?

    return final_params, final_positive, final_negative

# --- Логика обработки /generate-batch (перенесено из api.py) ---

def process_generation_request(pairs: list[dict]) -> dict:
    """
    Обрабатывает запрос на пакетную генерацию.
    Возвращает словарь с результатами и ошибками.
    """
    results = {
        "tasks_started": [],
        "pair_errors": [],
        "overall_error": None
    }

    A1111_API_URL = os.environ.get('A1111_SCHEDULER_URL')
    if not A1111_API_URL:
        results["overall_error"] = "A1111_SCHEDULER_URL is not configured in .env"
        logger.error(results["overall_error"])
        return results
    SCHEDULER_ENDPOINT = f"{A1111_API_URL}/agent-scheduler/v1/queue/txt2img"
    
    FLASK_CALLBACK_URL_BASE = os.environ.get('FLASK_CALLBACK_BASE_URL')
    if not FLASK_CALLBACK_URL_BASE:
        results["overall_error"] = "FLASK_CALLBACK_BASE_URL is not configured in .env"
        logger.error(results["overall_error"])
        return results

    for pair in pairs:
        project_id = pair.get('project_id')
        collection_id = pair.get('collection_id')

        if not project_id or not collection_id:
            results["pair_errors"].append({"pair": pair, "error": "Missing project_id or collection_id"})
            continue

        try:
            # 1. Получаем финальные параметры
            final_params, final_pos, final_neg = merge_generation_parameters(project_id, collection_id)

            # 2. Создаем запись Generation в БД
            new_generation = Generation(
                id=str(uuid.uuid4()), # Генерируем UUID здесь
                project_id=project_id,
                collection_id=collection_id,
                status=GenerationStatus.PENDING, # Начинаем с PENDING
                final_positive_prompt=final_pos,
                final_negative_prompt=final_neg,
                generation_params=final_params # Сохраняем весь JSON параметров
            )
            db.session.add(new_generation)
            db.session.commit() # Коммитим создание Generation
            internal_generation_id = new_generation.id

            # 3. Формируем callback URL
            try:
                 # Генерируем внутри контекста приложения, чтобы url_for работал
                 with current_app.app_context():
                      callback_url = url_for('image_generation.handle_scheduler_callback', 
                                            generation_id=internal_generation_id, 
                                            _external=True,
                                            _scheme='http') # Явно указываем http
                 
                 # Переопределяем базовый URL, если он из .env (полезно для ngrok/docker)
                 if FLASK_CALLBACK_URL_BASE != 'http://127.0.0.1:5001': # Проверяем, отличается ли от дефолтного
                    from urllib.parse import urlparse, urlunparse
                    parsed_callback = urlparse(callback_url)
                    parsed_base = urlparse(FLASK_CALLBACK_URL_BASE)
                    # Собираем URL заново с хостом/портом из .env
                    callback_url = urlunparse((parsed_base.scheme, parsed_base.netloc, parsed_callback.path, 
                                                parsed_callback.params, parsed_callback.query, parsed_callback.fragment))
            except Exception as url_err:
                 logger.error(f"Error generating callback URL for {internal_generation_id}: {url_err}")
                 results["pair_errors"].append({"pair": pair, "error": f"Callback URL generation error: {url_err}"})
                 # Откатываем создание Generation? Или оставляем в PENDING?
                 # Пока оставляем, но логируем
                 continue # Переходим к следующей паре

            # 4. Формируем тело запроса к планировщику
            scheduler_payload = { **final_params, "callback_url": callback_url }

            # 5. Вызываем API планировщика
            logger.info(f"Sending request to scheduler for generation {internal_generation_id}...")
            # logger.debug(f"Scheduler payload: {json.dumps(scheduler_payload, indent=2)}")
            try:
                response = requests.post(SCHEDULER_ENDPOINT, json=scheduler_payload, timeout=15)
                response.raise_for_status() # Проверка на HTTP ошибки (4xx, 5xx)
                
                scheduler_response_data = response.json()
                scheduler_task_id = scheduler_response_data.get('task_id')
                queue_position = scheduler_response_data.get('queue_position')
                
                if not scheduler_task_id:
                    raise ValueError("Scheduler response missing 'task_id'")

                # 6. Обновляем запись Generation в БД
                new_generation.status = GenerationStatus.QUEUED
                new_generation.scheduler_task_id = scheduler_task_id
                db.session.commit()
                
                logger.info(f"Generation {internal_generation_id} queued successfully. Task ID: {scheduler_task_id}, Position: {queue_position}")
                results["tasks_started"].append(internal_generation_id)
                
                # Отправляем событие через SocketIO
                # Получаем socketio из current_app
                try:
                    socketio = current_app.extensions['socketio']
                    socketio.emit('generation_update', {
                        'id': internal_generation_id,
                        'project_id': project_id,
                        'collection_id': collection_id,
                        'status': GenerationStatus.QUEUED.value
                    })
                    logger.info(f"Sent QUEUED WebSocket update for {internal_generation_id}")
                except Exception as ws_err:
                     logger.error(f"Failed to send QUEUED WebSocket update for {internal_generation_id}: {ws_err}")

            except requests.exceptions.RequestException as req_err:
                error_msg = f"Scheduler API request failed: {req_err}"
                logger.error(error_msg)
                new_generation.status = GenerationStatus.FAILED
                new_generation.error_message = str(req_err)
                db.session.commit()
                results["pair_errors"].append({"pair": pair, "error": error_msg})
                # Отправляем событие через SocketIO
                try:
                    socketio = current_app.extensions['socketio']
                    socketio.emit('generation_update', {
                        'id': internal_generation_id,
                        'project_id': project_id,
                        'collection_id': collection_id,
                        'status': GenerationStatus.FAILED.value,
                        'error_message': str(req_err)
                    })
                    logger.info(f"Sent FAILED (RequestException) WebSocket update for {internal_generation_id}")
                except Exception as ws_err:
                    logger.error(f"Failed to send FAILED (RequestException) WebSocket update for {internal_generation_id}: {ws_err}")
            except (ValueError, KeyError) as resp_err:
                 error_msg = f"Scheduler response error: {resp_err}"
                 logger.error(f"{error_msg}. Response: {response.text[:500]}")
                 new_generation.status = GenerationStatus.FAILED
                 new_generation.error_message = f"Scheduler response error: {resp_err}"
                 db.session.commit()
                 results["pair_errors"].append({"pair": pair, "error": error_msg})
                 # Отправляем событие через SocketIO
                 try:
                    socketio = current_app.extensions['socketio']
                    socketio.emit('generation_update', {
                        'id': internal_generation_id,
                        'project_id': project_id,
                        'collection_id': collection_id,
                        'status': GenerationStatus.FAILED.value,
                        'error_message': f"Scheduler response error: {resp_err}"
                    })
                    logger.info(f"Sent FAILED (ResponseError) WebSocket update for {internal_generation_id}")
                 except Exception as ws_err:
                    logger.error(f"Failed to send FAILED (ResponseError) WebSocket update for {internal_generation_id}: {ws_err}")

        except Exception as e:
            db.session.rollback() # Откатываем, если ошибка до вызова API
            error_msg = f"Error processing pair {pair}: {e}"
            logger.exception(error_msg) # Логируем с traceback
            results["pair_errors"].append({"pair": pair, "error": str(e)})
            # Если Generation была создана, нужно ли ее помечать как FAILED?
            # Пока не делаем, т.к. ошибка могла быть до создания Generation
            
    return results

# --- Логика обработки /scheduler_callback (перенесено из api.py) ---

def process_scheduler_callback(generation_id: str, 
                             form_data: dict | None = None, 
                             files: dict | None = None) -> tuple[bool, str]:
    """
    Обрабатывает данные, полученные от планировщика (JSON или Form/Files).
    Возвращает (True, message) при успехе или (False, error_message) при ошибке.
    """
    generation = Generation.query.get(generation_id)
    if not generation:
        logger.warning(f"Callback received for non-existent generation_id: {generation_id}")
        return True, "Generation ID not found, ignoring callback."

    # Извлекаем статус и ошибку (приоритет у form_data, если есть)
    status_str = None
    error_info = None

    if form_data:
        status_str = form_data.get('status')
        error_info = form_data.get('error') # Предполагаем, что ошибка может прийти в form
        # Файлы обрабатываются отдельно из аргумента `files`
        logger.info(f"Processing Form Data - Status: {status_str}, Error: {error_info}")
    else:
         logger.error(f"process_scheduler_callback called without form_data for {generation_id}")
         return False, "Internal error: Service function called without form data."

    logger.info(f"Processing callback for {generation_id}. Final Status: {status_str}. Error Info: {error_info}")

    generation_update_payload = {
        'id': generation.id,
        'project_id': generation.project_id,
        'collection_id': generation.collection_id,
    }

    try:
        if status_str == 'done' and files:
            generation.status = GenerationStatus.COMPLETED
            # Статус модерации по умолчанию PENDING_MODERATION
            generation.moderation_status = ModerationStatus.PENDING_MODERATION 
            generation.error_message = None # Очищаем старую ошибку, если была

            saved_files_info = []
            # Убедимся, что директория для файлов генерации существует
            generation_files_dir = os.path.join(current_app.config['GENERATED_FILES_FOLDER'], generation_id)
            os.makedirs(generation_files_dir, exist_ok=True)
            logger.info(f"Ensured directory exists: {generation_files_dir}")

            # --- Обработка файлов --- 
            # files теперь dict, где значения — списки файлов
            if files:
                total_files = sum(len(file_list) for file_list in files.values())
                logger.info(f"Processing {total_files} files from request.files...")
                for field_name, file_list in files.items():
                    for file_storage in file_list:
                      if not file_storage or not file_storage.filename:
                           logger.warning(f"Skipping empty file field '{field_name}' for {generation_id}")
                           continue
                      original_filename = file_storage.filename
                      # Генерируем безопасное имя
                      filename_base = uuid.uuid4().hex
                      filename_ext = os.path.splitext(original_filename)[1].lower() or '.png' # По умолчанию .png
                      secure_filename = f"{filename_base}{filename_ext}"
                      # Формируем путь ОТНОСИТЕЛЬНО базовой папки generated_images
                      relative_file_path = os.path.join(generation_id, secure_filename) 
                      full_save_path = os.path.join(generation_files_dir, secure_filename) # Путь для сохранения остается прежним
                      mime_type = file_storage.content_type
                      infotext = None # TODO: Как передается infotext с request.files?

                      try:
                           logger.info(f"Saving file '{original_filename}' as '{secure_filename}' to {generation_files_dir}")
                           file_storage.save(full_save_path)
                           logger.info(f"File saved successfully: {full_save_path}")
                           size_bytes = os.path.getsize(full_save_path)

                           # Создаем запись GeneratedFile
                           new_file = GeneratedFile(
                                generation_id=generation.id,
                                file_path=relative_file_path, # Сохраняем путь вида "generation_id/filename.ext"
                                original_filename=original_filename, 
                                mime_type=mime_type,
                                size_bytes=size_bytes,
                                infotext=infotext
                           )
                           db.session.add(new_file)
                           db.session.flush() # Получаем ID
                           saved_files_info.append(new_file.to_dict()) # Собираем инфо для эвента
                           logger.info(f"Created GeneratedFile record for {original_filename} (ID: {new_file.id})")

                      except (IOError, OSError) as save_err:
                           logger.error(f"Error saving file {original_filename} for generation {generation_id}: {save_err}")
                           continue # Пропускаем этот файл
                      except Exception as db_err:
                           logger.error(f"Error creating GeneratedFile record for {original_filename}: {db_err}")
                           db.session.rollback() # Откатываем добавление этого файла
                           continue # Пропускаем этот файл
            else:
                 # Статус 'done', но файлов нет в request.files
                 logger.warning(f"Callback for {generation_id} is 'done' but no files were found in request.files.")
                 generation.error_message = "Callback reported 'done' but no files received."

            # --- Завершение обработки статуса 'done' --- 
            generation.updated_at = datetime.utcnow()
            db.session.commit()
            generation_update_payload['status'] = GenerationStatus.COMPLETED.value
            generation_update_payload['moderation_status'] = ModerationStatus.PENDING_MODERATION.value
            generation_update_payload['generated_files'] = saved_files_info
            
            try:
                 socketio = current_app.extensions['socketio']
                 socketio.emit('generation_update', generation_update_payload)
                 logger.info(f"Sent COMPLETED WebSocket update for {generation_id}")
            except Exception as ws_err:
                 logger.error(f"Failed to send COMPLETED WebSocket update for {generation_id}: {ws_err}")
                 
            return True, "Callback processed, generation completed."

        elif status_str == 'failed':
            generation.status = GenerationStatus.FAILED
            generation.error_message = str(error_info) if error_info else "Generation failed without specific error message."
            generation.updated_at = datetime.utcnow()
            db.session.commit()
            generation_update_payload['status'] = GenerationStatus.FAILED.value
            generation_update_payload['error_message'] = generation.error_message
            
            try:
                 socketio = current_app.extensions['socketio']
                 socketio.emit('generation_update', generation_update_payload)
                 logger.info(f"Sent FAILED WebSocket update for {generation_id}")
            except Exception as ws_err:
                 logger.error(f"Failed to send FAILED WebSocket update for {generation_id}: {ws_err}")
                 
            return True, "Callback processed, generation failed."

        else:
            # Неизвестный статус или completed без файлов
            logger.warning(f"Callback for {generation_id} received with unhandled status '{status_str}' or missing files.")
            # Не меняем статус в БД, но сообщаем об успехе обработки callback
            # Возможно, стоит сохранить статус в error_message?
            generation_update_payload['status'] = GenerationStatus.FAILED.value
            generation_update_payload['error_message'] = generation.error_message
            
            try:
                socketio = current_app.extensions['socketio']
                socketio.emit('generation_update', generation_update_payload)
                logger.info(f"Sent FAILED (Callback Processing Error) WebSocket update for {generation_id}")
            except Exception as ws_err:
                logger.error(f"Failed to send FAILED (Callback Processing Error) WebSocket update for {generation_id}: {ws_err}")

            return True, f"Callback processed, but status '{status_str}' or missing files were not handled."

    except Exception as e:
        db.session.rollback()
        error_msg = f"Internal error processing callback for {generation_id}: {e}"
        logger.exception(error_msg) # Логируем с traceback
        # Попытаемся обновить статус в БД на FAILED
        try:
            generation.status = GenerationStatus.FAILED
            generation.error_message = f"Callback processing error: {e}"
            generation.updated_at = datetime.utcnow()
            db.session.commit()
            generation_update_payload['status'] = GenerationStatus.FAILED.value
            generation_update_payload['error_message'] = generation.error_message
            
            try:
                socketio = current_app.extensions['socketio']
                socketio.emit('generation_update', generation_update_payload)
                logger.info(f"Sent FAILED WebSocket update for {generation_id}")
            except Exception as ws_err:
                logger.error(f"Failed to send FAILED WebSocket update for {generation_id}: {ws_err}")
        except Exception as inner_e:
            logger.error(f"Failed to update generation status to FAILED after callback error: {inner_e}")
            db.session.rollback()

        return False, error_msg 