from maxapi.filters.middleware import BaseMiddleware


class PhotoMiddleware(BaseMiddleware):
    def __init__(self, storage):
        self.storage = storage

    async def __call__(self, handler, event_object, data):
        data["photo_storage"] = self.storage
        return await handler(event_object, data)
