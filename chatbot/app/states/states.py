from maxapi.context import State, StatesGroup


class FSMReport(StatesGroup):
    waiting = State()
    confirm = State()
    choose_house = State()
    get_description = State()


class FSMViewingReports(StatesGroup):
    viewing = State()
    choose_house = State()
