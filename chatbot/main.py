import asyncio
from contextlib import suppress
from chatbot.services.message_notifications import run_message_notifications
from chatbot.services.staff_notifications import run_staff_notifications
from app.database.runtime import loop_factory

from maxapi import Dispatcher
from maxapi.types.errors import Error

from app.config_data.config import Config, load_config
from app.database.session import create_tables, engine
from chatbot.max_client import MaxBot
from chatbot.handlers import user_handlers, other_handlers, staff_messages, registration
from chatbot.keyboards.main_menu import set_main_menu
from app.ai.client import create_ai_client, create_report_model
from chatbot.middlewares.ai import AIMiddleware
from chatbot.middlewares.photos import PhotoMiddleware
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
        registration.router,
        staff_messages.router,
        other_handlers.router
    )

    notifications = None
    staff_notifications = None
    try:
        await create_tables()
        if registration.test_mode():
            from app.database.registration_demo import seed_registration_demo
            from app.database.session import session_factory
            async with session_factory.begin() as session:
                await seed_registration_demo(session)
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
        notifications = asyncio.create_task(run_message_notifications(bot))
        staff_notifications = asyncio.create_task(run_staff_notifications(bot))
        await dp.start_polling(bot)

    finally:
        for task in (notifications, staff_notifications):
            if task is not None:
                task.cancel()
        for task in (notifications, staff_notifications):
            if task is not None:
                with suppress(asyncio.CancelledError):
                    await task
        try:
            await bot.close_session()
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
