"""
Центральная конфигурация логирования для проекта.
"""
import logging
import logging.config
from typing import Dict, Any


def setup_logging(debug: bool = False) -> None:
    """
    Настраивает логирование для всего проекта.
    
    Args:
        debug: Включить debug уровень логирования
    """
    log_level = logging.DEBUG if debug else logging.INFO
    
    config: Dict[str, Any] = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'standard': {
                'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
                'datefmt': '%Y-%m-%d %H:%M:%S'
            },
            'detailed': {
                'format': '%(asctime)s [%(levelname)s] %(name)s:%(lineno)d: %(message)s',
                'datefmt': '%Y-%m-%d %H:%M:%S'
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'level': log_level,
                'formatter': 'standard',
                'stream': 'ext://sys.stdout'
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': log_level,
                'formatter': 'detailed',
                'filename': 'app.log',
                'maxBytes': 10 * 1024 * 1024,  # 10MB
                'backupCount': 5
            }
        },
        'loggers': {
            # Основные логгеры приложения
            'backend': {
                'level': log_level,
                'handlers': ['console', 'file'],
                'propagate': False
            },
            'backend.features': {
                'level': log_level,
                'handlers': ['console', 'file'],
                'propagate': False
            },
            # Внешние библиотеки
            'sqlalchemy.engine': {
                'level': logging.WARNING,
                'handlers': ['console'],
                'propagate': False
            },
            'werkzeug': {
                'level': logging.WARNING,
                'handlers': ['console'],
                'propagate': False
            }
        },
        'root': {
            'level': log_level,
            'handlers': ['console']
        }
    }
    
    logging.config.dictConfig(config)


def get_logger(name: str) -> logging.Logger:
    """
    Получает логгер с правильной конфигурацией.
    
    Args:
        name: Имя логгера (обычно __name__)
        
    Returns:
        Настроенный логгер
    """
    return logging.getLogger(name)


# Константы для уровней логирования
class LogLevel:
    DEBUG = logging.DEBUG
    INFO = logging.INFO
    WARNING = logging.WARNING
    ERROR = logging.ERROR
    CRITICAL = logging.CRITICAL 