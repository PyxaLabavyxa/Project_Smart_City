from maxapi.context import State, StatesGroup


class FSMReport(StatesGroup):
    waiting = State()
    confirm = State()
