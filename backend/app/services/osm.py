"""Overpass-backed OpenStreetMap POI lookups.

Fetches real-world businesses (restaurants, banks, hospitals, pharmacies,
police stations, schools, etc.) within a radius of a given point, maps each
OSM feature to one of our internal category slugs, and caches the result in
process memory so we don't hammer the public Overpass endpoint.

Queries use `nwr` (nodes + ways + relations) so polygon-mapped POIs such as
hospitals, universities, and parks are returned with centroid geometry,
not just point-mapped nodes. When a single `category_slug` is provided we
issue a narrowed query for just that category so the 300-element cap is not
burned on restaurants when the user is looking for pharmacies.

No API key is required — Overpass and OpenStreetMap are free to use with
sensible rate limits. We round coordinates to ~1km blocks before caching so
nearby users share the same cache key.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

import httpx

from app.services.geo import haversine_km

# Default public Overpass endpoint. Alternates exist (e.g.
# https://overpass.kumi.systems/api/interpreter) if this one is slow.
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Cache entries are valid for 10 minutes. POI data rarely changes and
# Overpass explicitly asks clients to cache aggressively.
_CACHE_TTL_SECONDS = 600

# Max elements requested per Overpass query. High enough to cover a dense
# European city centre with a single-category filter; still polite.
_OUT_LIMIT = 300


@dataclass(frozen=True)
class OsmPlace:
    osm_id: str
    name: str
    category_slug: str
    category_name: str
    category_icon: str
    lat: float
    lng: float
    phone: str | None
    address: str | None
    website: str | None


# In-process cache: { (round_lat, round_lng, radius_m, category_slug|""): (expires_at, places) }
_cache: dict[tuple[float, float, int, str], tuple[float, list[OsmPlace]]] = {}
_cache_lock = asyncio.Lock()


# Category → Overpass selector templates. Each template is a plain Overpass
# filter string that will be wrapped in `nwr[...](around:R,lat,lng);`.
# A POI is surfaced as belonging to the first category whose selector matches.
_CATEGORY_SELECTORS: dict[str, list[str]] = {
    "safety": [
        '["amenity"~"^(police|fire_station)$"]',
    ],
    "health": [
        '["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy)$"]',
        '["healthcare"]',
        '["shop"="chemist"]',
    ],
    "food": [
        '["amenity"~"^(restaurant|cafe|fast_food|bar|pub|biergarten|food_court|ice_cream)$"]',
        '["shop"~"^(supermarket|convenience|bakery|butcher|greengrocer|seafood|deli|marketplace)$"]',
    ],
    "finance": [
        '["amenity"~"^(bank|atm|bureau_de_change)$"]',
    ],
    "transport": [
        '["amenity"~"^(taxi|bus_station|fuel|charging_station|car_rental|parking|bicycle_rental)$"]',
        '["public_transport"="station"]',
        '["railway"~"^(station|subway_entrance|tram_stop)$"]',
        '["highway"="bus_stop"]',
    ],
    "education": [
        '["amenity"~"^(school|college|university|library|kindergarten)$"]',
    ],
    "municipal": [
        '["amenity"~"^(townhall|courthouse|post_office)$"]',
        '["office"~"^(government|notary)$"]',
    ],
    "leisure": [
        '["amenity"~"^(cinema|theatre|nightclub|arts_centre|community_centre)$"]',
        '["leisure"~"^(park|fitness_centre|sports_centre|playground|stadium|swimming_pool)$"]',
        '["tourism"~"^(museum|gallery|attraction|viewpoint|zoo)$"]',
    ],
    "home": [
        '["shop"~"^(hardware|doityourself|electrical|furniture|appliance|garden_centre)$"]',
        '["craft"~"^(plumber|electrician|carpenter|painter|locksmith)$"]',
    ],
    "utilities": [
        '["office"~"^(telecommunication|energy_supplier|water_supplier)$"]',
        '["amenity"~"^(recycling|waste_disposal)$"]',
        '["man_made"~"^(water_works|wastewater_plant)$"]',
        '["power"="substation"]',
    ],
}


# Ordered tag rules used to classify an element we got back from Overpass into
# exactly one of our slugs. Order matters: the first match wins.
_TAG_RULES: list[tuple[str, set[str], str, str, str]] = [
    # Safety / emergency first — most important for SOS context
    ("amenity", {"police"}, "safety", "Police", "👮"),
    ("amenity", {"fire_station"}, "safety", "Fire Station", "🚒"),
    ("amenity", {"hospital"}, "health", "Hospital", "🏥"),
    ("amenity", {"clinic", "doctors", "dentist"}, "health", "Clinic", "⚕️"),
    ("amenity", {"pharmacy"}, "health", "Pharmacy", "💊"),
    ("shop", {"chemist"}, "health", "Chemist", "💊"),
    ("healthcare", {"*"}, "health", "Healthcare", "⚕️"),
    # Food / groceries
    ("amenity", {"restaurant"}, "food", "Restaurant", "🍽️"),
    ("amenity", {"cafe"}, "food", "Café", "☕"),
    ("amenity", {"fast_food"}, "food", "Fast food", "🍔"),
    ("amenity", {"bar", "pub", "biergarten"}, "food", "Bar / Pub", "🍺"),
    ("amenity", {"food_court"}, "food", "Food court", "🍱"),
    ("amenity", {"ice_cream"}, "food", "Ice cream", "🍦"),
    ("shop", {"supermarket"}, "food", "Supermarket", "🛒"),
    ("shop", {"convenience"}, "food", "Convenience store", "🏪"),
    ("shop", {"bakery"}, "food", "Bakery", "🥖"),
    ("shop", {"butcher", "greengrocer", "seafood", "deli"}, "food", "Grocery", "🥗"),
    ("shop", {"marketplace"}, "food", "Marketplace", "🧺"),
    # Finance
    ("amenity", {"bank"}, "finance", "Bank", "🏦"),
    ("amenity", {"atm"}, "finance", "ATM", "🏧"),
    ("amenity", {"bureau_de_change"}, "finance", "Currency exchange", "💱"),
    # Transport
    ("amenity", {"taxi"}, "transport", "Taxi stand", "🚖"),
    ("amenity", {"bus_station"}, "transport", "Bus station", "🚌"),
    ("amenity", {"fuel"}, "transport", "Fuel station", "⛽"),
    ("amenity", {"charging_station"}, "transport", "EV charging", "🔌"),
    ("amenity", {"car_rental"}, "transport", "Car rental", "🚗"),
    ("amenity", {"parking"}, "transport", "Parking", "🅿️"),
    ("amenity", {"bicycle_rental"}, "transport", "Bike rental", "🚲"),
    ("public_transport", {"station"}, "transport", "Transit station", "🚉"),
    ("railway", {"station", "subway_entrance", "tram_stop"}, "transport", "Train station", "🚆"),
    ("highway", {"bus_stop"}, "transport", "Bus stop", "🚏"),
    # Education
    ("amenity", {"school"}, "education", "School", "🏫"),
    ("amenity", {"college", "university"}, "education", "University", "🎓"),
    ("amenity", {"library"}, "education", "Library", "📚"),
    ("amenity", {"kindergarten"}, "education", "Kindergarten", "🧸"),
    # Municipal
    ("amenity", {"townhall", "courthouse"}, "municipal", "Municipal office", "🏛️"),
    ("amenity", {"post_office"}, "municipal", "Post office", "📮"),
    ("office", {"government", "notary"}, "municipal", "Government office", "🏛️"),
    # Utilities
    ("amenity", {"recycling"}, "utilities", "Recycling", "♻️"),
    ("amenity", {"waste_disposal"}, "utilities", "Waste disposal", "🗑️"),
    ("office", {"telecommunication"}, "utilities", "Telecom office", "📡"),
    ("office", {"energy_supplier"}, "utilities", "Energy office", "⚡"),
    ("office", {"water_supplier"}, "utilities", "Water office", "🚰"),
    ("man_made", {"water_works"}, "utilities", "Water works", "🚰"),
    ("man_made", {"wastewater_plant"}, "utilities", "Wastewater plant", "💧"),
    ("power", {"substation"}, "utilities", "Power substation", "⚡"),
    # Leisure
    ("amenity", {"cinema"}, "leisure", "Cinema", "🎬"),
    ("amenity", {"theatre"}, "leisure", "Theatre", "🎭"),
    ("amenity", {"nightclub"}, "leisure", "Nightclub", "🎶"),
    ("amenity", {"arts_centre", "community_centre"}, "leisure", "Community", "🎨"),
    ("leisure", {"park"}, "leisure", "Park", "🌳"),
    ("leisure", {"fitness_centre", "sports_centre"}, "leisure", "Gym", "🏋️"),
    ("leisure", {"playground"}, "leisure", "Playground", "🛝"),
    ("leisure", {"stadium"}, "leisure", "Stadium", "🏟️"),
    ("leisure", {"swimming_pool"}, "leisure", "Swimming pool", "🏊"),
    ("tourism", {"museum"}, "leisure", "Museum", "🏛️"),
    ("tourism", {"gallery"}, "leisure", "Gallery", "🖼️"),
    ("tourism", {"attraction", "viewpoint"}, "leisure", "Attraction", "📍"),
    ("tourism", {"zoo"}, "leisure", "Zoo", "🦁"),
    # Home / trades
    ("shop", {"hardware", "doityourself", "electrical"}, "home", "Hardware shop", "🛠️"),
    ("shop", {"furniture", "appliance", "garden_centre"}, "home", "Home shop", "🛋️"),
    ("craft", {"plumber"}, "home", "Plumber", "🔧"),
    ("craft", {"electrician"}, "home", "Electrician", "💡"),
    ("craft", {"carpenter"}, "home", "Carpenter", "🪚"),
    ("craft", {"painter"}, "home", "Painter", "🎨"),
    ("craft", {"locksmith"}, "home", "Locksmith", "🔐"),
]


def _match_category(tags: dict[str, str]) -> tuple[str, str, str] | None:
    """Return (slug, name, icon) for the first matching rule, or None."""
    for key, values, slug, name, icon in _TAG_RULES:
        tag_value = tags.get(key)
        if tag_value is None:
            continue
        if "*" in values or tag_value in values:
            return slug, name, icon
    return None


def _round_key(
    lat: float, lng: float, radius_m: int, category_slug: str | None
) -> tuple[float, float, int, str]:
    """Round to ~1km precision so nearby callers share a cache entry."""
    return (round(lat, 2), round(lng, 2), radius_m, category_slug or "")


def _build_query(
    lat: float, lng: float, radius_m: int, category_slug: str | None
) -> str:
    """Build an Overpass QL query.

    If `category_slug` is one of our known categories, emit a narrowed query
    for only that category's OSM selectors (so we don't spend the 300-element
    budget on unrelated POIs). Otherwise emit the full broad query.

    All selectors use `nwr` so polygon POIs (hospitals, universities, parks
    mapped as ways/relations) are also returned. `out tags center` gives us a
    single representative centroid even for area geometry.
    """
    bbox = f"(around:{radius_m},{lat},{lng})"
    if category_slug and category_slug in _CATEGORY_SELECTORS:
        sel_templates = _CATEGORY_SELECTORS[category_slug]
    else:
        # No filter (or unknown slug) → union of every category.
        sel_templates = [s for selectors in _CATEGORY_SELECTORS.values() for s in selectors]
    selectors = [f"nwr{tmpl}{bbox}" for tmpl in sel_templates]
    body = ";\n  ".join(selectors)
    return f"""[out:json][timeout:25];
