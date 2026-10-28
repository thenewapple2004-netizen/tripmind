"""
Sample trips for development: 25 trips, 15 of them in Pakistan's northern areas
(Gilgit-Baltistan, Khyber Pakhtunkhwa and Azad Kashmir), plus a spread of international ones.

Dates are offsets from the day the seed runs (negative = already happened), so every account
gets a mix of completed, in-progress and upcoming trips. Amounts are in USD, the app's default
currency; the budget/expense figures are plausible for each trip, not real quotes.

Each trip is a dict:
    key          stable slug, used to derive ids so re-running never duplicates
    title        trip title
    destination  "Place, Region/Country": the destination also drives the cover photo
    start        days from today when the trip starts
    days         trip length in days (inclusive)
    budget       total budget, USD
    activities   (day, title, location, cost), day is 0-based from the trip's first day.
                 Start times and durations are derived by `schedule_activities` (see below),
                 except where TIME_OVERRIDES says otherwise.
    expenses     (day, title, category, amount), day may be negative for pre-paid bookings
"""

from typing import Any, Dict, List

TRIPS: List[Dict[str, Any]] = [
    # ── Northern areas: completed ─────────────────────────────────────────
    {
        "key": "hunza-cultural-retreat",
        "title": "Hunza Valley Cultural Retreat",
        "destination": "Hunza Valley, Gilgit-Baltistan",
        "start": -75, "days": 8, "budget": 900,
        "activities": [
            (0, "Check in at Karimabad guesthouse", "Karimabad", 0),
            (1, "Baltit Fort guided tour", "Baltit Fort", 12),
            (2, "Sunrise at Eagle's Nest viewpoint", "Duikar", 5),
            (3, "Attabad Lake boat ride", "Attabad Lake", 18),
            (4, "Passu Cones and Hussaini suspension bridge", "Passu", 6),
            (6, "Apricot orchard and dry-fruit market walk", "Aliabad", 0),
        ],
        "expenses": [
            (0, "Guesthouse, 7 nights", "Accommodation", 245),
            (0, "Jeep hire Islamabad to Hunza (shared)", "Transportation", 190),
            (2, "Dinner of chapshuro and Hunza walnut cake", "Food", 14),
            (4, "Meals on the Karakoram Highway", "Food", 96),
            (5, "Handwoven shawl and dried apricots", "Shopping", 58),
            (6, "Local guide, two days", "Activities", 60),
            (7, "Return transfer to Gilgit", "Transportation", 70),
        ],
    },
    {
        "key": "skardu-shangrila",
        "title": "Skardu & Shangrila Escape",
        "destination": "Skardu, Gilgit-Baltistan",
        "start": -50, "days": 7, "budget": 1100,
        "activities": [
            (0, "Arrive in Skardu, rest and acclimatise", "Skardu", 0),
            (1, "Shangrila Resort and Lower Kachura Lake", "Shangrila Resort", 10),
            (2, "Upper Kachura Lake hike", "Upper Kachura Lake", 4),
            (3, "Shigar Fort and Khaplu Palace visit", "Shigar", 15),
            (4, "Cold desert dunes at Katpana", "Katpana Desert", 8),
            (5, "Sunset at Sarfaranga Cold Desert", "Sarfaranga", 0),
        ],
        "expenses": [
            (0, "Return flight Islamabad to Skardu", "Transportation", 180),
            (0, "Hotel, 6 nights", "Accommodation", 330),
            (1, "Private car with driver, 5 days", "Transportation", 260),
            (3, "Heritage hotel lunch at Shigar", "Food", 28),
            (4, "Cold-desert jeep safari", "Activities", 40),
            (5, "Souvenirs and local jewellery", "Shopping", 62),
            (6, "Meals across the week", "Food", 105),
        ],
    },
    {
        "key": "fairy-meadows-nanga-parbat",
        "title": "Fairy Meadows & Nanga Parbat View",
        "destination": "Fairy Meadows, Gilgit-Baltistan",
        "start": -95, "days": 6, "budget": 650,
        "activities": [
            (0, "Drive Islamabad to Raikot Bridge", "Raikot Bridge", 0),
            (1, "Jeep ride and trek up to Fairy Meadows", "Tato Village", 30),
            (2, "Nanga Parbat viewpoint at sunrise", "Fairy Meadows", 0),
            (3, "Hike to Nanga Parbat Base Camp (Beyal Camp)", "Beyal Camp", 12),
            (4, "Rest day and campfire night", "Fairy Meadows", 6),
        ],
        "expenses": [
            (0, "Coaster seat Islamabad to Raikot", "Transportation", 55),
            (1, "Jeep track fare to Tato", "Transportation", 35),
            (1, "Wooden hut, 4 nights", "Accommodation", 180),
            (2, "Meals and chai at the meadows", "Food", 88),
            (3, "Porter for backpacks", "Other", 40),
            (5, "Return transport to Islamabad", "Transportation", 70),
        ],
    },
    {
        "key": "swat-valley-getaway",
        "title": "Swat Valley Spring Getaway",
        "destination": "Kalam, Swat",
        "start": -140, "days": 5, "budget": 520,
        "activities": [
            (0, "Check in at Mingora", "Mingora", 0),
            (1, "Malam Jabba viewpoint and chairlift", "Malam Jabba", 14),
            (2, "Kalam and Ushu forest walk", "Kalam", 0),
            (3, "Mahodand Lake jeep trip", "Mahodand Lake", 25),
            (4, "Swat Museum and Butkara Stupa", "Mingora", 3),
        ],
        "expenses": [
            (0, "Hotel in Mingora and Kalam, 4 nights", "Accommodation", 160),
            (0, "Car and driver from Islamabad", "Transportation", 150),
            (2, "Trout lunch by the river", "Food", 22),
            (3, "Mahodand jeep hire", "Transportation", 60),
            (4, "Swat honey, walnuts and embroidered shawl", "Shopping", 45),
            (4, "Meals", "Food", 55),
        ],
    },
    {
        "key": "naran-kaghan-lake",
        "title": "Naran Kaghan & Saif-ul-Malook",
        "destination": "Naran, Khyber Pakhtunkhwa",
        "start": -160, "days": 5, "budget": 560,
        "activities": [
            (0, "Drive via Balakot to Naran", "Balakot", 0),
            (1, "Saif-ul-Malook Lake jeep ride", "Lake Saif-ul-Malook", 22),
            (2, "Lalazar Plateau and Babusar Top", "Babusar Pass", 20),
            (3, "Shogran and Siri Paye meadows", "Shogran", 18),
            (4, "Riverside walk in Naran bazaar", "Naran", 0),
        ],
        "expenses": [
            (0, "Hotel, 4 nights", "Accommodation", 190),
            (0, "Hired car from Islamabad", "Transportation", 140),
            (1, "Horse ride to lake viewpoint", "Activities", 25),
            (2, "Dhaba meals and BBQ", "Food", 70),
            (4, "Souvenirs", "Shopping", 32),
        ],
    },
    {
        "key": "murree-nathia-gali",
        "title": "Murree & Nathia Gali Weekend",
        "destination": "Murree, Punjab",
        "start": -20, "days": 3, "budget": 260,
        "activities": [
            (0, "Mall Road stroll and chairlift", "Murree", 6),
            (1, "Ayubia National Park pipeline trail", "Ayubia", 4),
            (2, "Nathia Gali viewpoint and tea", "Nathia Gali", 0),
        ],
        "expenses": [
            (0, "Guesthouse, 2 nights", "Accommodation", 95),
            (0, "Fuel and tolls", "Transportation", 45),
            (1, "Meals", "Food", 52),
            (2, "Walnut and pine honey", "Shopping", 18),
        ],
    },
    # ── Northern areas: in progress ───────────────────────────────────────
    {
        "key": "neelum-valley-autumn",
        "title": "Neelum Valley Autumn Colours",
        "destination": "Neelum Valley, Azad Kashmir",
        "start": -2, "days": 6, "budget": 640,
        "activities": [
            (0, "Muzaffarabad to Keran drive", "Keran", 0),
            (1, "Sharda village and Sharda University ruins", "Sharda", 3),
            (2, "Arang Kel by cable car and trek", "Arang Kel", 20),
            (3, "Ratti Gali Lake day hike", "Ratti Gali Lake", 15),
            (4, "Kutton Waterfall", "Kutton", 0),
        ],
        "expenses": [
            (-3, "Hut booking at Arang Kel", "Accommodation", 120),
            (0, "Hired SUV, 6 days", "Transportation", 210),
            (1, "Local trout dinner", "Food", 18),
            (2, "Cable car and trek permit", "Activities", 20),
        ],
    },
    {
        "key": "astore-rama-meadows",
        "title": "Astore & Rama Meadows",
        "destination": "Astore, Gilgit-Baltistan",
        "start": -3, "days": 7, "budget": 780,
        "activities": [
            (0, "Drive from Gilgit via Jaglot", "Gilgit", 0),
            (1, "Rama Lake and meadows", "Rama Lake", 12),
            (2, "Rama Meadows camping", "Rama Meadows", 8),
            (4, "Rupal Face viewpoint at Tarashing", "Tarashing", 15),
            (5, "Eidgah Astore Valley picnic", "Astore", 0),
        ],
        "expenses": [
            (-5, "Camping gear rental", "Other", 70),
            (0, "Hotel, 3 nights in Astore", "Accommodation", 135),
            (0, "Jeep hire", "Transportation", 220),
            (2, "Meals at Rama", "Food", 48),
            (3, "Guide and porter", "Activities", 75),
        ],
    },
    # ── Northern areas: upcoming ──────────────────────────────────────────
    {
        "key": "deosai-plains-safari",
        "title": "Deosai National Park Safari",
        "destination": "Deosai National Park, Gilgit-Baltistan",
        "start": 12, "days": 4, "budget": 540,
        "activities": [
            (0, "Skardu to Deosai Plains drive", "Deosai Plains", 10),
            (1, "Sheosar Lake sunrise", "Sheosar Lake", 0),
            (2, "Himalayan brown bear spotting", "Bara Pani", 15),
            (3, "Kala Pani and wildflower walk", "Kala Pani", 0),
        ],
        "expenses": [
            (-4, "Camping at Sheosar, 3 nights", "Accommodation", 110),
            (-4, "Jeep and driver for 4 days", "Transportation", 200),
            (-1, "Park entry permits", "Other", 18),
        ],
    },
    {
        "key": "khunjerab-pass-road-trip",
        "title": "Khunjerab Pass Road Trip",
        "destination": "Khunjerab Pass, Gilgit-Baltistan",
        "start": 20, "days": 3, "budget": 430,
        "activities": [
            (0, "Sost customs and Khunjerab National Park", "Sost", 12),
            (1, "Drive to the Khunjerab border at 4,693 m", "Khunjerab Pass", 5),
            (2, "Pak-China Friendship Highway viewpoints", "Gojal", 0),
        ],
        "expenses": [
            (-6, "Guesthouse in Sost, 2 nights", "Accommodation", 90),
            (-6, "Car with driver", "Transportation", 150),
            (-2, "Permits and park fees", "Other", 20),
        ],
    },
    {
        "key": "kalash-valleys",
        "title": "Kalash Valleys Cultural Visit",
        "destination": "Kalash Valleys, Chitral",
        "start": 45, "days": 6, "budget": 720,
        "activities": [
            (0, "Chitral town and fort", "Chitral", 6),
            (1, "Bumburet Valley village walk", "Bumburet", 8),
            (2, "Kalash Museum and craft cooperative", "Bumburet", 4),
            (3, "Rumbur Valley hike", "Rumbur", 0),
            (4, "Birir Valley and apricot terraces", "Birir", 0),
        ],
        "expenses": [
            (-10, "Guesthouse in Bumburet, 4 nights", "Accommodation", 180),
            (-10, "Flight Islamabad to Chitral", "Transportation", 150),
            (-3, "Local guide", "Activities", 60),
        ],
    },
    {
        "key": "chitral-shandur-road-trip",
        "title": "Chitral & Shandur Pass Road Trip",
        "destination": "Shandur Pass, Gilgit-Baltistan",
        "start": 60, "days": 7, "budget": 880,
        "activities": [
            (0, "Chitral to Mastuj via Lowari Tunnel", "Mastuj", 0),
            (1, "Shandur Pass crossing", "Shandur Pass", 10),
            (2, "Khalti Lake trout fishing", "Khalti Lake", 12),
            (3, "Phander Valley and lake", "Phander", 0),
            (5, "Gupis and Ghizer river picnic", "Gupis", 0),
        ],
        "expenses": [
            (-14, "Jeep with driver, 7 days", "Transportation", 330),
            (-14, "Guesthouse bookings", "Accommodation", 210),
            (-2, "Fishing permits and gear", "Activities", 30),
        ],
    },
    {
        "key": "k2-concordia-trek",
        "title": "K2 Base Camp Concordia Trek",
        "destination": "K2, Karakoram",
        "start": 90, "days": 18, "budget": 3800,
        "activities": [
            (0, "Skardu briefing and permits", "Skardu", 150),
            (1, "Drive to Askole", "Askole", 0),
            (3, "Paiju camp rest day", "Paiju", 0),
            (6, "Baltoro Glacier crossing", "Baltoro Glacier", 0),
            (9, "Concordia, the Throne Room of the Mountain Gods", "Concordia", 0),
            (11, "K2 Base Camp day trip", "K2 Base Camp", 0),
        ],
        "expenses": [
            (-30, "Trek operator deposit", "Activities", 1500),
            (-30, "Return flight to Skardu", "Transportation", 190),
            (-14, "Down jacket and trekking boots", "Shopping", 360),
            (-7, "Travel insurance (high altitude)", "Other", 140),
        ],
    },
    {
        "key": "naltar-valley-winter",
        "title": "Naltar Valley Winter Escape",
        "destination": "Naltar Valley, Gilgit-Baltistan",
        "start": 75, "days": 5, "budget": 640,
        "activities": [
            (0, "Gilgit to Naltar jeep drive", "Naltar", 10),
            (1, "Ski lessons at Naltar slopes", "Naltar Ski Resort", 45),
            (2, "Bashkiri Lake and Satrangi Lakes", "Satrangi Lakes", 15),
            (3, "Snow walk through pine forest", "Naltar", 0),
        ],
        "expenses": [
            (-10, "Lodge, 4 nights", "Accommodation", 200),
            (-10, "Jeep hire", "Transportation", 120),
            (-3, "Ski gear rental", "Activities", 60),
        ],
    },
    {
        "key": "passu-attabad-lakes",
        "title": "Passu & Attabad Lakes Road Trip",
        "destination": "Passu, Gilgit-Baltistan",
        "start": 25, "days": 5, "budget": 600,
        "activities": [
            (0, "Karimabad to Gulmit", "Gulmit", 0),
            (1, "Borith Lake walk", "Borith Lake", 4),
            (2, "Passu Glacier trek", "Passu Glacier", 10),
            (3, "Attabad Lake kayaking", "Attabad Lake", 22),
            (4, "Rakaposhi view from Ganesh", "Ganesh", 0),
        ],
        "expenses": [
            (-7, "Lakeside hotel, 4 nights", "Accommodation", 170),
            (-7, "Car hire", "Transportation", 160),
            (-1, "Trekking guide for Passu Glacier", "Activities", 35),
        ],
    },
    # ── Pakistan: cities & heritage ───────────────────────────────────────
    {
        "key": "lahore-food-heritage",
        "title": "Lahore Food & Heritage Weekend",
        "destination": "Lahore, Pakistan",
        "start": -10, "days": 3, "budget": 340,
        "activities": [
            (0, "Walled City and Wazir Khan Mosque", "Walled City", 5),
            (0, "Food Street dinner at Fort Road", "Fort Road", 22),
            (1, "Badshahi Mosque and Lahore Fort", "Lahore Fort", 8),
            (2, "Shalimar Gardens and Anarkali Bazaar", "Shalimar Gardens", 4),
        ],
        "expenses": [
            (0, "Heritage hotel, 2 nights", "Accommodation", 120),
            (0, "Ride-hailing around the city", "Transportation", 28),
            (1, "Phajja siri paye breakfast and lassi", "Food", 36),
            (2, "Khussas and block-print fabric", "Shopping", 64),
        ],
    },
    {
        "key": "taxila-heritage-day-trip",
        "title": "Taxila & Rawalpindi Heritage",
        "destination": "Taxila, Punjab",
        "start": 8, "days": 2, "budget": 150,
        "activities": [
            (0, "Taxila Museum and Dharmarajika Stupa", "Taxila", 3),
            (0, "Bhir Mound and Sirkap ruins", "Sirkap", 2),
            (1, "Saidpur Village and Rawalpindi Raja Bazaar", "Saidpur", 0),
        ],
        "expenses": [
            (-2, "Hotel in Rawalpindi, 1 night", "Accommodation", 45),
            (0, "Taxi for two days", "Transportation", 40),
            (1, "Meals", "Food", 24),
        ],
    },
    # ── International ─────────────────────────────────────────────────────
    {
        "key": "istanbul-bazaar-break",
        "title": "Istanbul Bazaar Break",
        "destination": "Istanbul, Turkey",
        "start": -200, "days": 6, "budget": 1400,
        "activities": [
            (0, "Hagia Sophia and Blue Mosque", "Sultanahmet", 25),
            (1, "Topkapi Palace and Basilica Cistern", "Sultanahmet", 30),
            (2, "Grand Bazaar and Spice Market", "Eminonu", 0),
            (3, "Bosphorus ferry to Kadikoy", "Bosphorus", 6),
            (4, "Galata Tower and Istiklal Avenue", "Beyoglu", 18),
        ],
        "expenses": [
            (-20, "Return flights", "Transportation", 520),
            (0, "Boutique hotel, 5 nights", "Accommodation", 410),
            (1, "Meals and street food", "Food", 190),
            (3, "Turkish carpet and ceramics", "Shopping", 180),
            (5, "Airport transfers and metro", "Transportation", 46),
        ],
    },
    {
        "key": "kyoto-cherry-blossom",
        "title": "Kyoto Cherry Blossom Season",
        "destination": "Kyoto, Japan",
        "start": -230, "days": 9, "budget": 3200,
        "activities": [
            (0, "Check in near Gion", "Gion", 0),
            (1, "Fushimi Inari at dawn", "Fushimi Inari Shrine", 0),
            (2, "Philosopher's Path and Ginkaku-ji", "Higashiyama", 6),
            (3, "Arashiyama bamboo grove and Tenryu-ji", "Arashiyama", 8),
            (5, "Tea ceremony in Gion", "Gion", 45),
            (7, "Day trip to Nara", "Nara", 12),
        ],
        "expenses": [
            (-45, "Return flights", "Transportation", 1150),
            (0, "Ryokan and hotel, 8 nights", "Accommodation", 1050),
            (2, "Kaiseki dinner", "Food", 210),
            (3, "JR Pass and local transit", "Transportation", 260),
            (5, "Ceramics and matcha sets", "Shopping", 290),
            (8, "Meals across the trip", "Food", 340),
        ],
    },
    {
        "key": "dubai-desert-getaway",
        "title": "Dubai Desert Getaway",
        "destination": "Dubai, United Arab Emirates",
        "start": 5, "days": 4, "budget": 1250,
        "activities": [
            (0, "Burj Khalifa observation deck", "Downtown Dubai", 45),
            (1, "Desert safari with dinner", "Lahbab Desert", 60),
            (2, "Old Dubai: Al Fahidi and the abra ride", "Bur Dubai", 3),
            (3, "Dubai Mall and fountain show", "Downtown Dubai", 0),
        ],
        "expenses": [
            (-14, "Return flights", "Transportation", 420),
            (-14, "Hotel, 3 nights", "Accommodation", 390),
            (-2, "Travel eSIM and insurance", "Other", 38),
        ],
    },
    {
        "key": "zermatt-alpine-winter",
        "title": "Zermatt Alpine Winter Week",
        "destination": "Zermatt, Switzerland",
        "start": 110, "days": 8, "budget": 4800,
        "activities": [
            (0, "Glacier Express arrival", "Zermatt", 0),
            (1, "Gornergrat railway and Matterhorn viewpoint", "Gornergrat", 95),
            (2, "Ski day at Matterhorn Glacier Paradise", "Klein Matterhorn", 85),
            (4, "Fondue evening in Zermatt", "Zermatt", 48),
            (6, "Sunnegga and Blauherd snowshoe walk", "Sunnegga", 30),
        ],
        "expenses": [
            (-40, "Return flights", "Transportation", 880),
            (-40, "Chalet, 7 nights", "Accommodation", 2100),
            (-20, "Ski pass, 6 days", "Activities", 420),
        ],
    },
    {
        "key": "maldives-island-escape",
        "title": "Maldives Island Escape",
        "destination": "Malé, Maldives",
        "start": 140, "days": 7, "budget": 3600,
        "activities": [
            (0, "Speedboat transfer to the resort", "North Malé Atoll", 60),
            (1, "Snorkelling the house reef", "House Reef", 0),
            (3, "Sandbank picnic and dolphin cruise", "Sandbank", 80),
            (5, "Sunset fishing trip", "Lagoon", 45),
        ],
        "expenses": [
            (-60, "Return flights", "Transportation", 780),
            (-60, "Water bungalow, 6 nights", "Accommodation", 1900),
            (-10, "Half-board meal plan upgrade", "Food", 320),
        ],
    },
    {
        "key": "tbilisi-wine-weekend",
        "title": "Tbilisi Old Town & Wine Country",
        "destination": "Tbilisi, Georgia",
        "start": 30, "days": 5, "budget": 980,
        "activities": [
            (0, "Old Town and sulphur baths", "Abanotubani", 18),
            (1, "Narikala Fortress by cable car", "Narikala", 3),
            (2, "Kakheti wine country day trip", "Telavi", 70),
            (3, "Dry Bridge market and Rustaveli Avenue", "Tbilisi", 0),
        ],
        "expenses": [
            (-20, "Return flights", "Transportation", 360),
            (-20, "Apartment, 4 nights", "Accommodation", 210),
            (-3, "Walking-tour and wine-tasting deposit", "Activities", 40),
        ],
    },
    {
        "key": "kuala-lumpur-city-break",
        "title": "Kuala Lumpur City Break",
        "destination": "Kuala Lumpur, Malaysia",
        "start": 55, "days": 6, "budget": 1150,
        "activities": [
            (0, "Petronas Twin Towers skybridge", "KLCC", 24),
            (1, "Batu Caves and Hindu temple", "Batu Caves", 2),
            (2, "Jalan Alor street-food night", "Bukit Bintang", 18),
            (4, "Genting Highlands day trip", "Genting Highlands", 35),
        ],
        "expenses": [
            (-25, "Return flights", "Transportation", 410),
            (-25, "Hotel, 5 nights", "Accommodation", 280),
            (-5, "Travel insurance", "Other", 32),
        ],
    },
    {
        "key": "baku-caspian-weekend",
        "title": "Baku Caspian Weekend",
        "destination": "Baku, Azerbaijan",
        "start": 100, "days": 5, "budget": 900,
        "activities": [
            (0, "Old City (Icherisheher) walk", "Old City", 0),
            (1, "Gobustan petroglyphs and mud volcanoes", "Gobustan", 28),
            (2, "Flame Towers and seaside boulevard", "Baku Boulevard", 0),
            (3, "Absheron Peninsula: Ateshgah fire temple", "Surakhani", 8),
        ],
        "expenses": [
            (-30, "Return flights", "Transportation", 340),
            (-30, "Hotel, 4 nights", "Accommodation", 260),
        ],
    },
]


