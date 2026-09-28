from aiohttp import TCPConnector
from maxapi import Bot
from maxapi.client.default import DefaultConnectionProperties
from maxapi.enums.api_path import ApiPath
from maxapi.enums.http_method import HTTPMethod

from app.integrations.tls import create_ssl_context


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

    async def get_updates(self):
        params = {"limit": 100}
        if self.marker_updates is not None:
            params["marker"] = self.marker_updates
        return await self.request(
            method=HTTPMethod.GET,
            path=ApiPath.UPDATES,
            params=params,
            is_return_raw=True,
        )
