import json
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from smart_city_api.core.config import Settings
from smart_city_api.main import create_app


def test_exported_openapi_matches_implemented_routes():
    contract = json.loads((Path(__file__).resolve().parents[1] / "openapi.json").read_text("utf-8"))
    app = create_app(Settings(_env_file=None, database_url=None))
    assert contract == app.openapi()
    yaml_contract = yaml.safe_load(
        (Path(__file__).resolve().parents[1] / "openapi.yaml").read_text("utf-8")
    )
    assert yaml_contract == contract
    assert contract["openapi"].startswith(("3.0.", "3.1."))


def test_swagger_loads_api_schema_without_database_or_authentication():
    with TestClient(create_app(Settings(_env_file=None, database_url=None))) as client:
        response = client.get("/api/docs")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert "SwaggerUIBundle" in response.text
        assert "url: '/api/openapi.json'" in response.text
        assert '"filter": true' in response.text
        assert '"persistAuthorization": true' not in response.text
        assert (
            "oauth2RedirectUrl: window.location.origin + '/api/docs/oauth2-redirect'"
            in response.text
        )
        assert client.get("/api/docs/oauth2-redirect").status_code == 200

        schema_response = client.get("/api/openapi.json")
        assert schema_response.status_code == 200
        schema = schema_response.json()
        assert schema["components"]["securitySchemes"]["MAXLaunchData"] == {
            "type": "http",
            "scheme": "bearer",
        }
        assert {"MAXLaunchData": []} in schema["paths"]["/api/v1/me"]["get"]["security"]
        assert schema["components"]["securitySchemes"]["StaffSession"] == {
            "type": "http",
            "scheme": "bearer",
        }
        for path, operations in schema["paths"].items():
            if path.startswith("/api/v1/staff/") and path not in {
                "/api/v1/staff/auth/login",
                "/api/v1/staff/auth/token",
            }:
                for operation in operations.values():
                    assert operation["security"] == [{"StaffSession": []}]
        assert "security" not in schema["paths"]["/api/v1/staff/auth/token"]["post"]
        assert not {"/docs", "/redoc", "/openapi.json", "/api/docs"} & schema["paths"].keys()


def test_redoc_uses_the_same_api_schema():
    with TestClient(create_app(Settings(_env_file=None, database_url=None))) as client:
        response = client.get("/api/redoc")
        assert response.status_code == 200
        assert 'spec-url="/api/openapi.json"' in response.text


@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
def test_legacy_documentation_addresses_redirect(path):
    with TestClient(create_app(Settings(_env_file=None, database_url=None))) as client:
        response = client.get(path, follow_redirects=False)
        assert response.status_code == 307
        assert response.headers["location"] == "/api" + path
        assert client.get(path).status_code == 200
