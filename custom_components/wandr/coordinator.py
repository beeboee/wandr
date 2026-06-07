from __future__ import annotations

import heapq
import html
import json
import logging
import math
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import (
    DOMAIN,
    STORAGE_KEY,
    STORAGE_VERSION,
    DEFAULT_RADIUS_METERS,
    DEFAULT_START_ADDRESS,
    DEFAULT_WALKING_MINUTES_PER_MILE,
    DEFAULT_AB_EXTRA_MODE,
    DEFAULT_AB_EXTRA_PERCENT,
    DEFAULT_AB_EXTRA_MILES,
    DEFAULT_AB_EXTRA_MINUTES,
    DEFAULT_AB_FINISH_TIME,
    A_TO_B_GOAL_MODES,
    DEFAULT_AUTO_PICK_DAILY_ROUTE,
    DEFAULT_DAILY_PICK_TIME,
    DEFAULT_ROUTE_STYLE,
    ROUTE_STYLES,
    DEFAULT_ALLOW_RELAXED_FALLBACK,
)

_LOGGER = logging.getLogger(__name__)
M_PER_MILE = 1609.344
OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.ru/api/interpreter",
]
OVERPASS_URL = OVERPASS_URLS[0]
ELEVATION_URL = "https://api.opentopodata.org/v1/ned10m"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


@dataclass
class Edge:
    to: int
    length: float
    name: str
    highway: str = ""


