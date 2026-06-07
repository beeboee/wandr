from __future__ import annotations

from urllib.parse import quote_plus

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, DEFAULT_MAP_APP

SENSORS = [
    ("route_name", "Route Name", None, "mdi:routes"),
    ("distance_miles", "Distance", "mi", "mdi:map-marker-distance"),
    ("duration_minutes", "Estimated Duration", "min", "mdi:clock-outline"),
    ("elevation_gain_ft", "Elevation Gain", "ft", "mdi:image-filter-hdr"),
    ("google_maps_url", "Google Maps URL", None, "mdi:google-maps"),
    ("preferred_map_url", "Preferred Map URL", None, "mdi:map"),
    ("map_app", "Map App", None, "mdi:map-check"),
    ("mode", "Mode", None, "mdi:map-marker-path"),
    ("start_address", "Start Address", None, "mdi:map-marker"),
    ("end_address", "End Address", None, "mdi:map-marker-check"),

    ("optimal_distance_miles", "Optimal A-to-B Distance", "mi", "mdi:map-marker-distance"),
    ("a_to_b_target_distance_miles", "A-to-B Target Distance", "mi", "mdi:map-marker-distance"),
    ("extra_distance_miles", "Extra A-to-B Distance", "mi", "mdi:plus-circle-outline"),
    ("a_to_b_deviation", "A-to-B Goal Plan", None, "mdi:walk"),
    ("finish_by_available_minutes", "A-to-B Finish Window", "min", "mdi:timer-outline"),
    ("finish_by_target_distance_miles", "A-to-B Finish Target Distance", "mi", "mdi:clock-end"),

    ("blacklist", "Blacklist", None, "mdi:cancel"),
    ("blocked_sections_count", "Blocked Street Sections", None, "mdi:road-variant"),
    ("blocked_sections_list", "Avoid List", None, "mdi:format-list-bulleted"),

    ("configured_route_count", "Configured Route Count", None, "mdi:counter"),
    ("route_count", "Generated Route Count", None, "mdi:counter"),
    ("day_number", "Day Number", None, "mdi:calendar-today"),
    ("today_status", "Today Status", None, "mdi:checkbox-marked-circle-outline"),

    ("current_streak", "Current Streak", "days", "mdi:fire"),
    ("week_completed", "This Week Walks", None, "mdi:calendar-week"),
    ("week_miles", "This Week Miles", "mi", "mdi:map-marker-distance"),
    ("month_completed", "This Month Walks", None, "mdi:calendar-month"),
    ("month_miles", "This Month Miles", "mi", "mdi:map-marker-distance"),
    ("history_count", "History Entries", None, "mdi:history"),

    ("route_style", "Route Style", None, "mdi:routes"),
    ("quality_score", "Route Quality Score", None, "mdi:star-outline"),
    ("generation_status", "Generation Status", None, "mdi:check-network-outline"),
    ("last_generation_summary", "Last Generation Summary", None, "mdi:text-box-check-outline"),
    ("validation_warnings", "Validation Warnings", None, "mdi:alert-outline"),
    ("last_error", "Last Error", None, "mdi:alert-circle-outline"),

    ("local_graph_cache_status", "Local Graph Cache Status", None, "mdi:database-search"),
    ("local_graph_radius_miles", "Local Graph Radius", "mi", "mdi:map-marker-radius"),
    ("local_graph_element_count", "Local Graph Elements", None, "mdi:graph"),
    ("local_graph_source", "Local Graph Source", None, "mdi:cloud-download-outline"),
    ("local_graph_cache_path", "Local Graph Cache Path", None, "mdi:file-tree"),

    ("directions_url", "Directions URL", None, "mdi:format-list-numbered"),
    ("gpx_url", "GPX URL", None, "mdi:file-download-outline"),
    ("geojson_url", "GeoJSON URL", None, "mdi:code-json"),
]


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WandrSensor(coordinator, entry, *spec) for spec in SENSORS])