# ── Scheduling ────────────────────────────────────────────────────────────
# Activities on the same day are laid out in these slots (start hour, minute, duration in minutes),
# in the order they are listed. Arrival, check-in and rest-style entries are left unscheduled, which
# is how a real itinerary looks: some things have a time and some are just "sometime that day".

_SLOTS = [(9, 0, 90), (11, 30, 120), (14, 30, 120), (18, 0, 90), (20, 0, 60)]
_UNSCHEDULED_WORDS = ("arrival", "arrive", "check in", "rest", "acclimatise", "briefing")

# (trip key, activity title) -> (start "HH:MM", duration minutes). Used to plant a visible scheduling
# conflict: on this Lahore day, a late-running walking tour overlaps the dinner booking by 30 minutes.
TIME_OVERRIDES = {
    ("lahore-food-heritage", "Walled City and Wazir Khan Mosque"): ("17:00", 150),
    ("lahore-food-heritage", "Food Street dinner at Fort Road"): ("19:00", 90),
}


def schedule_activities(trip: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Returns {activity title: {start_time, duration_minutes, position}} for one trip."""
    result: Dict[str, Dict[str, Any]] = {}
    per_day: Dict[int, int] = {}
    for day, title, _location, _cost in trip["activities"]:
        position = per_day.get(day, 0)
        per_day[day] = position + 1

        override = TIME_OVERRIDES.get((trip["key"], title))
        if override:
            start, duration = override
        elif any(word in title.lower() for word in _UNSCHEDULED_WORDS):
            start, duration = None, None
        else:
            hour, minute, duration = _SLOTS[min(position, len(_SLOTS) - 1)]
            start = f"{hour:02d}:{minute:02d}"
        result[title] = {"start_time": start, "duration_minutes": duration, "position": position}
    return result
