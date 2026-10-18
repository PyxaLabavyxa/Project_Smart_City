import asyncio
import logging

from chatbot.main import main
from app.database.runtime import loop_factory


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main(), loop_factory=loop_factory)