class WandrCoordinator(DataUpdateCoordinator):
    def __init__(self, hass: HomeAssistant, entry) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN)
        self.entry = entry
        self.store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._daily_unsub = None
        self.state: dict[str, Any] = {
            "routes": [],
            "current_index": 0,
            "blacklist": "",
            "blocked_sections": [],
            "selected_blocked_section": "",
            "feedback_street": "",
            "feedback_from_cross": "",
            "feedback_to_cross": "",
            "last_error": "",
            "network_node_count": 0,
            "start_address": "",
            "end_address": "",
            "loop_route": True,
            "walking_minutes_per_mile": DEFAULT_WALKING_MINUTES_PER_MILE,
            "ab_extra_mode": DEFAULT_AB_EXTRA_MODE,
            "ab_extra_percent": DEFAULT_AB_EXTRA_PERCENT,
            "ab_extra_miles": DEFAULT_AB_EXTRA_MILES,
            "ab_extra_minutes": DEFAULT_AB_EXTRA_MINUTES,
            "ab_finish_time": DEFAULT_AB_FINISH_TIME,
            "optimal_distance_miles": None,
            "a_to_b_target_distance_miles": None,
            "extra_distance_miles": None,
            "finish_by_available_minutes": None,
            "finish_by_target_distance_miles": None,
            "auto_pick_daily_route": DEFAULT_AUTO_PICK_DAILY_ROUTE,
            "daily_pick_time": DEFAULT_DAILY_PICK_TIME,
            "today_date": None,
            "today_route_index": None,
            "today_completed": False,
            "today_skipped": False,
            "history": [],
            "route_style": DEFAULT_ROUTE_STYLE,
            "allow_relaxed_fallback": DEFAULT_ALLOW_RELAXED_FALLBACK,
            "validation_warnings": [],
            "generation_status": "Not generated yet",
            "last_generation_summary": "",
        }

    async def async_load(self) -> None:
        stored = await self.store.async_load()
        if stored:
            self.state.update(stored)
        self._setup_daily_timer()
        await self._write_artifacts()
        self.async_set_updated_data(self.state)

    async def _async_update_data(self):
        return self.state

    async def save(self):
        await self.store.async_save(self.state)
        await self._write_artifacts()
        self.async_set_updated_data(self.state)

    def _setup_daily_timer(self):
        if self._daily_unsub:
            self._daily_unsub()
            self._daily_unsub = None
        hh, mm, ss = parse_time_parts(self.state.get("daily_pick_time") or DEFAULT_DAILY_PICK_TIME)
        self._daily_unsub = async_track_time_change(
            self.hass,
            self._daily_timer_fired,
            hour=hh,
            minute=mm,
            second=ss,
        )

    async def _daily_timer_fired(self, now):
        if self.state.get("auto_pick_daily_route"):
            await self.pick_daily_route(force=False)

    async def shutdown(self):
        if self._daily_unsub:
            self._daily_unsub()
            self._daily_unsub = None

    @property
    def current_route(self) -> dict[str, Any]:
        routes = self.state.get("routes") or []
        if not routes:
            return {}
        idx = self.state.get("current_index", 0) % len(routes)
        return routes[idx]

    def today_iso(self) -> str:
        return date.today().isoformat()

    def normalize_goal_mode(self, mode: Any) -> str:
        mapping = {
            "total": "Desired total distance",
            "distance": "Distance over optimal",
            "extra_distance": "Distance over optimal",
            "percent": "Percent over optimal",
            "minutes": "Time over optimal",
            "time": "Time over optimal",
            "arrive_by": "Finish by time",
            "arrival_time": "Finish by time",
            "finish_by": "Finish by time",
        }
        if mode in A_TO_B_GOAL_MODES:
            return mode
        if isinstance(mode, str):
            return mapping.get(mode.strip().lower(), DEFAULT_AB_EXTRA_MODE)
        return DEFAULT_AB_EXTRA_MODE

    async def pick_daily_route(self, *, force: bool = True):
        routes = self.state.get("routes") or []
        if not routes:
            self.state["last_error"] = "No generated routes. Press Generate Routes first."
            await self.save()
            return
        today = self.today_iso()
        if not force and self.state.get("today_date") == today:
            return
        last_index = int(self.state.get("today_route_index") or self.state.get("current_index") or 0)
        next_index = (last_index + 1) % len(routes)
        self.state["today_date"] = today
        self.state["today_route_index"] = next_index
        self.state["current_index"] = next_index
        self.state["today_completed"] = False
        self.state["today_skipped"] = False
        await self.save()

    async def mark_completed(self):
        await self._record_today(status="completed")

    async def skip_today(self):
        await self._record_today(status="skipped")

    async def _record_today(self, status: str):
        route = self.current_route
        if not route:
            return
        today = self.today_iso()
        self.state["today_date"] = today
        self.state["today_route_index"] = self.state.get("current_index", 0)
        self.state["today_completed"] = status == "completed"
        self.state["today_skipped"] = status == "skipped"
        history = [h for h in self.state.get("history", []) if h.get("date") != today]
        history.append({
            "date": today,
            "route_name": route.get("name"),
            "route_index": self.state.get("current_index", 0),
            "distance_miles": route.get("distance_miles"),
            "duration_minutes": route.get("duration_minutes"),
            "mode": route.get("mode"),
            "status": status,
        })
        self.state["history"] = sorted(history, key=lambda x: x.get("date", ""))[-730:]
        await self.save()

    async def next_route(self):
        if self.state.get("routes"):
            self.state["current_index"] = (self.state.get("current_index", 0) + 1) % len(self.state["routes"])
            await self.save()

    async def previous_route(self):
        if self.state.get("routes"):
            self.state["current_index"] = (self.state.get("current_index", 0) - 1) % len(self.state["routes"])
            await self.save()

    async def random_route(self):
        if self.state.get("routes"):
            self.state["current_index"] = random.randrange(0, len(self.state["routes"]))
            await self.save()

    async def update_option(self, key: str, value: Any, *, regenerate: bool = False):
        self.state[key] = value
        new_data = dict(self.entry.data)
        new_data[key] = value
        self.hass.config_entries.async_update_entry(self.entry, data=new_data)
        if key == "daily_pick_time":
            self._setup_daily_timer()
        if regenerate:
            await self.generate_year()
        else:
            await self.save()

    async def set_blacklist(self, blacklist: str):
        self.state["blacklist"] = blacklist or ""
        await self.generate_year()

    async def set_a_to_b_deviation(self, mode: str, percent: float | None = None, minutes: int | None = None, total_miles: float | None = None, extra_miles: float | None = None, finish_time: str | None = None):
        mode = self.normalize_goal_mode(mode)
        self.state["ab_extra_mode"] = mode
        if total_miles is not None:
            self.state["target_miles"] = float(total_miles)
        if extra_miles is not None:
            self.state["ab_extra_miles"] = float(extra_miles)
        if percent is not None:
            self.state["ab_extra_percent"] = float(percent)
        if minutes is not None:
            self.state["ab_extra_minutes"] = int(minutes)
        if finish_time is not None:
            self.state["ab_finish_time"] = str(finish_time)
        new_data = dict(self.entry.data)
        new_data["ab_extra_mode"] = mode
        if total_miles is not None:
            new_data["target_miles"] = float(total_miles)
        if extra_miles is not None:
            new_data["ab_extra_miles"] = float(extra_miles)
        if percent is not None:
            new_data["ab_extra_percent"] = float(percent)
        if minutes is not None:
            new_data["ab_extra_minutes"] = int(minutes)
        if finish_time is not None:
            new_data["ab_finish_time"] = str(finish_time)
        self.hass.config_entries.async_update_entry(self.entry, data=new_data)
        await self.generate_year()

    async def add_blocked_section(self):
        street = (self.state.get("feedback_street") or "").strip()
        if not street:
            route = self.current_route
            names = route.get("street_names") or []
            street = names[0] if names else ""
        if not street:
            self.state["last_error"] = "Pick or enter a street name first."
            await self.save()
            return
        item = {
            "street": street,
            "from": (self.state.get("feedback_from_cross") or "").strip(),
            "to": (self.state.get("feedback_to_cross") or "").strip(),
        }
        sections = self.state.get("blocked_sections") or []
        label = section_label(item)
        if all(section_label(existing) != label for existing in sections):
            sections.append(item)
        self.state["blocked_sections"] = sections
        self.state["selected_blocked_section"] = label
        self.state["last_error"] = ""
        self.state["generation_status"] = "Avoid rule saved"
        self.state["last_generation_summary"] = "Avoid rule saved. Press Regenerate to rebuild routes around it."
        await self.save()

    async def remove_selected_blocked_section(self):
        selected = self.state.get("selected_blocked_section") or ""
        sections = self.state.get("blocked_sections") or []
        self.state["blocked_sections"] = [s for s in sections if section_label(s) != selected]
        self.state["selected_blocked_section"] = ""
        self.state["last_error"] = ""
        self.state["generation_status"] = "Avoid rule removed"
        self.state["last_generation_summary"] = "Avoid rule removed. Press Regenerate to rebuild routes around the updated list."
        await self.save()

    async def clear_history(self):
        self.state["history"] = []
        self.state["today_completed"] = False
        self.state["today_skipped"] = False
        await self.save()

    async def export_settings(self):
        await self.save()

    async def import_settings(self):
        path = Path(self.hass.config.path("www/wandr/settings_import.json"))
        try:
            imported = await self.hass.async_add_executor_job(path.read_text, "utf-8")
            data = json.loads(imported)
            if not isinstance(data, dict):
                raise RuntimeError("settings_import.json must contain a JSON object.")
            allowed = exportable_settings(self.state).keys()
            for key in allowed:
                if key in data:
                    self.state[key] = data[key]
            new_data = dict(self.entry.data)
            new_data.update({k: self.state.get(k) for k in allowed})
            self.hass.config_entries.async_update_entry(self.entry, data=new_data)
            self.state["last_error"] = "Imported settings. Press Generate Routes to apply routing changes."
            await self.save()
        except Exception as err:
            self.state["last_error"] = f"Settings import failed: {err}"
            await self.save()

    async def generate_year(self):
        cfg = self.entry.data
        def opt(key, default=None):
            value = self.state.get(key)
            return value if value not in (None, "") else cfg.get(key, default)

        start_address = opt("start_address", DEFAULT_START_ADDRESS) or DEFAULT_START_ADDRESS
        loop_route = bool(opt("loop_route", True))
        end_address = start_address if loop_route else (opt("end_address", start_address) or start_address)
        configured_target_m = float(opt("target_miles", 3.0)) * M_PER_MILE
        walking_minutes_per_mile = float(opt("walking_minutes_per_mile", DEFAULT_WALKING_MINUTES_PER_MILE))
        ab_extra_mode = self.normalize_goal_mode(opt("ab_extra_mode", DEFAULT_AB_EXTRA_MODE))
        ab_extra_percent = float(opt("ab_extra_percent", DEFAULT_AB_EXTRA_PERCENT))
        ab_extra_miles = float(opt("ab_extra_miles", DEFAULT_AB_EXTRA_MILES))
        ab_extra_minutes = int(opt("ab_extra_minutes", DEFAULT_AB_EXTRA_MINUTES))
        ab_finish_time = opt("ab_finish_time", DEFAULT_AB_FINISH_TIME)
        requested_count = int(opt("route_count", 183))
        route_style = normalize_route_style(opt("route_style", DEFAULT_ROUTE_STYLE))
        allow_relaxed_fallback = bool(opt("allow_relaxed_fallback", DEFAULT_ALLOW_RELAXED_FALLBACK))
        warnings: list[str] = []
        blacklist = [x.strip().lower() for x in (self.state.get("blacklist") or "").split(",") if x.strip()]
        blocked_sections = self.state.get("blocked_sections") or []

        try:
            start_lat, start_lon = await self._geocode(start_address)
            if loop_route:
                end_lat, end_lon = start_lat, start_lon
            else:
                end_lat, end_lon = await self._geocode(end_address)

            straight_m = haversine(start_lat, start_lon, end_lat, end_lon)
            center_lat = (start_lat + end_lat) / 2
            center_lon = (start_lon + end_lon) / 2
            radius = min(9000, max(DEFAULT_RADIUS_METERS, int(straight_m / 2 + DEFAULT_RADIUS_METERS)))

            graph, coords, start_node, end_node = await self._download_graph(
                center_lat, center_lon, radius, blacklist, blocked_sections,
                start_lat, start_lon, end_lat, end_lon,
            )

            optimal_m = None
            extra_m = None
            if loop_route:
                target_m = configured_target_m
            else:
                optimal_route, _ = shortest_path(graph, start_node, end_node)
                if not optimal_route:
                    raise RuntimeError("Could not find a walkable route between the start and end addresses. Try removing avoided streets/sections.")
                optimal_m = route_len(graph, optimal_route)
                if ab_extra_mode == "Desired total distance":
                    target_m = configured_target_m
                    if target_m + (0.05 * M_PER_MILE) < optimal_m:
                        raise RuntimeError(
                            f"Desired total A-to-B distance ({target_m / M_PER_MILE:.2f} mi) is shorter than the optimal walking route ({optimal_m / M_PER_MILE:.2f} mi). Increase desired total miles or choose closer endpoints."
                        )
                    target_m = max(target_m, optimal_m)
                    extra_m = max(0, target_m - optimal_m)
                    self.state["finish_by_available_minutes"] = None
                    self.state["finish_by_target_distance_miles"] = None
                elif ab_extra_mode == "Distance over optimal":
                    extra_m = max(0.0, ab_extra_miles) * M_PER_MILE
                    target_m = optimal_m + extra_m
                    self.state["finish_by_available_minutes"] = None
                    self.state["finish_by_target_distance_miles"] = None
                elif ab_extra_mode == "Time over optimal":
                    extra_m = max(0, ab_extra_minutes) * (M_PER_MILE / max(walking_minutes_per_mile, 1))
                    target_m = optimal_m + extra_m
                    self.state["finish_by_available_minutes"] = None
                    self.state["finish_by_target_distance_miles"] = None
                elif ab_extra_mode == "Finish by time":
                    now = dt_util.now()
                    hh, mm, ss = parse_time_parts(ab_finish_time or DEFAULT_AB_FINISH_TIME)
                    finish_at = now.replace(hour=hh, minute=mm, second=ss, microsecond=0)
                    if finish_at <= now:
                        raise RuntimeError("Finish-by time has already passed today. Choose a later finish time, or use another A-to-B goal mode.")
                    available_minutes = (finish_at - now).total_seconds() / 60
                    target_m = (available_minutes / max(walking_minutes_per_mile, 1)) * M_PER_MILE
                    if target_m + (0.05 * M_PER_MILE) < optimal_m:
                        raise RuntimeError(
                            f"There is not enough time to walk from A to B by {ab_finish_time}. Optimal route is {optimal_m / M_PER_MILE:.2f} mi, but the time window only allows about {target_m / M_PER_MILE:.2f} mi at your selected pace."
                        )
                    extra_m = max(0, target_m - optimal_m)
                    self.state["finish_by_available_minutes"] = round(available_minutes)
                    self.state["finish_by_target_distance_miles"] = round(target_m / M_PER_MILE, 2)
                else:
                    extra_m = optimal_m * (max(0.0, ab_extra_percent) / 100.0)
                    target_m = optimal_m + extra_m
                    self.state["finish_by_available_minutes"] = None
                    self.state["finish_by_target_distance_miles"] = None

            seed_source = build_seed_source(
                start_address,
                end_address,
                "loop" if loop_route else "a-to-b",
                route_style,
                requested_count,
                round(target_m, 2),
                walking_minutes_per_mile,
            )

            self.state["network_node_count"] = len(coords)
            routes = await self.hass.async_add_executor_job(
                self._generate_routes_sync, graph, coords, start_node, end_node,
                target_m, requested_count, loop_route, walking_minutes_per_mile,
                route_style, allow_relaxed_fallback, warnings, seed_source,
            )
            routes = await self._add_elevation(routes)
            self.state["routes"] = routes
            self.state["current_index"] = 0
            self.state["last_error"] = ""
            self.state["start_address"] = start_address
            self.state["end_address"] = end_address
            self.state["loop_route"] = loop_route
            self.state["walking_minutes_per_mile"] = walking_minutes_per_mile
            self.state["ab_extra_mode"] = ab_extra_mode
            self.state["ab_extra_percent"] = ab_extra_percent
            self.state["ab_extra_miles"] = ab_extra_miles
            self.state["ab_extra_minutes"] = ab_extra_minutes
            self.state["ab_finish_time"] = ab_finish_time
            self.state["optimal_distance_miles"] = round(optimal_m / M_PER_MILE, 2) if optimal_m is not None else None
            self.state["a_to_b_target_distance_miles"] = round(target_m / M_PER_MILE, 2) if not loop_route else None
            self.state["extra_distance_miles"] = round(extra_m / M_PER_MILE, 2) if extra_m is not None else None
            self.state["start_coords"] = [round(start_lat, 6), round(start_lon, 6)]
            self.state["end_coords"] = [round(end_lat, 6), round(end_lon, 6)]
            self.state["today_completed"] = False
            self.state["today_skipped"] = False
            self.state["route_style"] = route_style
            self.state["allow_relaxed_fallback"] = allow_relaxed_fallback
            self.state["validation_warnings"] = warnings
            self.state["generation_status"] = "OK" if not warnings else "Generated with warnings"
            self.state["last_generation_summary"] = f"Generated {len(routes)} routes around {round(target_m / M_PER_MILE, 2)} mi using {route_style}."
        except Exception as err:
            _LOGGER.exception("wandr generation failed")
            friendly = friendly_error_message(err)
            self.state["last_error"] = friendly
            self.state["generation_status"] = "Error"
            self.state["validation_warnings"] = [friendly]
        await self.save()

    async def _geocode(self, address: str) -> tuple[float, float]:
        async with aiohttp.ClientSession(headers={"User-Agent": "HomeAssistant-wandr/0.7"}) as session:
            async with session.get(NOMINATIM_URL, params={"q": address, "format": "json", "limit": 1}, timeout=30) as resp:
                resp.raise_for_status()
                data = await resp.json()
        if not data:
            raise RuntimeError(f"Could not geocode address: {address}")
        return float(data[0]["lat"]), float(data[0]["lon"])

    async def _download_graph(self, lat: float, lon: float, radius: int, blacklist: list[str], blocked_sections: list[dict[str, str]], start_lat: float, start_lon: float, end_lat: float, end_lon: float):
        query = f"""
        [out:json][timeout:40];
        (
          way["highway"](around:{radius},{lat},{lon})
            ["highway"!~"motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway"]
            ["access"!~"private|no"]
            ["foot"!~"no"];
        );
        out body;
        >;
        out skel qt;
        """
        data = None
        last_error: Exception | None = None
        headers = {"User-Agent": "HomeAssistant-wandr/1.0"}
        async with aiohttp.ClientSession(headers=headers) as session:
            for url in OVERPASS_URLS:
                try:
                    async with session.post(url, data={"data": query}, timeout=75) as resp:
                        if resp.status in (429, 502, 503, 504):
                            body = await resp.text()
                            last_error = RuntimeError(f"Overpass HTTP {resp.status}: {body[:180]}")
                            _LOGGER.warning("wandr Overpass endpoint failed: %s returned HTTP %s", url, resp.status)
                            continue
                        resp.raise_for_status()
                        data = await resp.json()
                        break
                except Exception as err:
                    last_error = err
                    _LOGGER.warning("wandr Overpass endpoint failed: %s: %s", url, err)
                    continue
        if data is None:
            raise RuntimeError(
                "Map data service is busy or rate-limited. Wait 15-30 minutes, then press Generate once. "
                f"Last Overpass error: {friendly_error_message(last_error) if last_error else 'unknown error'}"
            )

        nodes: dict[int, tuple[float, float]] = {}
        raw_ways: list[tuple[list[int], str, str]] = []
        for el in data.get("elements", []):
            if el.get("type") == "node":
                nodes[int(el["id"])] = (float(el["lat"]), float(el["lon"]))
            elif el.get("type") == "way":
                tags = el.get("tags", {})
                name = tags.get("name", "Unnamed path")
                highway = tags.get("highway", "")
                if any(b in name.lower() for b in blacklist):
                    continue
                raw_ways.append(([int(n) for n in el.get("nodes", [])], name, highway))

        node_streets: dict[int, set[str]] = {}
        for way_nodes, name, highway in raw_ways:
            if name and name != "Unnamed path":
                for n in way_nodes:
                    node_streets.setdefault(n, set()).add(name.lower())

        sections = [normalize_section(s) for s in blocked_sections]
        graph: dict[int, list[Edge]] = {n: [] for n in nodes}
        for way_nodes, name, highway in raw_ways:
            blocked_ranges = blocked_index_ranges(way_nodes, name, node_streets, sections)
            for idx, (a, b) in enumerate(zip(way_nodes[:-1], way_nodes[1:])):
                if a not in nodes or b not in nodes:
                    continue
                if edge_index_blocked(idx, blocked_ranges):
                    continue
                d = haversine(nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1])
                graph[a].append(Edge(b, d, name, highway))
                graph[b].append(Edge(a, d, name, highway))

        if not nodes:
            raise RuntimeError("No walkable street data returned. Try again later or increase radius in code.")
        start_node = min(nodes, key=lambda n: haversine(start_lat, start_lon, nodes[n][0], nodes[n][1]))
        end_node = min(nodes, key=lambda n: haversine(end_lat, end_lon, nodes[n][0], nodes[n][1]))
        return graph, nodes, start_node, end_node

    def _generate_routes_sync(self, graph, coords, start_node, end_node, target_m, requested_count, loop_route, walking_minutes_per_mile, route_style=DEFAULT_ROUTE_STYLE, allow_relaxed_fallback=True, warnings=None, seed_source=None):
        warnings = warnings if warnings is not None else []
        tolerance = 0.10 if allow_relaxed_fallback is not False else 0.20
        min_m = target_m * (1 - tolerance)
        max_m = target_m * (1 + tolerance)
        start_lat, start_lon = coords[start_node]
        end_lat, end_lon = coords[end_node]
        center_lat = (start_lat + end_lat) / 2
        center_lon = (start_lon + end_lon) / 2

        if loop_route:
            desired_base_count = requested_count
            waypoint_choices = [2, 3]
            candidates = [n for n, (la, lo) in coords.items() if 500 <= haversine(start_lat, start_lon, la, lo) <= 1800 and graph.get(n)]
        else:
            desired_base_count = requested_count * 2
            waypoint_choices = [0, 1, 2, 3]
            candidates = [n for n, (la, lo) in coords.items() if 250 <= haversine(center_lat, center_lon, la, lo) <= 2200 and graph.get(n) and n not in (start_node, end_node)]

        if len(candidates) < 20:
            raise RuntimeError("Not enough nearby walkable street nodes. Increase radius or remove avoid-list items.")

        accepted = []
        accepted_edges = []
        attempts = 0
        random.seed(seed_source or "wandr-route-generation")
        while len(accepted) < desired_base_count and attempts < 70000:
            attempts += 1
            waypoint_count = random.choice(waypoint_choices)
            waypoints = random.sample(candidates, waypoint_count) if waypoint_count else []
            points = [start_node] + waypoints + [end_node]
            route_nodes = []
            street_names = []
            ok = True
            for a, b in zip(points[:-1], points[1:]):
                segment, seg_names = shortest_path(graph, a, b)
                if not segment:
                    ok = False
                    break
                route_nodes += segment[1:] if route_nodes else segment
                street_names += seg_names
            if not ok:
                continue
            length = route_len(graph, route_nodes)
            if not (min_m <= length <= max_m):
                continue
            edges = route_edge_set(route_nodes)
            if any(overlap(edges, old) > 0.45 for old in accepted_edges):
                continue
            accepted.append({
                "base_id": len(accepted) + 1,
                "nodes": route_nodes,
                "coords": [[round(coords[n][0], 6), round(coords[n][1], 6)] for n in route_nodes],
                "distance_miles": round(length / M_PER_MILE, 2),
                "duration_minutes": round((length / M_PER_MILE) * walking_minutes_per_mile),
                "street_names": unique_keep_order(street_names),
                "directions": build_directions(graph, route_nodes),
                "quality_score": route_quality_score(graph, route_nodes, target_m, route_style),
                "route_style": route_style,
            })
            accepted_edges.append(edges)

        if not accepted and allow_relaxed_fallback:
            warnings.append("Strict route generation failed; relaxed distance tolerance to ±20% and retried.")
            return self._generate_routes_sync(graph, coords, start_node, end_node, target_m, requested_count, loop_route, walking_minutes_per_mile, route_style, False, warnings, seed_source)
        if not accepted:
            raise RuntimeError("No routes generated. Try clearing avoid items, increasing desired miles, choosing closer endpoints, or enabling relaxed fallback.")
        accepted.sort(key=lambda r: r.get("quality_score", 0), reverse=True)

        daily = []
        if loop_route:
            for route in accepted[:requested_count]:
                for suffix, direction, coords2 in [("A", "clockwise", route["coords"]), ("B", "counterclockwise", list(reversed(route["coords"])) )]:
                    daily.append(route_payload(route, coords2, f"Walk {route['base_id']:03d}{suffix}", "loop", direction))
        else:
            for route in accepted[:desired_base_count]:
                daily.append(route_payload(route, route["coords"], f"Walk {route['base_id']:03d}", "point-to-point", "start to end"))
        return daily

    async def _add_elevation(self, routes):
        for route in routes[:1]:
            try:
                samples = sample_coords(route["coords"], 24)
                locs = "|".join(f"{a},{b}" for a, b in samples)
                async with aiohttp.ClientSession() as session:
                    async with session.get(ELEVATION_URL, params={"locations": locs}, timeout=30) as resp:
                        if resp.status != 200:
                            return routes
                        data = await resp.json()
                elevations = [r.get("elevation") for r in data.get("results", []) if r.get("elevation") is not None]
                gain_m = sum(max(0, elevations[i] - elevations[i - 1]) for i in range(1, len(elevations)))
                route["elevation_gain_ft"] = round(gain_m * 3.28084)
                route["elevation_profile"] = elevations
            except Exception:
                return routes
        return routes

    async def _write_artifacts(self):
        www = Path(self.hass.config.path("www/wandr"))
        await self.hass.async_add_executor_job(lambda: www.mkdir(parents=True, exist_ok=True))
        route = self.current_route
        html_text = render_map_html(route)
        await self.hass.async_add_executor_job((www / "current_route.html").write_text, html_text, "utf-8")
        await self.hass.async_add_executor_job((www / "current_route.json").write_text, json.dumps(route, indent=2), "utf-8")
        await self.hass.async_add_executor_job((www / "history.json").write_text, json.dumps(self.state.get("history", []), indent=2), "utf-8")
        await self.hass.async_add_executor_job((www / "current_directions.html").write_text, render_directions_html(route), "utf-8")
        await self.hass.async_add_executor_job((www / "current_route.gpx").write_text, render_gpx(route), "utf-8")
        await self.hass.async_add_executor_job((www / "current_route.geojson").write_text, render_geojson(route), "utf-8")
        await self.hass.async_add_executor_job((www / "settings_export.json").write_text, json.dumps(exportable_settings(self.state), indent=2), "utf-8")

    def progress_stats(self) -> dict[str, Any]:
        history = self.state.get("history") or []
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)
        completed = [h for h in history if h.get("status") == "completed"]
        week_completed = [h for h in completed if parse_date(h.get("date")) and parse_date(h.get("date")) >= week_start]
        month_completed = [h for h in completed if parse_date(h.get("date")) and parse_date(h.get("date")) >= month_start]
        return {
            "week_completed": len(week_completed),
            "week_miles": round(sum(float(h.get("distance_miles") or 0) for h in week_completed), 2),
            "month_completed": len(month_completed),
            "month_miles": round(sum(float(h.get("distance_miles") or 0) for h in month_completed), 2),
            "current_streak": current_streak(history),
            "history_count": len(history),
        }


