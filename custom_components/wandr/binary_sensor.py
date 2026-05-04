from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN

BINARY_SENSORS = [
    ("completed_today", "wandr Completed Today", "mdi:check-circle-outline"),
    ("skipped_today", "wandr Skipped Today", "mdi:skip-next-circle-outline"),
]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WandrBinarySensor(coordinator, entry, *spec) for spec in BINARY_SENSORS])

class WandrBinarySensor(CoordinatorEntity, BinarySensorEntity):
    def __init__(self, coordinator, entry, key, name, icon):
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_icon = icon

    @property
    def is_on(self) -> bool:
        if self._key == "completed_today":
            return bool(self.coordinator.state.get("today_completed"))
        if self._key == "skipped_today":
            return bool(self.coordinator.state.get("today_skipped"))
        return False
