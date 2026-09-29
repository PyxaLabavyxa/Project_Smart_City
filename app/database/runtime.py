import asyncio
import sys


def loop_factory():
    return asyncio.SelectorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()