def route_payload(route, coords2, name, mode, direction):
    directions = route.get("directions", [])
    if coords2 != route.get("coords"):
        directions = list(reversed(directions))
    return {
        "name": name,
        "mode": mode,
        "direction": direction,
        "coords": coords2,
        "distance_miles": route["distance_miles"],
        "duration_minutes": route["duration_minutes"],
        "elevation_gain_ft": None,
        "street_names": route["street_names"],
        "directions": directions,
        "quality_score": route.get("quality_score"),
        "route_style": route.get("route_style"),
        "google_maps_url": google_url(coords2),
        "gpx_url": "/local/wandr/current_route.gpx",
        "geojson_url": "/local/wandr/current_route.geojson",
        "directions_url": "/local/wandr/current_directions.html",
    }


def parse_date(value):
    try:
        return date.fromisoformat(value)
    except Exception:
        return None


def current_streak(history):
    completed_dates = {parse_date(h.get("date")) for h in history if h.get("status") == "completed"}
    completed_dates.discard(None)
    d = date.today()
    streak = 0
    while d in completed_dates:
        streak += 1
        d -= timedelta(days=1)
    return streak


def parse_time_parts(value: str):
    try:
        parts = [int(x) for x in str(value).split(":")]
        while len(parts) < 3:
            parts.append(0)
        return parts[0], parts[1], parts[2]
    except Exception:
        return 6, 0, 0


