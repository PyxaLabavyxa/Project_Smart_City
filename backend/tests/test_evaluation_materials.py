import hashlib
import hmac
import json
import re
import time
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from uuid import uuid4

import yaml
from app.database.models import (
    Apartment,
    Base,
    CompanyHouse,
    House,
    ManagementCompany,
    Meter,
    StaffHouse,
    StaffUser,
    User,
    UserApartment,
    UtilityAccount,
)
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from smart_city_api.core.config import Settings
from smart_city_api.core.staff_auth import hash_password
from smart_city_api.main import create_app

ROOT = Path(__file__).resolve().parents[1]
TOKEN = "evaluation-isolated-test-token"
PASSWORD = "evaluation-local-only-2026"


def read_yaml(name):
    return yaml.safe_load((ROOT / name).read_text(encoding="utf-8"))


def read_json(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def render(value, variables):
    if isinstance(value, dict):
        return {key: render(item, variables) for key, item in value.items()}
    if isinstance(value, list):
        return [render(item, variables) for item in value]
    if not isinstance(value, str):
        return value
    full = re.fullmatch(r"\$\{(\w+)\}", value)
    if full:
        return variables[full[1]]
    return re.sub(r"\$\{(\w+)\}", lambda match: str(variables[match[1]]), value)


def test_materials_are_valid_and_match_documented_application_routes():
    config = read_yaml("DATA-API.yaml")
    contract = read_json("openapi.json")
    Draft202012Validator(read_json(config["schema_file"]), format_checker=FormatChecker()).validate(
        config
    )
    public_contract = read_json(config["openapi_json"])
    assert read_yaml(config["openapi"]) == public_contract
    assert public_contract == contract
    assert contract == create_app(Settings(_env_file=None, database_url=None)).openapi()
    assert config["team"] == read_json(config["test_data"])["team"] == "Облачный Код"
    assert config["base_url"] == "https://201.34.159.33/api/v1"
    assert len({check["id"] for check in config["checks"]}) == len(config["checks"])
    for check in config["checks"]:
        path = urlsplit(config["base_url"] + check["path"]).path
        operation = contract["paths"][path][check["method"].lower()]
        public_operation = public_contract["paths"][path][check["method"].lower()]
        assert set(check["expected"]["status_codes"]) <= {
            int(code) for code in public_operation["responses"] if code.isdigit()
        } or check["expected"]["status_codes"] == [401]
        expected_path_keys = {
            p["name"] for p in operation.get("parameters", []) if p["in"] == "path"
        }
        assert check["parameters"]["path"].keys() == expected_path_keys
        query_keys = {p["name"] for p in operation.get("parameters", []) if p["in"] == "query"}
        assert check["parameters"]["query"].keys() <= query_keys
        if check["expected"]["json_schema"] is not None:
            Draft202012Validator.check_schema(check["expected"]["json_schema"])
    accounts = read_json(config["test_accounts"])
    assert {row["role"] for row in accounts["accounts"]} == {"resident", "staff"}
    assert accounts["administrative_access_required"] is False
    assert accounts["public_credentials_included"] is False


def test_all_documented_functional_checks_with_synthetic_data(tmp_path):
    config = read_yaml("DATA-API.yaml")
    fixture = read_json(config["test_data"])["fixture"]
    path = tmp_path / "evaluation.db"
    engine = create_engine(f"sqlite:///{path}")
    Base.metadata.create_all(engine)
    today = date.today()
    period = today.strftime("%Y-%m")
    with Session(engine) as session:
        session.add_all(
            [
                ManagementCompany(**fixture["company"]),
                House(**fixture["house"]),
                User(**fixture["resident"]),
                StaffUser(
                    id=fixture["staff"]["id"],
                    login=fixture["staff"]["login"],
                    name=fixture["staff"]["name"],
                    password_hash=hash_password(PASSWORD),
                ),
            ]
        )
        session.flush()
        session.add_all([Apartment(**row) for row in fixture["apartments"]])
        session.add(
            CompanyHouse(house_id=fixture["house"]["id"], company_id=fixture["company"]["id"])
        )
        session.flush()
        session.add_all(
            [
                UserApartment(
                    user_id=fixture["resident"]["id"],
                    apartment_id=fixture["resident_apartment_id"],
                ),
                StaffHouse(staff_id=fixture["staff"]["id"], house_id=fixture["house"]["id"]),
                UtilityAccount(
                    id=1,
                    apartment_id=fixture["resident_apartment_id"],
                    number="EVALUATION-1",
                    area=Decimal("42.50"),
                    residents=1,
                    reading_period=period,
                    reading_open=today - timedelta(days=1),
                    reading_close=today + timedelta(days=1),
                ),
            ]
        )
        session.flush()
        session.add(Meter(account_id=1, **fixture["meter"]))
        session.commit()
    engine.dispose()
    values = {
        "auth_date": str(int(time.time())),
        "user": json.dumps({"id": fixture["resident"]["max_user_id"], "first_name": "Житель"}),
    }
    secret = hmac.digest(b"WebAppData", TOKEN.encode(), "sha256")
    values["hash"] = hmac.new(
        secret,
        "\n".join(f"{key}={values[key]}" for key in sorted(values)).encode(),
        hashlib.sha256,
    ).hexdigest()
    variables = {
        "SITE_ORIGIN": "http://testserver",
        "HOUSE_ID": fixture["house"]["id"],
        "COMPANY_ID": fixture["company"]["id"],
        "APARTMENT_ID": fixture["resident_apartment_id"],
        "RECIPIENT_APARTMENT_ID": fixture["apartments"][1]["id"],
        "METER_ID": fixture["meter"]["id"],
        "READING_PERIOD": period,
        "MAX_INIT_DATA": urlencode(values),
        "STAFF_LOGIN": fixture["staff"]["login"],
        "STAFF_PASSWORD": PASSWORD,
    }
    for name in (
        "ISSUE_REQUEST_ID",
        "STATUS_REQUEST_ID",
        "STAFF_MESSAGE_REQUEST_ID",
        "MESSAGE_REQUEST_ID",
    ):
        variables[name] = str(uuid4())
    settings = Settings(
        _env_file=None,
        database_url=SecretStr(f"sqlite+aiosqlite:///{path}"),
        bot_token=SecretStr(TOKEN),
        session_cookie_secure=False,
        cors_origins=[variables["SITE_ORIGIN"]],
        onboarding_test_mode=False,
        media_root=tmp_path / "media",
    )
    with TestClient(create_app(settings)) as client:
        for check in config["checks"]:
            params = render(check["parameters"], variables)
            url = "/api/v1" + check["path"].format(**params["path"])
            response = client.request(
                check["method"],
                url,
                params=params["query"],
                headers=params["headers"],
                json=params["body"],
            )
            expected = check["expected"]
            assert response.status_code in expected["status_codes"], (check["id"], response.text)
            if expected["content_type"] is None:
                assert response.content == b""
            else:
                assert response.headers["content-type"].startswith(expected["content_type"])
                Draft202012Validator(expected["json_schema"]).validate(response.json())
            for name, field in check.get("capture", {}).items():
                variables[name] = response.json()[field]
        assert client.get("/api/v1/staff/me").status_code == 401
        issue = client.get(
            f"/api/v1/issues/{variables['ISSUE_ID']}",
            headers={"Authorization": "Bearer " + variables["MAX_INIT_DATA"]},
        ).json()
        assert issue["status"] == "in_progress"
        assert {event["status"] for event in issue["history"]} == {"new", "in_progress"}
