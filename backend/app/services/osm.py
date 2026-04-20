"""Overpass-backed OpenStreetMap POI lookups.

Fetches real-world businesses (restaurants, banks, hospitals, pharmacies,
police stations, schools, etc.) within a radius of a given point, maps each
OSM feature to one of our internal category slugs, and caches the result in
process memory so we don't hammer the public Overpass endpoint.

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


# In-process cache: { (round_lat, round_lng, radius_m): (expires_at, places) }
_cache: dict[tuple[float, float, int], tuple[float, list[OsmPlace]]] = {}
_cache_lock = asyncio.Lock()


# Mapping table: ordered so the first match wins when a node has multiple
# tags (e.g. a pharmacy inside a shop). Each entry is
# (tag_key, matching_values, slug, name, icon).
_TAG_RULES: list[tuple[str, set[str], str, str, str]] = [
    # Safety / emergency first — most important for SOS context
    ("amenity", {"police"}, "safety", "Police", "👮"),
    ("amenity", {"fire_station"}, "safety", "Fire Station", "🚒"),
    ("amenity", {"hospital"}, "health", "Hospital", "🏥"),
    ("amenity", {"clinic", "doctors", "dentist"}, "health", "Clinic", "⚕️"),
    ("amenity", {"pharmacy"}, "health", "Pharmacy", "💊"),
    ("healthcare", {"*"}, "health", "Healthcare", "⚕️"),
    # Food / groceries
    ("amenity", {"restaurant"}, "food", "Restaurant", "🍽️"),
    ("amenity", {"cafe"}, "food", "Café", "☕"),
    ("amenity", {"fast_food"}, "food", "Fast food", "🍔"),
    ("amenity", {"bar", "pub", "biergarten"}, "food", "Bar / Pub", "🍺"),
    ("amenity", {"food_court"}, "food", "Food court", "🍱"),
    ("shop", {"supermarket"}, "food", "Supermarket", "🛒"),
    ("shop", {"convenience"}, "food", "Convenience store", "🏪"),
    ("shop", {"bakery"}, "food", "Bakery", "🥖"),
    ("shop", {"butcher", "greengrocer", "seafood"}, "food", "Grocery", "🥗"),
    # Finance
    ("amenity", {"bank"}, "finance", "Bank", "🏦"),
    ("amenity", {"atm"}, "finance", "ATM", "🏧"),
    ("amenity", {"bureau_de_change"}, "finance", "Currency exchange", "💱"),
    # Transport
    ("amenity", {"taxi"}, "transport", "Taxi stand", "🚖"),
    ("amenity", {"bus_station"}, "transport", "Bus station", "🚌"),
    ("amenity", {"fuel"}, "transport", "Fuel station", "⛽"),
    ("amenity", {"charging_station"}, "transport", "EV charging", "🔌"),
    ("railway", {"station", "subway_entrance"}, "transport", "Train station", "🚆"),
    # Education
    ("amenity", {"school"}, "education", "School", "🏫"),
    ("amenity", {"college", "university"}, "education", "University", "🎓"),
    ("amenity", {"library"}, "education", "Library", "📚"),
    ("amenity", {"kindergarten"}, "education", "Kindergarten", "🧸"),
    # Municipal
    ("amenity", {"townhall", "courthouse"}, "municipal", "Municipal office", "🏛️"),
    ("amenity", {"post_office"}, "municipal", "Post office", "📮"),
    ("office", {"government"}, "municipal", "Government office", "🏛️"),
    # Leisure
    ("amenity", {"cinema"}, "leisure", "Cinema", "🎬"),
    ("amenity", {"theatre"}, "leisure", "Theatre", "🎭"),
    ("amenity", {"nightclub"}, "leisure", "Nightclub", "🎶"),
    ("leisure", {"park"}, "leisure", "Park", "🌳"),
    ("leisure", {"fitness_centre", "sports_centre"}, "leisure", "Gym", "🏋️"),
    # Home / trades
    ("shop", {"hardware", "doityourself", "electrical"}, "home", "Hardware shop", "🛠️"),
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


def _round_key(lat: float, lng: float, radius_m: int) -> tuple[float, float, int]:
    """Round to ~1km precision so nearby callers share a cache entry."""
    return (round(lat, 2), round(lng, 2), radius_m)


def _build_query(lat: float, lng: float, radius_m: int) -> str:
    """Single Overpass QL query that returns all POI kinds we care about."""
    selectors = [
        'node["amenity"~"^(police|fire_station|hospital|clinic|doctors|dentist|pharmacy|'
        "restaurant|cafe|fast_food|bar|pub|biergarten|food_court|bank|atm|"
        "bureau_de_change|taxi|bus_station|fuel|charging_station|school|college|"
        'university|library|kindergarten|townhall|courthouse|post_office|cinema|theatre|nightclub)$"]',
        'node["shop"~"^(supermarket|convenience|bakery|butcher|greengrocer|seafood|hardware|'
        'doityourself|electrical)$"]',
        'node["healthcare"]',
        'node["office"="government"]',
        'node["railway"~"^(station|subway_entrance)$"]',
        'node["leisure"~"^(park|fitness_centre|sports_centre)$"]',
    ]
    bbox = f"(around:{radius_m},{lat},{lng})"
    body = ";\n  ".join(s + bbox for s in selectors)
    return f"""[out:json][timeout:25];
(
  {body};
);
out tags center 200;
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


async def _fetch_overpass(lat: float, lng: float, radius_m: int) -> list[OsmPlace]:
    query = _build_query(lat, lng, radius_m)
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
) -> list[OsmPlace]:
    """Return OSM POIs around (lat, lng) within radius_m, cached for 10 min.

    Raises on upstream failure so callers can decide whether to degrade.
    """
    key = _round_key(lat, lng, radius_m)
    now = time.monotonic()

    async with _cache_lock:
        cached = _cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

    places = await _fetch_overpass(lat, lng, radius_m)

    # Sort by distance for stable ordering.
    places.sort(key=lambda p: haversine_km(lat, lng, p.lat, p.lng))

    async with _cache_lock:
        _cache[key] = (now + _CACHE_TTL_SECONDS, places)
    return places
