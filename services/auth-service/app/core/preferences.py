"""Allowed values for profile preferences. The frontend mirrors these lists."""

from zoneinfo import available_timezones

CURRENCIES = (
    "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "PKR",
    "AED", "SAR", "SGD", "HKD", "NZD", "SEK", "NOK", "DKK", "MXN", "BRL",
    "ZAR", "TRY", "KRW", "THB",
)

TRAVEL_INTERESTS = (
    "adventure", "culture", "food", "beach", "nature", "city",
    "relaxation", "nightlife", "wellness", "road_trips",
)

TRAVEL_PACES = ("relaxed", "balanced", "packed")
BUDGET_STYLES = ("budget", "mid_range", "luxury")
THEMES = ("dark", "light")

MAX_INTERESTS = len(TRAVEL_INTERESTS)

_TIMEZONES = None


def is_valid_timezone(name: str) -> bool:
    global _TIMEZONES
    if _TIMEZONES is None:
        _TIMEZONES = available_timezones() | {"UTC"}
    return name in _TIMEZONES
