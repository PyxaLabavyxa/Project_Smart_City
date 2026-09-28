import asyncio

from chatbot.main import main
from app.database.runtime import loop_factory


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
