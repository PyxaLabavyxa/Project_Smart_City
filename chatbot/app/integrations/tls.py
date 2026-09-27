import os
from pathlib import Path
import ssl

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CERT_NAMES = (
    "russian_trusted_root_ca_pem.crt",
    "russian_trusted_sub_ca_pem.crt",
)


def create_ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    bundle = os.environ.get("MAX_CA_BUNDLE", "").strip()
    if bundle:
        path = Path(bundle).expanduser()
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        context.load_verify_locations(cafile=str(path))
    else:
        for name in CERT_NAMES:
            path = PROJECT_ROOT / "certs" / name
            if path.is_file():
                context.load_verify_locations(cafile=str(path))
    return context
