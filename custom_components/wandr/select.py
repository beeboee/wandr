from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, A_TO_B_GOAL_MODES, ROUTE_STYLES, DEFAULT_ROUTE_STYLE
from .coordinator import section_label

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([
        WandrDeviationModeSelect(coordinator, entry),
        WandrRouteStyleSelect(coordinator, entry),
        WandrCurrentStreetSelect(coordinator, entry),
        WandrBlockedSectionSelect(coordinator, entry),
    ])

class WandrDeviationModeSelect(CoordinatorEntity, SelectEntity):
    _attr_options = A_TO_B_GOAL_MODES
    _attr_icon = "mdi:tune-variant"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_name = "wandr A-to-B Goal Mode"
        self._attr_unique_id = f"{entry.entry_id}_ab_extra_mode_select"

    @property
    def current_option(self) -> str:
        return self.coordinator.normalize_goal_mode(self.coordinator.state.get("ab_extra_mode") or self.coordinator.entry.data.get("ab_extra_mode"))

    async def async_select_option(self, option: str) -> None:
        if option in self.options:
            await self.coordinator.update_option("ab_extra_mode", option)


class WandrRouteStyleSelect(CoordinatorEntity, SelectEntity):
    _attr_options = ROUTE_STYLES
    _attr_icon = "mdi:routes"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_name = "wandr Route Style"
        self._attr_unique_id = f"{entry.entry_id}_route_style_select"

    @property
    def current_option(self) -> str:
        value = self.coordinator.state.get("route_style") or self.coordinator.entry.data.get("route_style") or DEFAULT_ROUTE_STYLE
        return value if value in self.options else DEFAULT_ROUTE_STYLE

    async def async_select_option(self, option: str) -> None:
        if option in self.options:
            await self.coordinator.update_option("route_style", option)

class WandrCurrentStreetSelect(CoordinatorEntity, SelectEntity):
    _attr_icon = "mdi:road-variant"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_name = "wandr Current Route Street"
        self._attr_unique_id = f"{entry.entry_id}_current_route_street_select"

    @property
    def options(self) -> list[str]:
        names = self.coordinator.current_route.get("street_names") or []
        return names or ["No streets available"]

    @property
    def current_option(self) -> str | None:
        selected = self.coordinator.state.get("feedback_street")
        if selected in self.options:
            return selected
        return self.options[0] if self.options else None

    async def async_select_option(self, option: str) -> None:
        if option and option != "No streets available":
            await self.coordinator.update_option("feedback_street", option)

class WandrBlockedSectionSelect(CoordinatorEntity, SelectEntity):
    _attr_icon = "mdi:map-marker-remove"

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_name = "wandr Blocked Street Section"
        self._attr_unique_id = f"{entry.entry_id}_blocked_street_section_select"

    @property
    def options(self) -> list[str]:
        labels = [section_label(s) for s in self.coordinator.state.get("blocked_sections", [])]
        return labels or ["No blocked sections"]

    @property
    def current_option(self) -> str | None:
        selected = self.coordinator.state.get("selected_blocked_section")
        if selected in self.options:
            return selected
        return self.options[0] if self.options else None

    async def async_select_option(self, option: str) -> None:
        if option and option != "No blocked sections":
            await self.coordinator.update_option("selected_blocked_section", option)
