from yandex_ai_studio_sdk import AsyncAIStudio

from app.ai.schemas import ReportAnalysis
from app.config_data.config import YandexAIConfig


def create_ai_client(config: YandexAIConfig) -> AsyncAIStudio:
    return AsyncAIStudio(
        folder_id=config.folder_id,
        auth=config.api_key
    )


def create_report_model(client: AsyncAIStudio, config: YandexAIConfig):
    model = client.models.completions(
        f"gpt://{config.folder_id}/aliceai-llm"
    )

    return model.configure(
        temperature=0.1,
        max_tokens=500,
        response_format=ReportAnalysis
    )
