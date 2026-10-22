from maxapi.context import State, StatesGroup


class FSMReport(StatesGroup):
    waiting = State()
    confirm = State()
    choose_house = State()
    get_description = State()
    analyzing = State()
    choose_scope = State()
    choose_entrance = State()
    choose_floor = State()
    choose_category = State()
    submitting = State()


class FSMViewingReports(StatesGroup):
    viewing = State()
    choose_house = State()


class FSMRegistration(StatesGroup):
    name = State()
    entrance = State()
    apartment = State()
