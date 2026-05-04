from __future__ import annotations

from homeassistant.components.text import TextEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN

TEXTS = [
    ("start_address", "wandr Start Address", "mdi:map-marker", 255),
    ("end_address", "wandr End Address", "mdi:map-marker-check", 255),
    ("blacklist", "wandr Blacklist", "mdi:cancel", 500),
    ("feedback_street", "wandr Street To Avoid", "mdi:road-variant", 255),
    ("feedback_from_cross", "wandr Avoid From Cross Street", "mdi:map-marker-left", 255),
    ("feedback_to_cross", "wandr Avoid To Cross Street", "mdi:map-marker-right", 255),
]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WandrText(coordinator, entry, *spec) for spec in TEXTS])

class WandrText(CoordinatorEntity, TextEntity):
    def __init__(self, coordinator, entry, key, name, icon, max_len):
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{key}_text"
        self._attr_icon = icon
        self._attr_native_max = max_len

    @property
    def native_value(self) -> str:
        return self.coordinator.state.get(self._key) or self.coordinator.entry.data.get(self._key, "") or ""

    async def async_set_value(self, value: str) -> None:
        await self.coordinator.update_option(self._key, value or "")
