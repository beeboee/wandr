from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall

from .const import DOMAIN, PLATFORMS
from . import coordinator as wandr_coordinator
from .enhanced_coordinator import EnhancedWandrCoordinator
from .map_html import render_map_html as live_render_map_html

_LOGGER = logging.getLogger(__name__)
FRONTEND_DIR = Path(__file__).parent / "frontend"


async def _register_frontend_path(hass: HomeAssistant) -> None:
    """Register the bundled Lovelace card path when supported by this HA version."""

    try:
        from homeassistant.components.http import StaticPathConfig

        register_paths = getattr(hass.http, "async_register_static_paths", None)
        if register_paths is None:
            _LOGGER.debug("async_register_static_paths unavailable; frontend card path not registered")
            return

        await register_paths(
            [
                StaticPathConfig(
                    f"/{DOMAIN}/frontend",
                    str(FRONTEND_DIR),
                    False,
                )
            ]
        )
    except Exception as err:
        _LOGGER.warning(
            "Could not register wandr frontend card path. The integration will still run, "
            "but the bundled Lovelace card may need to be loaded manually: %s",
            err,
        )


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Keep the live map HTML renderer override, but stop monkey-patching the coordinator.
    wandr_coordinator.render_map_html = live_render_map_html

    coordinator = EnhancedWandrCoordinator(hass, entry)
    await coordinator.async_load()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    await _register_frontend_path(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async def get_coord() -> EnhancedWandrCoordinator:
        return hass.data[DOMAIN][entry.entry_id]

    async def generate_year(call: ServiceCall):
        await (await get_coord()).generate_year()

    async def next_route(call: ServiceCall):
        await (await get_coord()).next_route()

    async def previous_route(call: ServiceCall):
        await (await get_coord()).previous_route()

    async def random_route(call: ServiceCall):
        await (await get_coord()).random_route()

    async def pick_daily_route(call: ServiceCall):
        await (await get_coord()).pick_daily_route(force=True)

    async def mark_completed(call: ServiceCall):
        await (await get_coord()).mark_completed()

    async def skip_today(call: ServiceCall):
        await (await get_coord()).skip_today()

    async def set_blacklist(call: ServiceCall):
        await (await get_coord()).set_blacklist(call.data.get("blacklist", ""))

    async def set_a_to_b_deviation(call: ServiceCall):
        await (await get_coord()).set_a_to_b_deviation(
            call.data.get("mode", "Desired total distance"),
            call.data.get("percent"),
            call.data.get("minutes"),
            call.data.get("total_miles"),
            call.data.get("extra_miles"),
            call.data.get("finish_time"),
        )

    async def add_blocked_section(call: ServiceCall):
        coord = await get_coord()
        street = call.data.get("street")
        if street is not None:
            coord.state["feedback_street"] = street
        if call.data.get("from_cross") is not None:
            coord.state["feedback_from_cross"] = call.data.get("from_cross")
        if call.data.get("to_cross") is not None:
            coord.state["feedback_to_cross"] = call.data.get("to_cross")
        await coord.add_blocked_section()

    async def remove_selected_blocked_section(call: ServiceCall):
        await (await get_coord()).remove_selected_blocked_section()

    async def clear_history(call: ServiceCall):
        await (await get_coord()).clear_history()

    async def export_settings(call: ServiceCall):
        await (await get_coord()).export_settings()

    async def import_settings(call: ServiceCall):
        await (await get_coord()).import_settings()

    hass.services.async_register(DOMAIN, "generate_year", generate_year)
    hass.services.async_register(DOMAIN, "next_route", next_route)
    hass.services.async_register(DOMAIN, "previous_route", previous_route)
    hass.services.async_register(DOMAIN, "random_route", random_route)
    hass.services.async_register(DOMAIN, "pick_daily_route", pick_daily_route)
    hass.services.async_register(DOMAIN, "pick_today_route", pick_daily_route)
    hass.services.async_register(DOMAIN, "mark_completed", mark_completed)
    hass.services.async_register(DOMAIN, "skip_today", skip_today)
    hass.services.async_register(DOMAIN, "set_blacklist", set_blacklist)
    hass.services.async_register(DOMAIN, "set_a_to_b_deviation", set_a_to_b_deviation)
    hass.services.async_register(DOMAIN, "set_a_to_b_goal", set_a_to_b_deviation)
    hass.services.async_register(DOMAIN, "add_blocked_section", add_blocked_section)
    hass.services.async_register(DOMAIN, "remove_selected_blocked_section", remove_selected_blocked_section)
    hass.services.async_register(DOMAIN, "clear_history", clear_history)
    hass.services.async_register(DOMAIN, "export_settings", export_settings)
    hass.services.async_register(DOMAIN, "import_settings", import_settings)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = hass.data.get(DOMAIN, {}).get(entry.entry_id)
    if coordinator:
        await coordinator.shutdown()

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)

    return unload_ok
