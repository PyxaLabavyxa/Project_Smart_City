import argparse
import json
from pathlib import Path
from urllib.request import urlopen

import yaml

from smart_city_api.core.config import Settings
from smart_city_api.main import create_app


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public-url")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.public_url:
        if not args.public_url.startswith("https://"):
            parser.error("Public OpenAPI requires an HTTPS URL")
        with urlopen(args.public_url, timeout=30) as response:
            contract = json.load(response)
        if not contract.get("openapi", "").startswith(("3.0.", "3.1.")):
            parser.error("The server did not return an OpenAPI 3.0 or 3.1 document")
        root = root / "evaluation"
        root.mkdir(exist_ok=True)
    else:
        contract = create_app(Settings(_env_file=None, database_url=None)).openapi()
    (root / "openapi.json").write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (root / "openapi.yaml").write_text(
        yaml.safe_dump(contract, allow_unicode=True, sort_keys=False), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
