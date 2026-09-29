from enum import StrEnum, IntEnum


class IssueCategory(StrEnum):
    WATER = "water"
    HEATING = "heating"
    ELECTRICITY = "electricity"
    ELEVATOR = "elevator"
    ENTRANCE = "entrance"
    YARD = "yard"
    GARBAGE = "garbage"
    SECURITY = "security"
    OTHER = "other"


class IssuePriority(IntEnum):
    HIGH = 1
    MEDIUM = 2
    LOW = 3


class IssueStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
