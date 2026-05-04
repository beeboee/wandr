from __future__ import annotations

from datetime import time

from homeassistant.components.time import TimeEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, DEFAULT_DAILY_PICK_TIME, DEFAULT_AB_FINISH_TIME
from .coordinator import parse_time_parts

TIME_ENTITIES = [
    ("daily_pick_time", "wandr Pick Time", DEFAULT_DAILY_PICK_TIME, "mdi:calendar-clock"),
    ("ab_finish_time", "wandr A-to-B Finish By Time", DEFAULT_AB_FINISH_TIME, "mdi:clock-end"),
]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WandrTime(coordinator, entry, *spec) for spec in TIME_ENTITIES])

class WandrTime(CoordinatorEntity, TimeEntity):
    def __init__(self, coordinator, entry, key, name, default, icon):
        super().__init__(coordinator)
        self._key = key
        self._default = default
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_icon = icon

    @property
    def native_value(self) -> time:
        hh, mm, ss = parse_time_parts(self.coordinator.state.get(self._key) or self.coordinator.entry.data.get(self._key) or self._default)
        return time(hh, mm, ss)

    async def async_set_value(self, value: time) -> None:
        await self.coordinator.update_option(self._key, value.strftime("%H:%M:%S"))
