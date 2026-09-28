import asyncio
import sys


def loop_factory():
    """Psycopg requires a selector event loop on Windows."""
    return asyncio.SelectorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()
