"""Real-world places endpoint backed by OpenStreetMap (Overpass API).

Unlike `/api/businesses` (which serves admin-curated seed data), this route
returns live POIs around the requester's current position. It is the primary
source for the citizen dashboard map & nearby list.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.deps import CurrentUser
from app.services.geo import haversine_km
from app.services.osm import nearby_places

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/places", tags=["places"])


class PlaceCategory(BaseModel):
    slug: str
    name: str
    icon: str


class NearbyPlace(BaseModel):
    id: str = Field(description="Stable OSM identifier, e.g. 'node/1234567'")
    name: str
    description: str | None = None
    phone: str | None = None
    address: str | None = None
    website: str | None = None
    lat: float
    lng: float
    category: PlaceCategory
    distance_km: float


@router.get("/nearby", response_model=list[NearbyPlace])
async def list_nearby_places(
    user: CurrentUser,
    lat: float | None = Query(
        default=None,
        ge=-90,
        le=90,
        description="Latitude. Falls back to the user's saved profile location.",
    ),
    lng: float | None = Query(
        default=None,
        ge=-180,
        le=180,
    ),
    radius_m: int = Query(default=3000, ge=200, le=10000),
    category_slug: str | None = Query(default=None),
    limit: int = Query(default=60, ge=1, le=200),
) -> list[NearbyPlace]:
    origin_lat = lat if lat is not None else user.lat
    origin_lng = lng if lng is not None else user.lng
    if origin_lat is None or origin_lng is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No location available. Send lat/lng or call /api/auth/locate first.",
        )

    try:
        places = await nearby_places(origin_lat, origin_lng, radius_m)
    except Exception as exc:  # noqa: BLE001 — external service, report cleanly
        logger.warning("Overpass lookup failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenStreetMap (Overpass) is temporarily unavailable. Try again in a moment.",
        ) from exc

    results: list[NearbyPlace] = []
    for p in places:
        if category_slug and p.category_slug != category_slug:
            continue
        results.append(
            NearbyPlace(
                id=p.osm_id,
                name=p.name,
                phone=p.phone,
                address=p.address,
                website=p.website,
                lat=p.lat,
                lng=p.lng,
                category=PlaceCategory(
                    slug=p.category_slug, name=p.category_name, icon=p.category_icon
                ),
                distance_km=round(haversine_km(origin_lat, origin_lng, p.lat, p.lng), 2),
            )
        )
    results.sort(key=lambda r: r.distance_km)
    return results[:limit]
