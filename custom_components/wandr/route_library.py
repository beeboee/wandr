from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .coordinator import (
    exportable_settings,
    render_directions_html,
    render_geojson,
    render_gpx,
    render_map_html,
)


def patch_route_library(WandrCoordinator) -> None:
    """Patch the coordinator artifact writer to export a full local route library.

    This keeps the existing coordinator stable while adding the folder of
    pre-generated route artifacts that the dashboard/card can use later.
    """

    async def _write_artifacts(self):
        www = Path(self.hass.config.path("www/wandr"))
        await self.hass.async_add_executor_job(_write_artifacts_sync, www, self.state, self.current_route)

    WandrCoordinator._write_artifacts = _write_artifacts


def _write_artifacts_sync(www: Path, state: dict[str, Any], route: dict[str, Any]) -> None:
    www.mkdir(parents=True, exist_ok=True)

    routes = state.get("routes") or []
    (www / "current_route.html").write_text(render_map_html(route), "utf-8")
    (www / "current_route.json").write_text(json.dumps(route, indent=2), "utf-8")
    (www / "history.json").write_text(json.dumps(state.get("history", []), indent=2), "utf-8")
    (www / "current_directions.html").write_text(render_directions_html(route), "utf-8")
    (www / "current_route.gpx").write_text(render_gpx(route), "utf-8")
    (www / "current_route.geojson").write_text(render_geojson(route), "utf-8")
    (www / "settings_export.json").write_text(json.dumps(exportable_settings(state), indent=2), "utf-8")

    _write_route_library(www, state, routes)


def _write_route_library(www: Path, state: dict[str, Any], routes: list[dict[str, Any]]) -> None:
    routes_dir = www / "routes"
    routes_dir.mkdir(parents=True, exist_ok=True)

    manifest_routes: list[dict[str, Any]] = []
    for index, route in enumerate(routes, start=1):
        slug = f"route_{index:03d}"
        route_payload = dict(route)
        route_payload.update({
            "route_index": index,
            "route_json_url": f"/local/wandr/routes/{slug}.json",
            "directions_url": f"/local/wandr/routes/{slug}_directions.html",
            "gpx_url": f"/local/wandr/routes/{slug}.gpx",
            "geojson_url": f"/local/wandr/routes/{slug}.geojson",
        })

        (routes_dir / f"{slug}.json").write_text(json.dumps(route_payload, indent=2), "utf-8")
        (routes_dir / f"{slug}_directions.html").write_text(render_directions_html(route_payload), "utf-8")
        (routes_dir / f"{slug}.gpx").write_text(render_gpx(route_payload), "utf-8")
        (routes_dir / f"{slug}.geojson").write_text(render_geojson(route_payload), "utf-8")

        manifest_routes.append({
            "index": index,
            "name": route.get("name"),
            "mode": route.get("mode"),
            "direction": route.get("direction"),
            "distance_miles": route.get("distance_miles"),
            "duration_minutes": route.get("duration_minutes"),
            "elevation_gain_ft": route.get("elevation_gain_ft"),
            "quality_score": route.get("quality_score"),
            "json_url": f"/local/wandr/routes/{slug}.json",
            "directions_url": f"/local/wandr/routes/{slug}_directions.html",
            "gpx_url": f"/local/wandr/routes/{slug}.gpx",
            "geojson_url": f"/local/wandr/routes/{slug}.geojson",
        })

    base_count = state.get("route_count")
    generated_count = len(routes)
    manifest = {
        "version": 1,
        "generated_at_route_count": generated_count,
        "configured_base_route_count": base_count,
        "loop_route": state.get("loop_route"),
        "target_miles": state.get("target_miles"),
        "route_style": state.get("route_style"),
        "start_address": state.get("start_address"),
        "end_address": state.get("end_address"),
        "note": "Loop routes are generated as unique base walks plus mirrored clockwise/counterclockwise route instances. 183 base loop routes should create 366 route files.",
        "routes": manifest_routes,
    }

    (routes_dir / "index.json").write_text(json.dumps(manifest, indent=2), "utf-8")
    (routes_dir / "all_routes.json").write_text(json.dumps(routes, indent=2), "utf-8")