class WandrSensor(CoordinatorEntity, SensorEntity):
    def __init__(self, coordinator, entry, key, name, unit, icon):
        super().__init__(coordinator)
        self._key = key
        self._attr_name = f"wandr {name}"
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_native_unit_of_measurement = unit
        self._attr_icon = icon

    @property
    def native_value(self):
        state = self.coordinator.state
        route = self.coordinator.current_route
        stats = self.coordinator.progress_stats()

        if self._key == "route_name":
            return route.get("name", "No route")
        if self._key == "distance_miles":
            return route.get("distance_miles")
        if self._key == "duration_minutes":
            return route.get("duration_minutes")
        if self._key == "elevation_gain_ft":
            return route.get("elevation_gain_ft")
        if self._key == "google_maps_url":
            return route.get("google_maps_url", "")
        if self._key == "preferred_map_url":
            return preferred_map_url(
                route,
                state.get("map_app") or self.coordinator.entry.data.get("map_app") or DEFAULT_MAP_APP,
            )
        if self._key == "map_app":
            return state.get("map_app") or self.coordinator.entry.data.get("map_app") or DEFAULT_MAP_APP
        if self._key == "directions_url":
            return route.get("directions_url", "/local/wandr/current_directions.html")
        if self._key == "gpx_url":
            return route.get("gpx_url", "/local/wandr/current_route.gpx")
        if self._key == "geojson_url":
            return route.get("geojson_url", "/local/wandr/current_route.geojson")
        if self._key == "route_style":
            return state.get("route_style") or route.get("route_style")
        if self._key == "quality_score":
            return route.get("quality_score")
        if self._key == "mode":
            return "Loop" if state.get("loop_route", True) else "A to B"
        if self._key == "start_address":
            return state.get("start_address") or self.coordinator.entry.data.get("start_address", "")
        if self._key == "end_address":
            return state.get("end_address") or self.coordinator.entry.data.get("end_address", "")

        if self._key == "optimal_distance_miles":
            return state.get("optimal_distance_miles")
        if self._key == "a_to_b_target_distance_miles":
            return state.get("a_to_b_target_distance_miles")
        if self._key == "extra_distance_miles":
            return state.get("extra_distance_miles")
        if self._key == "a_to_b_deviation":
            mode = self.coordinator.normalize_goal_mode(
                state.get("ab_extra_mode") or self.coordinator.entry.data.get("ab_extra_mode")
            )
            if mode == "Desired total distance":
                miles = state.get("a_to_b_target_distance_miles") or self.coordinator.entry.data.get("target_miles", 0)
                return f"Total {miles} mi"
            if mode == "Distance over optimal":
                return f"Optimal + {state.get('ab_extra_miles', self.coordinator.entry.data.get('ab_extra_miles', 0))} mi"
            if mode == "Time over optimal":
                return f"Optimal + {state.get('ab_extra_minutes', self.coordinator.entry.data.get('ab_extra_minutes', 0))} min"
            if mode == "Finish by time":
                return f"Finish by {state.get('ab_finish_time', self.coordinator.entry.data.get('ab_finish_time', ''))}"
            return f"Optimal + {state.get('ab_extra_percent', self.coordinator.entry.data.get('ab_extra_percent', 0))}%"
        if self._key == "finish_by_available_minutes":
            return state.get("finish_by_available_minutes")
        if self._key == "finish_by_target_distance_miles":
            return state.get("finish_by_target_distance_miles")

        if self._key == "blacklist":
            return state.get("blacklist", "")
        if self._key == "blocked_sections_count":
            return len(state.get("blocked_sections") or [])
        if self._key == "blocked_sections_list":
            sections = state.get("blocked_sections") or []
            if not sections:
                return "None"
            labels = [section_label(section) for section in sections]
            return "; ".join(labels[:5]) + ("; …" if len(labels) > 5 else "")

        if self._key == "configured_route_count":
            return state.get("route_count") or self.coordinator.entry.data.get("route_count")
        if self._key == "route_count":
            return len(state.get("routes") or [])
        if self._key == "day_number":
            return (state.get("current_index", 0) + 1) if state.get("routes") else 0
        if self._key == "today_status":
            if state.get("today_completed"):
                return "Completed"
            if state.get("today_skipped"):
                return "Skipped"
            return "Not completed"

        if self._key in stats:
            return stats[self._key]

        if self._key == "generation_status":
            return state.get("generation_status", "Not generated yet")
        if self._key == "last_generation_summary":
            return state.get("last_generation_summary", "")
        if self._key == "validation_warnings":
            warnings = state.get("validation_warnings") or []
            return "; ".join(warnings) if warnings else "None"
        if self._key == "last_error":
            return state.get("last_error", "") or "OK"

        if self._key == "local_graph_cache_status":
            return state.get("local_graph_cache_status", "Not loaded")
        if self._key == "local_graph_radius_miles":
            return state.get("local_graph_radius_miles")
        if self._key == "local_graph_element_count":
            return state.get("local_graph_element_count", 0)
        if self._key == "local_graph_source":
            return state.get("local_graph_source", "")
        if self._key == "local_graph_cache_path":
            return state.get("local_graph_cache_path", "")

        return None

    @property
    def extra_state_attributes(self):
        route = self.coordinator.current_route
        state = self.coordinator.state

        if self._key == "route_name" and route:
            return {
                "direction": route.get("direction"),
                "streets": route.get("street_names"),
                "map_url": "/local/wandr/current_route.html",
                "json_url": "/local/wandr/current_route.json",
                "history_url": "/local/wandr/history.json",
                "directions_url": "/local/wandr/current_directions.html",
                "gpx_url": "/local/wandr/current_route.gpx",
                "geojson_url": "/local/wandr/current_route.geojson",
                "settings_export_url": "/local/wandr/settings_export.json",
                "directions": route.get("directions"),
                "quality_score": route.get("quality_score"),
            }

        if self._key in ("blocked_sections_count", "blocked_sections_list"):
            return {
                "blocked_sections": [
                    section for section in state.get("blocked_sections", [])
                ]
            }

        if self._key == "validation_warnings":
            return {
                "warnings": state.get("validation_warnings") or []
            }

        if self._key.startswith("local_graph_"):
            return {
                "cache_status": state.get("local_graph_cache_status"),
                "cache_path": state.get("local_graph_cache_path"),
                "radius_miles": state.get("local_graph_radius_miles"),
                "element_count": state.get("local_graph_element_count"),
                "source": state.get("local_graph_source"),
            }

        return None