(
  {body};
);
out tags center {_OUT_LIMIT};
"""


def _parse_element(
    element: dict,
    origin_lat: float,
    origin_lng: float,
) -> OsmPlace | None:
    tags: dict[str, str] = element.get("tags") or {}
    name = tags.get("name") or tags.get("name:en") or tags.get("brand")
    if not name:
        return None
    lat = element.get("lat")
    lng = element.get("lon")
    if lat is None or lng is None:
        center = element.get("center") or {}
        lat = center.get("lat")
        lng = center.get("lon")
    if lat is None or lng is None:
        return None

    match = _match_category(tags)
    if match is None:
        return None
    slug, cat_name, icon = match

    # Compose a single-line address from OSM address fields, best-effort.
    addr_parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:suburb") or tags.get("addr:neighbourhood"),
        tags.get("addr:city"),
    ]
    address = ", ".join(p for p in addr_parts if p) or None

    return OsmPlace(
        osm_id=f"{element.get('type', 'node')}/{element.get('id')}",
        name=name,
        category_slug=slug,
        category_name=cat_name,
        category_icon=icon,
        lat=float(lat),
        lng=float(lng),
        phone=tags.get("phone") or tags.get("contact:phone"),
        address=address,
        website=tags.get("website") or tags.get("contact:website"),
    )


async def _fetch_overpass(
    lat: float, lng: float, radius_m: int, category_slug: str | None
) -> list[OsmPlace]:
    query = _build_query(lat, lng, radius_m, category_slug)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "smart-city-mvp/0.1 (+https://smart-city-x4qb.onrender.com)"},
        )
        resp.raise_for_status()
        data = resp.json()

    places: dict[str, OsmPlace] = {}
    for element in data.get("elements", []):
        parsed = _parse_element(element, lat, lng)
        if parsed is None:
            continue
        # Deduplicate if Overpass returns node+way for the same entity.
        places.setdefault(f"{parsed.category_slug}:{parsed.name}:{round(parsed.lat,4)}", parsed)
    return list(places.values())


async def nearby_places(
    lat: float,
    lng: float,
    radius_m: int = 3000,
    category_slug: str | None = None,
) -> list[OsmPlace]:
    """Return OSM POIs around (lat, lng) within radius_m, cached for 10 min.

    When `category_slug` is a known slug, the upstream Overpass query is
    narrowed so the whole result budget is spent on just that category. The
    cache key includes the slug so narrow and broad queries don't evict
    each other.

    Raises on upstream failure so callers can decide whether to degrade.
    """
    key = _round_key(lat, lng, radius_m, category_slug)
    now = time.monotonic()

    async with _cache_lock:
        cached = _cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

    places = await _fetch_overpass(lat, lng, radius_m, category_slug)

    # Sort by distance for stable ordering.
    places.sort(key=lambda p: haversine_km(lat, lng, p.lat, p.lng))

    async with _cache_lock:
        _cache[key] = (now + _CACHE_TTL_SECONDS, places)
    return places
