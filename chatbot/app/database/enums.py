from enum import StrEnum, IntEnum


class IssueCategory(StrEnum):
    WATER = "water" # Водоснабжение
    HEATING = "heating" # Отопление
    ELECTRICITY = "electricity" # Электричество
    ELEVATOR = "elevator" # Лифт
    ENTRANCE = "entrance" # Подъезд
    YARD = "yard" # Двор
    GARBAGE = "garbage" # Мусор
    SECURITY = "security" # Безопасность
    OTHER = "other" # Другое


class IssuePriority(IntEnum):
    HIGH = 1
    MEDIUM = 2
    LOW = 3


class IssueStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
