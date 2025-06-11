"""
Валидаторы для проверки входных данных.
"""
import re
from typing import Dict, List, Optional, Any, Tuple
from backend.constants import (
    SUPPORTED_IMAGE_EXTENSIONS, 
    MIN_PAGE_SIZE, 
    MAX_PAGE_SIZE,
    COLLECTION_ID_PATTERN
)


class ValidationError(Exception):
    """Исключение для ошибок валидации."""
    pass


class PaginationValidator:
    """Валидатор для параметров пагинации."""
    
    @staticmethod
    def validate_pagination(page: Any, per_page: Any) -> Tuple[int, int]:
        """
        Валидирует и нормализует параметры пагинации.
        
        Args:
            page: Номер страницы
            per_page: Количество элементов на странице
            
        Returns:
            Tuple[int, int]: Валидированные значения (page, per_page)
            
        Raises:
            ValidationError: При некорректных значениях
        """
        try:
            page_int = int(page) if page else 1
            per_page_int = int(per_page) if per_page else 100
        except (ValueError, TypeError):
            raise ValidationError("Page and per_page must be integers")
        
        if page_int < 1:
            page_int = 1
            
        if per_page_int < MIN_PAGE_SIZE:
            per_page_int = MIN_PAGE_SIZE
        elif per_page_int > MAX_PAGE_SIZE:
            per_page_int = MAX_PAGE_SIZE
            
        return page_int, per_page_int


class FileValidator:
    """Валидатор для файлов."""
    
    @staticmethod
    def validate_image_extension(filename: str) -> bool:
        """
        Проверяет, поддерживается ли расширение файла.
        
        Args:
            filename: Имя файла
            
        Returns:
            bool: True если расширение поддерживается
        """
        if not filename:
            return False
            
        _, ext = filename.lower().rsplit('.', 1) if '.' in filename else ('', '')
        return f'.{ext}' in SUPPORTED_IMAGE_EXTENSIONS
    
    @staticmethod
    def extract_collection_id_from_filename(filename: str) -> Optional[int]:
        """
        Извлекает ID коллекции из имени файла.
        
        Args:
            filename: Имя файла
            
        Returns:
            Optional[int]: ID коллекции или None
        """
        match = re.match(COLLECTION_ID_PATTERN, filename)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                return None
        return None


class ProjectValidator:
    """Валидатор для проектов."""
    
    @staticmethod
    def validate_project_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Валидирует данные проекта.
        
        Args:
            data: Данные проекта
            
        Returns:
            Dict[str, Any]: Валидированные данные
            
        Raises:
            ValidationError: При некорректных данных
        """
        if not data:
            raise ValidationError("No data provided")
            
        name = data.get('name', '').strip()
        if not name:
            raise ValidationError("Project name is required")
            
        validated_data = {
            'name': name,
            'path': data.get('path', ''),
            'base_generation_params_json': data.get('base_generation_params_json', {}),
            'base_positive_prompt': data.get('base_positive_prompt', ''),
            'base_negative_prompt': data.get('base_negative_prompt', ''),
            'default_width': int(data.get('default_width', 512)),
            'default_height': int(data.get('default_height', 512))
        }
        
        # Валидация размеров
        if validated_data['default_width'] <= 0 or validated_data['default_height'] <= 0:
            raise ValidationError("Width and height must be positive integers")
            
        return validated_data


class CollectionValidator:
    """Валидатор для коллекций."""
    
    @staticmethod
    def validate_collection_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Валидирует данные коллекции.
        
        Args:
            data: Данные коллекции
            
        Returns:
            Dict[str, Any]: Валидированные данные
            
        Raises:
            ValidationError: При некорректных данных
        """
        if not data:
            raise ValidationError("No data provided")
            
        # Проверка обязательных полей
        required_fields = ['id', 'name']
        missing_fields = []
        
        for field in required_fields:
            if field not in data or not data[field]:
                missing_fields.append(field)
                
        if missing_fields:
            raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")
        
        # Валидация ID
        try:
            collection_id = int(data['id'])
        except (ValueError, TypeError):
            raise ValidationError("ID must be an integer")
            
        validated_data = {
            'id': collection_id,
            'name': data['name'].strip(),
            'type': data.get('type') or None,  # Пустая строка -> None
            'collection_positive_prompt': data.get('collection_positive_prompt', ''),
            'collection_negative_prompt': data.get('collection_negative_prompt', ''),
            'comment': data.get('comment')
        }
        
        return validated_data


class GenerationValidator:
    """Валидатор для генераций."""
    
    @staticmethod
    def validate_generation_pairs(pairs: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """
        Валидирует пары project_id/collection_id для генерации.
        
        Args:
            pairs: Список пар для генерации
            
        Returns:
            List[Dict[str, str]]: Валидированные пары
            
        Raises:
            ValidationError: При некорректных данных
        """
        if not pairs or not isinstance(pairs, list):
            raise ValidationError("Pairs must be a non-empty list")
            
        validated_pairs = []
        
        for i, pair in enumerate(pairs):
            if not isinstance(pair, dict):
                raise ValidationError(f"Pair {i} must be a dictionary")
                
            project_id = pair.get('project_id', '').strip()
            collection_id = pair.get('collection_id', '').strip()
            
            if not project_id or not collection_id:
                raise ValidationError(f"Pair {i}: missing project_id or collection_id")
                
            validated_pairs.append({
                'project_id': project_id,
                'collection_id': collection_id
            })
            
        return validated_pairs
    
    @staticmethod
    def validate_select_cover_data(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Валидирует данные для выбора обложки.
        
        Args:
            data: Данные для выбора обложки
            
        Returns:
            Dict[str, Any]: Валидированные данные
            
        Raises:
            ValidationError: При некорректных данных
        """
        if not data:
            raise ValidationError("No data provided")
            
        required_fields = ['collection_id', 'project_id', 'generation_id']
        missing_fields = []
        
        for field in required_fields:
            if field not in data or not data[field]:
                missing_fields.append(field)
                
        if missing_fields:
            raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")
            
        validated_data = {
            'collection_id': str(data['collection_id']).strip(),
            'project_id': str(data['project_id']).strip(),
            'generation_id': str(data['generation_id']).strip(),
            'generated_file_id': data.get('generated_file_id')
        }
        
        return validated_data


def parse_project_ids(ids_str: Optional[str]) -> Optional[List[str]]:
    """
    Парсит строку с ID проектов.
    
    Args:
        ids_str: Строка с ID, разделенными запятыми
        
    Returns:
        Optional[List[str]]: Список ID или None
    """
    if not ids_str:
        return None
        
    ids_list = [pid.strip() for pid in ids_str.split(',') if pid.strip()]
    return ids_list if ids_list else None 