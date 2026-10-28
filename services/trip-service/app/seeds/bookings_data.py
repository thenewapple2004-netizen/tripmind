"""
Sample bookings for the trips created by `trips_data`, so the Bookings workspace has realistic
reservations to browse: all four types, all four statuses, several currencies, and links to the
sample documents from `documents_data`.

Days are offsets from the trip's first day (0 = the day it starts). Every booking here must pass
`validate_booking`; the tests check that.

Each entry: (trip key, booking key, fields..., documents)
"""

from typing import Any, Dict, List, Optional, Sequence


def flight(
    key, title, provider, confirmation, number, src, dst, *, day=0, depart="08:00", arrive="10:30",
    arrive_day=None, cost, currency="USD", status="confirmed", seat=None, cabin="economy", docs=(), notes=None,
    policy=None, free_until=None,
) -> Dict[str, Any]:
    details = {"flight_number": number, "departure_airport": src, "arrival_airport": dst, "cabin_class": cabin}
    if seat:
        details["seat"] = seat
    return dict(key=key, type="flight", title=title, provider=provider, confirmation_number=confirmation, status=status,
                start_day=day, start_time=depart, end_day=day if arrive_day is None else arrive_day, end_time=arrive,
                location=f"{src} to {dst}", total_cost=cost, currency=currency, details=details, docs=list(docs),
                notes=notes, cancellation_policy=policy, free_cancellation_day=free_until)


def hotel(
    key, title, provider, confirmation, *, check_in=0, nights, address=None, guests=2, room=None, cost, currency="USD",
    status="confirmed", location=None, docs=(), notes=None, policy=None, free_until=None,
) -> Dict[str, Any]:
    details: Dict[str, Any] = {"guests": guests}
    if address:
        details["address"] = address
    if room:
        details["room_type"] = room
    return dict(key=key, type="hotel", title=title, provider=provider, confirmation_number=confirmation, status=status,
                start_day=check_in, start_time="14:00", end_day=check_in + nights, end_time="11:00", location=location,
                total_cost=cost, currency=currency, details=details, docs=list(docs), notes=notes,
                cancellation_policy=policy, free_cancellation_day=free_until)


def transfer(
    key, title, provider, mode, pickup, dropoff, *, day=0, at="09:00", until=None, cost, currency="USD",
    status="confirmed", confirmation=None, docs=(), notes=None, vehicle=None,
) -> Dict[str, Any]:
    details = {"mode": mode, "pickup_location": pickup, "dropoff_location": dropoff}
    if vehicle:
        details["vehicle"] = vehicle
    return dict(key=key, type="transportation", title=title, provider=provider, confirmation_number=confirmation,
                status=status, start_day=day, start_time=at, end_day=day if until else None, end_time=until,
                location=pickup, total_cost=cost, currency=currency, details=details, docs=list(docs), notes=notes,
                cancellation_policy=None, free_cancellation_day=None)


def activity(
    key, title, provider, *, day, at, location, cost, currency="USD", status="confirmed", confirmation=None,
    participants=2, meeting=None, docs=(), notes=None, policy=None, free_until=None,
) -> Dict[str, Any]:
    details: Dict[str, Any] = {"participants": participants}
    if meeting:
        details["meeting_point"] = meeting
    return dict(key=key, type="activity", title=title, provider=provider, confirmation_number=confirmation,
                status=status, start_day=day, start_time=at, end_day=None, end_time=None, location=location,
                total_cost=cost, currency=currency, details=details, docs=list(docs), notes=notes,
                cancellation_policy=policy, free_cancellation_day=free_until)


