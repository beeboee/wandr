from __future__ import annotations

import json
import logging
import time
from hashlib import sha1
from pathlib import Path
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)

LOCAL_GRAPH_SCHEMA_VERSION = 1

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]

USER_AGENT = "HomeAssistant-wandr/1.1.2"


def graph_cache_dir(hass) -> Path:
    return Path(hass.config.path("wandr/graph_cache"))


def graph_cache_key(lat: float, lon: float, radius: int) -> str:
    # Round enough to avoid meaningless cache misses while still being location-specific.
    signature = f"{round(lat, 5)}|{round(lon, 5)}|{int(radius)}"
    return sha1(signature.encode("utf-8")).hexdigest()[:16]


def graph_cache_path(hass, lat: float, lon: float, radius: int) -> Path:
    return graph_cache_dir(hass) / f"graph_{graph_cache_key(lat, lon, radius)}.json"


def build_overpass_query(lat: float, lon: float, radius: int) -> str:
    return f"""
    [out:json][timeout:90];
    (
      way["highway"](around:{int(radius)},{lat},{lon})
        ["highway"!~"motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway"]
        ["access"!~"private|no"]
        ["foot"!~"no"];
    );
    out body;
    >;
    out skel qt;
    """


async def async_get_local_walking_graph_data(
    hass,
    lat: float,
    lon: float,
    radius: int,
    *,
    force_refresh: bool = False,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return cached OSM walking graph data, fetching once when needed.

    This stores the raw Overpass result locally. Route generation can then parse
    the same local walking graph repeatedly without hitting Overpass again.
    """

    path = graph_cache_path(hass, lat, lon, radius)

    if not force_refresh:
        cached = await _async_read_cache(hass, path)
        if cached is not None:
            data = cached["data"]
            return data, {
                "status": "cache_hit",
                "path": str(path),
                "created_at": cached.get("created_at"),
                "source_url": cached.get("source_url"),
                "radius_meters": cached.get("radius_meters"),
                "element_count": len(data.get("elements", [])),
            }

    data, source_url = await _async_fetch_overpass(lat, lon, radius)

    payload = {
        "schema_version": LOCAL_GRAPH_SCHEMA_VERSION,
        "created_at": int(time.time()),
        "center": {
            "lat": lat,
            "lon": lon,
        },
        "radius_meters": int(radius),
        "source_url": source_url,
        "element_count": len(data.get("elements", [])),
        "data": data,
    }

    await _async_write_cache(hass, path, payload)

    return data, {
        "status": "fetched",
        "path": str(path),
        "created_at": payload["created_at"],
        "source_url": source_url,
        "radius_meters": int(radius),
        "element_count": payload["element_count"],
    }


async def _async_read_cache(hass, path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None

    try:
        text = await hass.async_add_executor_job(path.read_text, "utf-8")
        payload = json.loads(text)

        if payload.get("schema_version") != LOCAL_GRAPH_SCHEMA_VERSION:
            return None

        data = payload.get("data")
        if not isinstance(data, dict) or not isinstance(data.get("elements"), list):
            return None

        return payload
    except Exception as err:
        _LOGGER.warning("wandr could not read local graph cache %s: %s", path, err)
        return None


async def _async_write_cache(hass, path: Path, payload: dict[str, Any]) -> None:
    def write() -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, separators=(",", ":")), "utf-8")

    await hass.async_add_executor_job(write)


async def _async_fetch_overpass(lat: float, lon: float, radius: int) -> tuple[dict[str, Any], str]:
    query = build_overpass_query(lat, lon, radius)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }

    last_error: Exception | None = None

    async with aiohttp.ClientSession(headers=headers) as session:
        for url in OVERPASS_URLS:
            try:
                async with session.post(url, data={"data": query}, timeout=150) as resp:
                    body = None

                    if resp.status in (429, 502, 503, 504):
                        body = await resp.text()
                        last_error = RuntimeError(f"Overpass HTTP {resp.status}: {body[:220]}")
                        _LOGGER.warning("wandr Overpass endpoint failed: %s returned HTTP %s", url, resp.status)
                        continue

                    resp.raise_for_status()
                    data = await resp.json()

                    if not isinstance(data, dict) or not isinstance(data.get("elements"), list):
                        raise RuntimeError(f"Overpass returned invalid data from {url}")

                    return data, url

            except Exception as err:
                last_error = err
                _LOGGER.warning("wandr Overpass endpoint failed: %s: %s", url, err)
                continue

    raise RuntimeError(
        "Could not fetch local walking graph from any Overpass endpoint. "
        f"Last error: {last_error or 'unknown error'}"
    )
