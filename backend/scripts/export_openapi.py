import json
from pathlib import Path

from smart_city_api.core.config import Settings
from smart_city_api.main import create_app


def main() -> None:
    app = create_app(Settings(_env_file=None, database_url=None))
    target = Path(__file__).resolve().parents[1] / "openapi.json"
    target.write_text(
        json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
