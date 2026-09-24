from app.ai.prompts import REPORT_ANALYSIS_PROMPT
from app.ai.schemas import ReportAnalysis


async def generate_issue_data(description: str, model) -> ReportAnalysis:
    result = await model.run(
        [
            {
                "role": "system",
                "text": REPORT_ANALYSIS_PROMPT
            },
            {
                "role": "user",
                "text": description
            }
        ],
        timeout=30
    )

    return ReportAnalysis.model_validate_json(result[0].text)
