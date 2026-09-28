from ipaddress import ip_address

from fastapi import Request

LOCAL_USER_MAX_ID = -1
LOCAL_COOKIE = "dompulse_local_session"


def local_login_allowed(request: Request) -> bool:
    settings = request.app.state.settings
    try:
        client = ip_address(request.client.host) if request.client else None
    except ValueError:
        return False
    return bool(
        settings.local_login_enabled
        and settings.local_session_secret
        and client
        and any(client in network for network in settings.local_login_networks)
        and request.url.hostname in {"localhost", "127.0.0.1", "::1"}
    )