def section_label(item: dict[str, str]) -> str:
    street = item.get("street", "").strip()
    a = item.get("from", "").strip()
    b = item.get("to", "").strip()

    if a or b:
        return f"{street}: {a or '?'} to {b or '?'}"

    return street


def preferred_map_url(route: dict, map_app: str) -> str:
    coords = route.get("coords") if route else []

    if not coords:
        return ""

    origin = f"{coords[0][0]},{coords[0][1]}"
    dest = f"{coords[-1][0]},{coords[-1][1]}"

    waypoint_coords = coords[1:-1]
    if len(waypoint_coords) > 8:
        step = max(1, len(waypoint_coords) // 8)
        waypoint_coords = waypoint_coords[::step][:8]

    waypoints = "|".join(f"{a},{b}" for a, b in waypoint_coords)

    if map_app == "Ask every time":
        return "geo:" + quote_plus(dest) + "?q=" + quote_plus(dest + "(wandr route)")

    if map_app == "Apple Maps":
        return "https://maps.apple.com/?dirflg=w&saddr=" + quote_plus(origin) + "&daddr=" + quote_plus(dest)

    if map_app == "Waze":
        return "https://waze.com/ul?ll=" + quote_plus(dest) + "&navigate=yes"

    if map_app == "OpenStreetMap":
        return "https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=" + quote_plus(origin + ";" + dest)

    return (
        "https://www.google.com/maps/dir/?api=1&travelmode=walking&origin="
        + quote_plus(origin)
        + "&destination="
        + quote_plus(dest)
        + ("&waypoints=" + quote_plus(waypoints) if waypoints else "")
    )
