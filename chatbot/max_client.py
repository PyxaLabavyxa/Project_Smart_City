from aiohttp import TCPConnector
from app.integrations.tls import create_ssl_context
from maxapi import Bot
from maxapi.client.default import DefaultConnectionProperties
from maxapi.enums.api_path import ApiPath
from maxapi.enums.http_method import HTTPMethod
from maxapi.types.chats import ChatMember
from maxapi.types.errors import Error
from pydantic import BaseModel, StrictBool, StrictInt, StrictStr


class GroupMember(ChatMember):
    """Keep role checks strict while accepting MAX's expanded permission names."""

    user_id: StrictInt
    is_owner: StrictBool
    is_admin: StrictBool
    permissions: list[StrictStr] | None = None


class GroupMembers(BaseModel):
    members: list[GroupMember]


class MaxBot(Bot):
    API_URL = "https://platform-api2.max.ru"

    def __init__(self, token: str) -> None:
        super().__init__(
            token=token,
            default_connection=DefaultConnectionProperties(
                headers={"Authorization": token},
                connector=TCPConnector(ssl=create_ssl_context()),
            ),
        )

        self.params = {}

    async def get_chat_member(self, chat_id: int, user_id: int):
        result = await self.request(
            method=HTTPMethod.GET,
            path=f"/chats/{chat_id}/members",
            model=GroupMembers,
            params={"user_ids": str(user_id)},
        )
        if isinstance(result, Error):
            return result
        return next(
            (member for member in result.members if member.user_id == user_id), None
        )

    async def get_me_from_chat(self, chat_id: int):
        return await self.request(
            method=HTTPMethod.GET,
            path=f"/chats/{chat_id}/members/me",
            model=GroupMember,
            params=self.params.copy(),
        )

    async def get_updates(self):
        params = {"limit": 100}
        if self.marker_updates is not None:
            params["marker"] = self.marker_updates
        result = await self.request(
            method=HTTPMethod.GET,
            path=ApiPath.UPDATES,
            params=params,
            is_return_raw=True,
        )
        if isinstance(result, dict) and isinstance(result.get("updates"), list):
            # This SDK cannot parse this informational event. Rights are checked
            # afresh before connecting, pinning, or publishing an announcement.
            result = {
                **result,
                "updates": [
                    update
                    for update in result["updates"]
                    if update.get("update_type") != "bot_admin_permissions_changed"
                ],
            }
        return result
