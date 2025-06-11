"""
Константы приложения.
"""

# Пагинация
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 500
MIN_PAGE_SIZE = 1

# Файловые расширения
SUPPORTED_IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')

# Таймауты
REQUEST_TIMEOUT_SECONDS = 15
SCHEDULER_REQUEST_TIMEOUT = 15

# Размеры файлов
MAX_FILE_SIZE_MB = 50
LOG_FILE_MAX_SIZE_MB = 10
LOG_BACKUP_COUNT = 5

# Сетевые настройки
DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5001

# База данных
DEFAULT_DATABASE_URL = 'sqlite:///app.db'

# Генерация изображений
DEFAULT_IMAGE_WIDTH = 512
DEFAULT_IMAGE_HEIGHT = 512

# Статусы
class GenerationStatusValues:
    PENDING = "pending"
    QUEUED = "queued"
    COMPLETED = "completed"
    FAILED = "failed"

class ModerationStatusValues:
    PENDING_MODERATION = "pending_moderation"
    APPROVED = "approved"
    REJECTED = "rejected"

# Фильтры
class AdvancedFilters:
    EMPTY_POSITIVE = 'empty_positive'
    HAS_COMMENT = 'has_comment'
    NO_DYNAMIC = 'no_dynamic'

class GenerationStatusFilters:
    NOT_SELECTED = 'not_selected'
    NOT_GENERATED = 'not_generated'

# Сортировка
class SortFields:
    NAME = 'name'
    CREATED_AT = 'created_at'
    TYPE = 'type'
    LAST_GENERATION_AT = 'last_generation_at'

class SortOrders:
    ASC = 'asc'
    ASCENDING = 'ascending'
    DESC = 'desc'
    DESCENDING = 'descending'

# Статусы ячеек грида
class CellStatus:
    NOT_GENERATED = 'not_generated'
    SELECTED = 'selected'
    GENERATED_NOT_SELECTED = 'generated_not_selected'
    QUEUED = 'queued'
    ERROR = 'error'
    UNKNOWN = 'unknown'

# Regex паттерны
COLLECTION_ID_PATTERN = r"^(\d+)"

# HTTP статусы
class HTTPStatus:
    OK = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    CONFLICT = 409
    UNSUPPORTED_MEDIA_TYPE = 415
    INTERNAL_SERVER_ERROR = 500 