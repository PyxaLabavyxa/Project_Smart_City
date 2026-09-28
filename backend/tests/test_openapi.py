import json
from pathlib import Path

from smart_city_api.core.config import Settings
from smart_city_api.main import create_app


def test_exported_openapi_matches_implemented_routes():
    contract = json.loads((Path(__file__).resolve().parents[1] / "openapi.json").read_text("utf-8"))
    app = create_app(Settings(_env_file=None, database_url=None))
    assert contract == app.openapi()
    assert contract["openapi"].startswith(("3.0.", "3.1."))
