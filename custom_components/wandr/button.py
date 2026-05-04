from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN

BUTTONS = [
    ("generate_year", "wandr Generate Routes", "mdi:refresh"),
    ("pick_daily_route", "wandr Pick Today Route", "mdi:calendar-today"),
    ("mark_completed", "wandr Mark Completed", "mdi:check-circle"),
    ("skip_today", "wandr Skip Today", "mdi:skip-next-circle"),
    ("next_route", "wandr Next Route", "mdi:chevron-right"),
    ("previous_route", "wandr Previous Route", "mdi:chevron-left"),
    ("random_route", "wandr Random Route", "mdi:shuffle-variant"),
    ("add_blocked_section", "wandr Avoid Selected Street Section", "mdi:map-marker-remove"),
    ("remove_selected_blocked_section", "wandr Remove Blocked Street Section", "mdi:delete"),
    ("clear_history", "wandr Clear History", "mdi:history"),
    ("export_settings", "wandr Export Settings", "mdi:download"),
    ("import_settings", "wandr Import Settings", "mdi:upload"),
]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WandrButton(coordinator, entry, *spec) for spec in BUTTONS])

class WandrButton(CoordinatorEntity, ButtonEntity):
    def __init__(self, coordinator, entry, action, name, icon):
        super().__init__(coordinator)
        self._action = action
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{action}_button"
        self._attr_icon = icon

    async def async_press(self) -> None:
        method = getattr(self.coordinator, self._action)
        if self._action == "pick_daily_route":
            await method(force=True)
        else:
            await method()
