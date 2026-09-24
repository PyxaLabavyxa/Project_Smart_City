from maxapi.filters.middleware import BaseMiddleware


class AIMiddleware(BaseMiddleware):
    def __init__(self, report_model):
        self.report_model = report_model

    async def __call__(self, handler, event_object, data):
        data["report_model"] = self.report_model

        return await handler(event_object, data)
