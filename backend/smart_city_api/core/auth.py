import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import parse_qsl


class InvalidLaunchData(ValueError):
    pass


def sign_session(max_id: int, token: str, expires: int) -> str:
    payload = f"{max_id}.{expires}.{secrets.token_hex(16)}"
    signature = hmac.new(
        token.encode(), f"dompulse-session:{payload}".encode(), "sha256"
    ).hexdigest()
    return f"{payload}.{signature}"


def validate_session(value: str, token: str) -> int:
    try:
        user, expires, nonce, signature = value.split(".")
        payload = f"{user}.{expires}.{nonce}"
        expected = hmac.new(
            token.encode(), f"dompulse-session:{payload}".encode(), "sha256"
        ).hexdigest()
        if not hmac.compare_digest(signature, expected) or int(expires) <= time.time():
            raise ValueError
        return int(user)
    except (ValueError, TypeError) as error:
        raise InvalidLaunchData("Invalid or expired session") from error


def validate_launch_data(raw: str, token: str, max_age: int, now: int | None = None) -> int:
    try:
        if not raw or len(raw) > 16384:
            raise ValueError
        pairs = parse_qsl(raw, keep_blank_values=True, strict_parsing=True, max_num_fields=32)
        values = dict(pairs)
        if len(values) != len(pairs):
            raise ValueError
        signature = values.pop("hash")
        message = "\n".join(f"{key}={values[key]}" for key in sorted(values))
        secret = hmac.digest(b"WebAppData", token.encode(), "sha256")
        expected = hmac.new(secret, message.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        current = int(time.time()) if now is None else now
        age = current - int(values["auth_date"])
        if age < -30 or age > max_age:
            raise ValueError
        user = json.loads(values["user"])
        user_id = user["id"]
        if type(user_id) is not int or not 0 < user_id < 2**63:
            raise ValueError
        return user_id
    except (KeyError, ValueError, TypeError, UnicodeError) as error:
        raise InvalidLaunchData("Invalid or expired MAX launch data") from error
