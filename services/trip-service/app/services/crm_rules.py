"""
The pipeline rules, kept apart from the HTTP and database code so they can be read (and tested) on their own.

An inquiry moves through New → Contacted → Planning → Quoted → Confirmed. It can step back one stage when
the customer changes their mind, and it can be closed as lost from any open stage or from Confirmed (a
booking that falls through). A closed inquiry can only be reopened, as New.
"""

from typing import Dict, FrozenSet, List

STAGE_LABELS: Dict[str, str] = {
    "new": "New",
    "contacted": "Contacted",
    "planning": "Planning",
    "quoted": "Quoted",
    "confirmed": "Confirmed",
    "closed_lost": "Closed / Lost",
}

TRANSITIONS: Dict[str, FrozenSet[str]] = {
    "new": frozenset({"contacted", "planning", "closed_lost"}),
    "contacted": frozenset({"new", "planning", "quoted", "closed_lost"}),
    "planning": frozenset({"contacted", "quoted", "closed_lost"}),
    "quoted": frozenset({"planning", "confirmed", "closed_lost"}),
    "confirmed": frozenset({"quoted", "closed_lost"}),
    "closed_lost": frozenset({"new"}),
}

_ORDER = list(STAGE_LABELS)


def allowed_next(stage: str) -> List[str]:
    """The stages an inquiry in `stage` may move to, in pipeline order."""
    return [s for s in _ORDER if s in TRANSITIONS.get(stage, frozenset())]


def can_move(current: str, target: str) -> bool:
    return target in TRANSITIONS.get(current, frozenset())
