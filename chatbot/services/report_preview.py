from app.ai.schemas import ReportAnalysis
from app.services.report_locations import ReportHome, ReportPlace
from chatbot.lexicon.lexicon import (
    LEXICON,
    REPORT_AUDIENCE_LABELS,
    REPORT_CATEGORY_LABELS,
    REPORT_PRIORITY_LABELS,
    REPORT_ZONE_LABELS,
)


def report_preview(
    home: ReportHome, analysis: ReportAnalysis, place: ReportPlace, photos: int
) -> str:
    if place.scope == "apartment":
        label = f"Квартира {home.number} · подъезд {home.entrance} · этаж {home.floor}"
    elif place.scope == "courtyard":
        label = "Двор"
    else:
        zone = (
            "Холл"
            if place.zone == "corridor" and place.floor == 1
            else REPORT_ZONE_LABELS[place.zone]
        )
        label = f"Подъезд {place.entrance} · этаж {place.floor} · {zone}"
    return LEXICON["report_preview"].format(
        title=analysis.title,
        address=home.address,
        place=label,
        category=REPORT_CATEGORY_LABELS[analysis.category],
        priority=REPORT_PRIORITY_LABELS[analysis.priority],
        photos=photos,
        audience=REPORT_AUDIENCE_LABELS[place.scope].format(entrance=place.entrance),
    )