def friendly_error_message(err: Exception | None) -> str:
    if err is None:
        return "Unknown error."

    if isinstance(err, aiohttp.ClientResponseError):
        status = err.status
        url = str(err.request_info.real_url) if err.request_info else ""
        service = "Map data service" if "overpass" in url else "External service"
        if status == 429:
            return f"{service} is rate-limiting requests. Wait 15-30 minutes, then press Generate once."
        if status in (502, 503, 504):
            return f"{service} is busy or timed out. Wait a few minutes, then try again."
        return f"{service} returned HTTP {status}. Try again later."

    text = str(err)
    if "429" in text and "Overpass" in text:
        return "Map data service is rate-limiting requests. Wait 15-30 minutes, then press Generate once."
    if any(code in text for code in ("502", "503", "504")) and "Overpass" in text:
        return "Map data service is busy or timed out. Wait a few minutes, then try again."
    if "Too Many Requests" in text:
        return "Map data service is rate-limiting requests. Wait 15-30 minutes, then press Generate once."
    if "Gateway Timeout" in text:
        return "Map data service is busy or timed out. Wait a few minutes, then try again."
    return text or "Unknown error."


def section_label(item: dict[str, str]) -> str:
    street = item.get("street", "").strip()
    a = item.get("from", "").strip()
    b = item.get("to", "").strip()
    if a or b:
        return f"{street}: {a or '?'} to {b or '?'}"
    return street


