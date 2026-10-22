"""Match a recipient against one authorized apartment at a time."""

import re

APARTMENT = re.compile(r"\b(?:кв(?:артира)?|kv|apt)\.?\s*[№#:]?\s*(\d+)\b", re.IGNORECASE)
ADDRESS_LABELS = {"г", "город", "ул", "улица", "д", "дом", "кв", "квартира", "kv", "apt"}


def words(value: str) -> list[str]:
    value = value.casefold().replace("ё", "е")
    value = re.sub(r"(?<=[^\W\d_])(?=\d)|(?<=\d)(?=[^\W\d_])", " ", value)
    return re.findall(r"[^\W_]+", value)


def matches_resident(query: str, name: str, max_id: int, apartments: list[tuple[str, int]]) -> bool:
    query = query.casefold().strip().replace("ё", "е")
    if not query:
        return True
    if query in name.casefold().replace("ё", "е") or (query.isdecimal() and query in str(max_id)):
        return True
    requested = {int(value) for value in APARTMENT.findall(query)}
    if len(requested) > 1:
        return False
    terms = [word for word in words(APARTMENT.sub(" ", query)) if word not in ADDRESS_LABELS]
    numeric_only = not requested and query.isdecimal()
    name_words = words(name)
    for address, apartment in apartments:
        if requested and apartment not in requested:
            continue
        address_words = words(address)
        if all(
            term in address_words or (numeric_only and term == str(apartment))
            if term.isdecimal()
            else any(term in word for word in [*address_words, *name_words])
            for term in terms
        ):
            return True
    return False
