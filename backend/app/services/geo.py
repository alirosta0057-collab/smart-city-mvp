from __future__ import annotations

import math
from dataclasses import dataclass

import httpx

from app.core.config import settings


@dataclass
class GeoLocation:
    lat: float
    lng: float
    city: str | None = None
    country: str | None = None


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance in km between two points on Earth using the haversine formula."""
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return radius_km * c


_LOCAL_DEFAULT = GeoLocation(lat=35.6892, lng=51.3890, city="Tehran", country="Iran")


def _is_private_ip(ip: str) -> bool:
    if not ip:
        return True
    if ip in ("127.0.0.1", "::1", "localhost"):
        return True
    parts = ip.split(".")
    if len(parts) == 4:
        try:
            p0, p1 = int(parts[0]), int(parts[1])
        except ValueError:
            return False
        if p0 == 10:
            return True
        if p0 == 172 and 16 <= p1 <= 31:
            return True
        if p0 == 192 and p1 == 168:
            return True
    return False


async def locate_by_ip(ip: str) -> GeoLocation:
    """Best-effort IP geolocation using ip-api.com (no key required, free tier).

    Falls back to a sensible default for loopback/private addresses.
    """
    if _is_private_ip(ip):
        return _LOCAL_DEFAULT

    url = f"http://ip-api.com/json/{ip}?fields=status,city,country,lat,lon"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url)
            data = resp.json()
            if data.get("status") == "success":
                return GeoLocation(
                    lat=float(data["lat"]),
                    lng=float(data["lon"]),
                    city=data.get("city"),
                    country=data.get("country"),
                )
    except Exception:  # noqa: BLE001 - external service; always degrade gracefully
        pass
    return _LOCAL_DEFAULT


def extract_client_ip(headers: dict[str, str], fallback: str = "") -> str:
    xff = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    real_ip = headers.get("x-real-ip") or headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return fallback


# Keep the settings import referenced so it doesn't become an orphan if we add providers later.
_ = settings