def normalize_section(item: dict[str, str]) -> dict[str, str]:
    return {"street": (item.get("street") or "").strip().lower(), "from": (item.get("from") or "").strip().lower(), "to": (item.get("to") or "").strip().lower()}


def blocked_index_ranges(way_nodes: list[int], name: str, node_streets: dict[int, set[str]], sections: list[dict[str, str]]):
    ranges = []
    way_name = (name or "").lower()
    for sec in sections:
        if not sec.get("street") or sec["street"] not in way_name:
            continue
        from_name = sec.get("from") or ""
        to_name = sec.get("to") or ""
        if not from_name and not to_name:
            ranges.append((0, max(0, len(way_nodes) - 2)))
            continue
        cross_indices = []
        for i, n in enumerate(way_nodes):
            names = node_streets.get(n, set())
            if (from_name and any(from_name in s for s in names)) or (to_name and any(to_name in s for s in names)):
                cross_indices.append(i)
        if len(cross_indices) >= 2:
            a, b = min(cross_indices), max(cross_indices)
            ranges.append((a, max(a, b - 1)))
        else:
            # Safer behavior: if the street matches but cross streets cannot be found, block the named street.
            ranges.append((0, max(0, len(way_nodes) - 2)))
    return ranges


def edge_index_blocked(idx: int, ranges: list[tuple[int, int]]) -> bool:
    return any(a <= idx <= b for a, b in ranges)


