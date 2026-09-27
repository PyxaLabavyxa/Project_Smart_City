from maxapi import Bot
from maxapi.types.command import BotCommand

from app.lexicon.lexicon import LEXICON_MAIN_MENU


async def set_main_menu(bot: Bot):
    commands = [
        BotCommand(name=name, description=description)
        for name, description in LEXICON_MAIN_MENU.items()
    ]

    await bot.set_my_commands(*commands)