# trip key -> bookings
BOOKINGS: Dict[str, List[Dict[str, Any]]] = {
    # ── completed trips ──
    "hunza-cultural-retreat": [
        hotel("guesthouse", "Karimabad guesthouse", "Hunza Heights Guesthouse", "HH-20417", nights=7, address="Karimabad, Hunza", room="Double, mountain view", cost=245, status="completed", location="Karimabad", docs=["Guesthouse booking Karimabad (sample).pdf"]),
        transfer("jeep", "Jeep: Islamabad to Hunza", "KKH Travels", "car", "Islamabad", "Karimabad", day=0, at="05:00", until="19:00", cost=190, status="completed", vehicle="Toyota Land Cruiser", confirmation="KKH-882"),
    ],
    "skardu-shangrila": [
        flight("flight", "Islamabad to Skardu", "PIA", "PK-4X9Q2", "PK451", "ISB", "KDU", depart="07:30", arrive="08:55", cost=180, status="completed", seat="14A", docs=["Flight ticket ISB-SKZ (sample).png"]),
        hotel("hotel", "Hotel in Skardu", "Skardu Serenity", "SS-7731", nights=6, address="Airport Road, Skardu", cost=330, status="completed", location="Skardu", docs=["Hotel confirmation Skardu (sample).pdf"]),
    ],
    "kyoto-cherry-blossom": [
        flight("outbound", "Islamabad to Osaka (via Doha)", "Qatar Airways", "QR-M3K7LP", "QR633", "ISB", "DOH", depart="03:10", arrive="05:00", cost=1150, status="completed", seat="32K", cabin="economy", docs=["Flight ticket (sample).png"], notes="Connects to QR806 to Osaka."),
        hotel("ryokan", "Ryokan near Gion", "Gion Kikunoi Ryokan", "GK-55120", nights=8, address="Higashiyama-ku, Kyoto", room="Tatami suite", cost=1050, status="completed", location="Gion, Kyoto"),
        activity("tea", "Tea ceremony in Gion", "Camellia Tea House", day=5, at="15:00", location="Gion, Kyoto", cost=45, status="completed", meeting="Tea house entrance", participants=2),
    ],
    "istanbul-bazaar-break": [
        flight("flight", "Islamabad to Istanbul", "Turkish Airlines", "TK-7YU4HD", "TK711", "ISB", "IST", depart="04:20", arrive="08:45", cost=520, currency="EUR", status="completed", seat="21C", docs=["Boarding pass (sample).png"]),
        hotel("hotel", "Boutique hotel, Sultanahmet", "Hotel Sultanahmet Palace", "HSP-1128", nights=5, address="Sultanahmet, Fatih", cost=410, currency="EUR", status="completed", location="Sultanahmet"),
    ],
    "lahore-food-heritage": [
        hotel("hotel", "Heritage hotel in the Walled City", "Haveli Barood Khana", "HBK-3306", nights=2, address="Fort Road, Lahore", room="Heritage room", cost=120, status="completed", location="Walled City, Lahore"),
    ],
    # ── under way ──
    "neelum-valley-autumn": [
        hotel("hut", "Arang Kel hut", "Arang Kel Huts", "AK-0912", nights=3, check_in=2, address="Arang Kel", cost=120, location="Arang Kel", notes="Cash on arrival for meals."),
        transfer("suv", "SUV, Muzaffarabad to Keran", "Neelum Tours", "car", "Muzaffarabad", "Keran", day=0, at="08:00", until="14:00", cost=210, confirmation="NT-5521"),
    ],
    "astore-rama-meadows": [
        transfer("jeep", "Jeep to Rama Meadows", "Astore Jeep Club", "car", "Astore", "Rama Meadows", day=1, at="09:00", until="12:00", cost=220, vehicle="Suzuki Jimny"),
        hotel("camp", "Camping at Rama", "Rama Camp", "RC-204", nights=2, check_in=1, cost=135, status="pending", location="Rama Meadows"),
    ],
    # ── upcoming ──
    "dubai-desert-getaway": [
        flight("out", "Islamabad to Dubai", "Emirates", "EK-QW83N7", "EK615", "ISB", "DXB", depart="08:15", arrive="10:45", cost=1550, currency="AED", status="confirmed", seat="18F", cabin="economy", docs=["Flight booking (sample).pdf"], policy="Changes allowed up to 24 hours before departure for a fee.", free_until=-2),
        hotel("hotel", "Downtown hotel", "Address Downtown", "AD-660421", nights=3, address="Sheikh Mohammed bin Rashid Blvd", room="Deluxe king", cost=1430, currency="AED", status="confirmed", location="Downtown Dubai", docs=["Hotel voucher (sample).pdf"], policy="Free cancellation until 48 hours before check-in.", free_until=-2),
        activity("safari", "Desert safari with dinner", "Platinum Heritage", day=1, at="15:30", location="Lahbab Desert", cost=220, currency="AED", status="confirmed", confirmation="PH-90210", meeting="Hotel lobby", participants=2, policy="Non-refundable within 24 hours.", free_until=0),
        transfer("airport", "Airport transfer", "Careem", "taxi", "DXB Terminal 1", "Address Downtown", day=0, at="11:30", cost=95, currency="AED", status="pending"),
    ],
    "deosai-plains-safari": [
        hotel("camp", "Camping at Sheosar Lake", "Deosai Camps", "DC-118", nights=3, address="Sheosar Lake", guests=2, cost=110, status="pending", location="Deosai Plains"),
        transfer("jeep", "Jeep and driver, 4 days", "Skardu Jeep Rentals", "car", "Skardu", "Deosai Plains", day=0, at="07:00", until="13:00", cost=200, status="pending"),
    ],
    "khunjerab-pass-road-trip": [
        hotel("sost", "Guesthouse in Sost", "Khunjerab View Inn", "KV-4410", nights=2, address="Sost, Gojal", cost=90, location="Sost", status="confirmed"),
        transfer("car", "Car with driver", "Gojal Cabs", "car", "Passu", "Khunjerab Pass", day=1, at="06:30", until="16:00", cost=150, status="confirmed", confirmation="GC-771"),
    ],
    "k2-concordia-trek": [
        flight("fly", "Islamabad to Skardu", "PIA", "PK-9R2LD8", "PK451", "ISB", "KDU", day=0, depart="07:30", arrive="08:55", cost=190, status="confirmed", seat="12A"),
        activity("operator", "K2 trek operator, 18 days", "Karakoram Expeditions", day=1, at="08:00", location="Skardu", cost=1500, status="confirmed", confirmation="KE-2026-117", participants=1, meeting="Operator office, Skardu", docs=["Trek operator contract (sample).pdf"], policy="Deposit refundable until 60 days before departure.", free_until=-60),
    ],
    "zermatt-alpine-winter": [
        hotel("chalet", "Chalet in Zermatt", "Chalet Matterhorn View", "CMV-33218", nights=7, address="Bahnhofstrasse, Zermatt", guests=2, room="Family chalet", cost=2100, currency="CHF", status="confirmed", location="Zermatt", docs=["Chalet booking (sample).pdf"], policy="Free cancellation until 30 days before arrival.", free_until=-30),
        flight("old", "Islamabad to Zurich", "Swiss", "LX-OLD123", "LX189", "ISB", "ZRH", depart="02:15", arrive="07:30", cost=880, currency="CHF", status="cancelled", notes="Rebooked on a different date.", policy="Refunded to the original card within 14 days."),
        transfer("rail", "Glacier Express to Zermatt", "Swiss Rail", "train", "Zurich Airport", "Zermatt", day=0, at="10:00", until="15:30", cost=190, currency="CHF", status="confirmed", confirmation="SR-77621", docs=["Rail pass (sample).png"]),
    ],
    "maldives-island-escape": [
        hotel("resort", "Water bungalow", "Coral Atoll Resort", "CAR-88102", nights=6, address="North Malé Atoll", guests=2, room="Over-water villa", cost=1900, status="confirmed", location="North Malé Atoll", docs=["Resort booking (sample).pdf"], policy="Non-refundable inside 21 days.", free_until=-21),
        flight("fly", "Islamabad to Malé", "Qatar Airways", "QR-ML0911", "QR670", "ISB", "MLE", depart="23:50", arrive="06:20", arrive_day=1, cost=780, status="confirmed", seat="40A", docs=["Boarding pass (sample).png"]),
        activity("snorkel", "Guided snorkelling", "Coral Atoll Dive Centre", day=2, at="09:00", location="House reef", cost=80, status="pending", participants=2),
    ],
    "tbilisi-wine-weekend": [
        flight("fly", "Islamabad to Tbilisi (via Doha)", "Qatar Airways", "QR-TB5521", "QR633", "ISB", "DOH", depart="03:10", arrive="05:00", cost=360, status="pending", cabin="economy"),
        hotel("apartment", "Old Town apartment", "Sololaki Stays", "SS-2204", nights=4, address="Sololaki, Tbilisi", guests=2, cost=210, status="pending", location="Old Tbilisi"),
    ],
}

# Every booking's "free cancellation until" is expressed as days relative to the booking's start date.
