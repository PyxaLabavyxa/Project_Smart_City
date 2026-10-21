import pytest
from smart_city_api.services.resident_search import matches_resident

APARTMENTS = [("г. Казань, ул. Солнечная, 1", 9), ("г. Казань, ул. Солнечная, 2", 15)]


@pytest.mark.parametrize(
    "query",
    [
        "",
        "Константин",
        "констан",
        "Иванов",
        "975",
        "296975945",
        "кв 9",
        "кв. №9",
        "квартира 9",
        "KV9",
        "apt 9",
        "Солнечная, KV 9",
        "солнечная 1 кв9",
        "СОЛНЕЧНАЯ, дом 1, квартира 9",
        "Солнечная 2 кв 15",
        "9",
    ],
)
def test_name_id_and_authorized_address_queries(query):
    assert matches_resident(query, "Константин Иванов", 296975945, APARTMENTS)


@pytest.mark.parametrize(
    "query",
    [
        "Солнечная 2 кв 9",
        "Солнечная 1 кв 15",
        "кв 19",
        "кв 99",
        "Садовая кв 9",
        "Солнечная 19",
        "дом 9 кв 9",
        "неизвестный",
        "кв 9 кв 15",
    ],
)
def test_query_does_not_mix_apartments_or_match_partial_apartment_numbers(query):
    assert not matches_resident(query, "Константин Иванов", 296975945, APARTMENTS)


def test_every_resident_apartment_can_match_and_short_street_names_work():
    assert matches_resident("солнеч кв15", "Иванов", 111, APARTMENTS)
    assert not matches_resident("кв 9", "Иванов", 111, [("Солнечная, 1", 19)])
