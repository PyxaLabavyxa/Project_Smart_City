import asyncio
from copy import deepcopy
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock

import pytest
from chatbot.max_client import MaxBot
from chatbot.services.house_chat_delivery import MaxRejected, check_permissions
from maxapi.types.errors import Error
from pydantic import ValidationError


def member(user_id=123, **changes):
    value = dict(
        user_id=user_id,
        first_name="Test",
        name="Test",
        is_bot=False,
        last_activity_time=1700000000000,
        last_access_time=1700000000000,
        join_time=1700000000000,
        is_owner=True,
        is_admin=True,
        permissions=[
            "read_all_messages",
            "pin_message",
            "write",
            "can_call",
            "edit",
            "delete",
            "edit_link",
            "view_stats",
        ],
    )
    return value | changes


async def client(payload, status=200):
    bot = MaxBot(token="test-token-never-sent")
    response = NS(status=status, ok=status < 400, json=AsyncMock(return_value=payload))
    bot.session = NS(request=AsyncMock(return_value=response), close=AsyncMock())
    return bot


def test_group_members_accept_current_max_permissions_without_mutating_response():
    async def run():
        payload = {"members": [member()]}
        original = deepcopy(payload)
        bot = await client(payload)
        try:
            result = await bot.get_chat_member(chat_id=-10, user_id=123)
            assert result.is_owner is True and result.is_admin is True
            assert "can_call" in result.permissions and "view_stats" in result.permissions
            assert payload == original
            assert bot.session.request.call_args.kwargs["params"]["user_ids"] == "123"
        finally:
            await bot.close_session()

    asyncio.run(run())


def test_member_selection_never_uses_a_different_returned_administrator():
    async def run():
        bot = await client({"members": [member(999, permissions=["write"])]})
        try:
            assert await bot.get_chat_member(chat_id=-10, user_id=123) is None
        finally:
            await bot.close_session()

    asyncio.run(run())


def test_bot_membership_accepts_new_permissions_and_keeps_required_checks():
    async def run():
        bot = await client(member(is_owner=False))
        try:
            await check_permissions(bot, -10)
            bot.session.request.return_value.json.return_value = member(
                is_owner=False, permissions=["can_call", "pin_message", "write"]
            )
            with pytest.raises(MaxRejected):
                await check_permissions(bot, -10)
        finally:
            await bot.close_session()

    asyncio.run(run())


@pytest.mark.parametrize("field,value", [("is_admin", "true"), ("is_owner", 1)])
def test_role_flags_stay_strict(field, value):
    async def run():
        bot = await client(member(**{field: value}))
        try:
            with pytest.raises(ValidationError):
                await bot.get_me_from_chat(chat_id=-10)
        finally:
            await bot.close_session()

    asyncio.run(run())


def test_http_errors_are_preserved_without_granting_access():
    async def run():
        bot = await client({"code": "access.denied", "message": "Denied"}, status=403)
        try:
            assert isinstance(await bot.get_chat_member(chat_id=-10, user_id=123), Error)
            with pytest.raises(MaxRejected):
                await check_permissions(bot, -10)
        finally:
            await bot.close_session()

    asyncio.run(run())


def test_polling_skips_only_unused_permission_change_event_and_keeps_marker():
    async def run():
        message = {"update_type": "message_created", "timestamp": 1}
        removed = {"update_type": "bot_removed", "timestamp": 2}
        future = {"update_type": "future_update", "timestamp": 3}
        payload = {
            "updates": [
                dict(update_type="bot_admin_permissions_changed"),
                message,
                removed,
                future,
            ],
            "marker": 987,
        }
        bot = await client(payload)
        try:
            result = await bot.get_updates()
            assert result["updates"] == [message, removed, future]
            assert result["marker"] == 987
        finally:
            await bot.close_session()

    asyncio.run(run())
