from typing import Set

_seen: Set[str] = set()

def is_duplicate_request(key: str) -> bool:
    return key in _seen

def remember_request(key: str) -> None:
    _seen.add(key)



