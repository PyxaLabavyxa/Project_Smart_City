from maxapi.context import State, StatesGroup


class FSMReport(StatesGroup):
    waiting = State()
    confirm = State()
    choose_house = State()
    get_description = State()


class FSMViewingReports(StatesGroup):
    viewing = State()
    choose_house = State()


class FSMStaffReply(StatesGroup):
    waiting = State()


class FSMRegistration(StatesGroup):
    name = State()
    apartment = State()
