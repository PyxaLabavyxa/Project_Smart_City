from enum import IntEnum, StrEnum


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


class IssueScope(StrEnum):
    APARTMENT = "apartment"
    ENTRANCE = "entrance"
    COURTYARD = "courtyard"
    UNKNOWN = "unknown"


ISSUE_CATEGORIES_BY_SCOPE = {
    IssueScope.COURTYARD: {
        IssueCategory.YARD,
        IssueCategory.GARBAGE,
        IssueCategory.ELECTRICITY,
        IssueCategory.WATER,
        IssueCategory.SECURITY,
        IssueCategory.OTHER,
    },
    IssueScope.ENTRANCE: set(IssueCategory) - {IssueCategory.YARD},
    IssueScope.APARTMENT: {
        IssueCategory.WATER,
        IssueCategory.HEATING,
        IssueCategory.ELECTRICITY,
        IssueCategory.SECURITY,
        IssueCategory.OTHER,
    },
}


class IssueStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
