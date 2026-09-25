import asyncio

from maxapi import Dispatcher
from maxapi.types.errors import Error

from app.config_data.config import Config, load_config
from app.database.session import create_tables, engine
from app.integrations.max_client import MaxBot
from app.handlers import user_handlers, other_handlers
from app.keyboards.main_menu import set_main_menu
from app.ai.client import create_ai_client, create_report_model
from app.middlewares.ai import AIMiddleware
from app.middlewares.photos import PhotoMiddleware
from app.storage.photos import LocalPhotoStorage


async def main() -> None:
    config: Config = load_config()

    bot = MaxBot(token=config.max_bot.token)
    dp = Dispatcher()

    ai_client = create_ai_client(config.yandex_ai)
    report_model  = create_report_model(ai_client, config.yandex_ai)

    dp.middlewares.append(AIMiddleware(report_model))
    dp.middlewares.append(PhotoMiddleware(LocalPhotoStorage(config.storage.root)))

    dp.include_routers(
        user_handlers.router,
        other_handlers.router
    )

    try:
        await create_tables()
        # await set_main_menu(bot)

        subscriptions = await bot.get_subscriptions()

        if isinstance(subscriptions, Error):
            raise RuntimeError("Не удалось проверить webhook-подписки. См. ответ API выше.")

        if subscriptions.subscriptions:
            raise RuntimeError(
                "У бота есть webhook-подписка. Polling не запущен. "
                "Сначала согласуйте с командой переключение режима."
            )

        await bot.delete_webhook()
        await dp.start_polling(bot)

    finally:
        try:
            await bot.close_session()
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
