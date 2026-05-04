from __future__ import annotations

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN

SWITCHES = [
    ("loop_route", "wandr Loop Route", "mdi:map-marker-path"),
    ("auto_pick_daily_route", "wandr Auto Pick Route", "mdi:calendar-clock"),
    ("allow_relaxed_fallback", "wandr Allow Relaxed Fallback", "mdi:tune"),
]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WandrSwitch(coordinator, entry, *spec) for spec in SWITCHES])

class WandrSwitch(CoordinatorEntity, SwitchEntity):
    def __init__(self, coordinator, entry, key, name, icon):
        super().__init__(coordinator)
        self._key = key
        self._attr_name = name
        self._attr_unique_id = f"{entry.entry_id}_{key}_switch"
        self._attr_icon = icon

    @property
    def is_on(self) -> bool:
        return bool(self.coordinator.state.get(self._key, self.coordinator.entry.data.get(self._key, False)))

    async def async_turn_on(self, **kwargs):
        await self.coordinator.update_option(self._key, True)

    async def async_turn_off(self, **kwargs):
        await self.coordinator.update_option(self._key, False)