def haversine(lat1, lon1, lat2, lon2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def shortest_path(graph, start, goal):
    pq = [(0, start, [], [])]
    seen = set()
    while pq:
        dist, node, path, names = heapq.heappop(pq)
        if node in seen:
            continue
        seen.add(node)
        path = path + [node]
        if node == goal:
            return path, names
        for edge in graph.get(node, []):
            if edge.to not in seen:
                heapq.heappush(pq, (dist + edge.length, edge.to, path, names + [edge.name]))
    return [], []


def route_len(graph, nodes):
    total = 0
    for a, b in zip(nodes[:-1], nodes[1:]):
        matches = [e.length for e in graph.get(a, []) if e.to == b]
        if matches:
            total += min(matches)
    return total


def route_edge_set(nodes):
    return {tuple(sorted((a, b))) for a, b in zip(nodes[:-1], nodes[1:])}


def overlap(a, b):
    return len(a & b) / max(1, min(len(a), len(b)))


def unique_keep_order(items):
    out = []
    for item in items:
        if item and item not in out:
            out.append(item)
    return out[:30]


def sample_coords(coords, count):
    if len(coords) <= count:
        return coords
    step = max(1, len(coords) // count)
    return coords[::step][:count]



def normalize_route_style(value: Any) -> str:
    if value in ROUTE_STYLES:
        return value
    return DEFAULT_ROUTE_STYLE


def build_seed_source(*parts: Any) -> str:
    values = [
        str(part).strip().lower()
        for part in parts
        if part not in (None, "")
    ]
    return "|".join(values) or "wandr-route-generation"


def edge_between(graph, a, b):
    matches = [e for e in graph.get(a, []) if e.to == b]
    if not matches:
        return None
    return min(matches, key=lambda e: e.length)


def build_directions(graph, nodes):
    if not nodes or len(nodes) < 2:
        return []
    groups = []
    current_name = None
    current_highway = ""
    dist = 0.0
    for a, b in zip(nodes[:-1], nodes[1:]):
        e = edge_between(graph, a, b)
        if not e:
            continue
        name = e.name or "Unnamed path"
        if current_name is None:
            current_name = name
            current_highway = e.highway
            dist = e.length
        elif name == current_name:
            dist += e.length
        else:
            groups.append({"street": current_name, "distance_miles": round(dist / M_PER_MILE, 2), "highway": current_highway})
            current_name = name
            current_highway = e.highway
            dist = e.length
    if current_name is not None:
        groups.append({"street": current_name, "distance_miles": round(dist / M_PER_MILE, 2), "highway": current_highway})
    directions = []
    for i, g in enumerate(groups):
        verb = "Start on" if i == 0 else "Continue onto"
        directions.append({"step": i + 1, "instruction": f"{verb} {g['street']}", **g})
    return directions[:80]


def route_quality_score(graph, nodes, target_m, style):
    length = route_len(graph, nodes)
    target_score = max(0, 100 - abs(length - target_m) / max(target_m, 1) * 100)
    highways = []
    unnamed = 0
    unique_edges = len(route_edge_set(nodes))
    total_edges = max(1, len(nodes) - 1)
    for a, b in zip(nodes[:-1], nodes[1:]):
        e = edge_between(graph, a, b)
        if e:
            highways.append(e.highway or "")
            if e.name == "Unnamed path":
                unnamed += 1
    quiet = sum(1 for h in highways if h in ("residential", "living_street", "service", "pedestrian", "footway", "path", "cycleway")) / max(1, len(highways))
    paths = sum(1 for h in highways if h in ("footway", "path", "pedestrian", "steps", "cycleway")) / max(1, len(highways))
    major = sum(1 for h in highways if h in ("primary", "secondary", "tertiary", "primary_link", "secondary_link", "tertiary_link")) / max(1, len(highways))
    backtrack = 1 - (unique_edges / total_edges)
    directish = 100 - (len(nodes) / max(1, unique_edges))
    score = target_score * 0.55 + quiet * 30 - major * 45 - backtrack * 50 - unnamed * 0.2
    if style == "Quiet Streets":
        score += quiet * 55 - major * 70
    elif style == "Parks / Paths":
        score += paths * 70 + quiet * 15
    elif style == "Most Variety":
        score += unique_edges * 0.15 - backtrack * 80
    elif style == "Direct-ish":
        score += directish * 0.6 - backtrack * 60
    elif style == "Flattest":
        score += quiet * 20 - major * 35
    return round(score, 2)

def google_url(coords):
    if not coords:
        return ""
    origin = f"{coords[0][0]},{coords[0][1]}"
    dest = f"{coords[-1][0]},{coords[-1][1]}"
    mids = sample_coords(coords[1:-1], 8)
    waypoints = "|".join(f"{a},{b}" for a, b in mids)
    return "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=" + quote_plus(origin) + "&destination=" + quote_plus(dest) + ("&waypoints=" + quote_plus(waypoints) if waypoints else "")


def render_map_html(route):
    coords = route.get("coords") if route else []
    title = html.escape(route.get("name", "No route generated") if route else "No route generated")
    coords_json = json.dumps(coords)
    distance = route.get("distance_miles", "?") if route else "?"
    duration = route.get("duration_minutes", "?") if route else "?"
    start_label = "Start / End" if coords and coords[0] == coords[-1] else "Start"
    end_marker = ""
    if coords and coords[0] != coords[-1]:
        end_marker = "L.marker(coords[coords.length - 1]).addTo(map).bindPopup('End');"
    fallback = coords[0] if coords else [39.8283, -98.5795]
    fallback_json = json.dumps(fallback)
    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{{height:100%;margin:0}} .info{{position:absolute;z-index:999;left:10px;top:10px;background:white;padding:8px 10px;border-radius:8px;font-family:sans-serif;box-shadow:0 1px 8px #999}}</style></head>
<body><div id="map"></div><div class="info"><b>{title}</b><br>{distance} mi · {duration} min</div>
<script>
const coords = {coords_json};
const fallback = {fallback_json};
const map = L.map('map');
L.tileLayer('https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{maxZoom: 19, attribution: '&copy; OpenStreetMap'}}).addTo(map);
if (coords.length) {{
  const line = L.polyline(coords, {{weight: 5}}).addTo(map);
  L.marker(coords[0]).addTo(map).bindPopup('{start_label}');
  {end_marker}
  map.fitBounds(line.getBounds(), {{padding:[20,20]}});
}} else {{ map.setView(fallback, 14); }}
</script></body></html>'''


def render_directions_html(route):
    directions = route.get("directions") if route else []
    title = html.escape(route.get("name", "No route generated") if route else "No route generated")
    rows = "".join(f"<li><b>{html.escape(d.get('instruction',''))}</b> <span>{d.get('distance_miles','?')} mi</span></li>" for d in directions)
    if not rows:
        rows = "<li>No directions generated yet.</li>"
    return f"""<!doctype html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>
<style>body{{font-family:system-ui,sans-serif;margin:16px;line-height:1.35}} li{{margin:0 0 10px}} span{{color:#666}}</style></head><body>
<h2>{title}</h2><ol>{rows}</ol></body></html>"""


def render_gpx(route):
    coords = route.get("coords") if route else []
    name = html.escape(route.get("name", "wandr") if route else "wandr")
    pts = "\n".join(f'    <trkpt lat="{lat}" lon="{lon}"></trkpt>' for lat, lon in coords)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Home Assistant wandr" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>{name}</name><trkseg>
{pts}
  </trkseg></trk>
</gpx>'''


def render_geojson(route):
    coords = route.get("coords") if route else []
    lonlat = [[lon, lat] for lat, lon in coords]
    obj = {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"name": route.get("name") if route else "wandr"}, "geometry": {"type": "LineString", "coordinates": lonlat}}]}
    return json.dumps(obj, indent=2)


def exportable_settings(state):
    keys = ["start_address", "end_address", "loop_route", "target_miles", "route_count", "walking_minutes_per_mile", "ab_extra_mode", "ab_extra_percent", "ab_extra_miles", "ab_extra_minutes", "ab_finish_time", "blacklist", "blocked_sections", "route_style", "allow_relaxed_fallback", "auto_pick_daily_route", "daily_pick_time"]
    return {k: state.get(k) for k in keys}