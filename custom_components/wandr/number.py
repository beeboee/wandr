from __future__ import annotations

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN

NUMBERS = [
    ("target_miles", "wandr Target Miles", 0.25, 15.0, 0.1, "mi", "mdi:map-marker-distance"),
    ("route_count", "wandr Base Route Count", 1, 366, 1, None, "mdi:counter"),
    ("walking_minutes_per_mile", "wandr Pace", 5, 60, 1, "min/mi", "mdi:walk"),
    ("ab_extra_miles", "wandr A-to-B Extra Miles", 0, 15, 0.1, "mi", "mdi:map-plus"),
    ("ab_extra_percent", "wandr A-to-B Extra Percent", 0, 300, 1, "%", "mdi:percent"),
    ("ab_extra_minutes", "wandr A-to-B Extra Minutes", 0, 240, 1, "min", "mdi:clock-plus-outline"),
]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WandrNumber(coordinator, entry, *spec) for spec in NUMBERS])

class WandrNumber(CoordinatorEntity, NumberEntity):
    _attr_mode = NumberMode.BOX

    def __init__(self, coordinator, entry, key, name, min_value, max_value, step, unit, icon):
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{key}_number"
        self._attr_native_min_value = min_value
        self._attr_native_max_value = max_value
        self._attr_native_step = step
        self._attr_native_unit_of_measurement = unit
        self._attr_icon = icon

    @property
    def native_value(self):
        return self.coordinator.state.get(self._key, self.coordinator.entry.data.get(self._key))

    async def async_set_native_value(self, value: float) -> None:
        if self._key in ("route_count", "ab_extra_minutes"):
            value = int(value)
        else:
            value = float(value)
        await self.coordinator.update_option(self._key, value)
