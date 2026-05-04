from __future__ import annotations

import voluptuous as vol
from homeassistant import config_entries

from .const import (
    DOMAIN,
    DEFAULT_START_ADDRESS,
    DEFAULT_END_ADDRESS,
    DEFAULT_LOOP_ROUTE,
    DEFAULT_TARGET_MILES,
    DEFAULT_ROUTE_COUNT,
    DEFAULT_WALKING_MINUTES_PER_MILE,
    DEFAULT_AB_EXTRA_MODE,
    DEFAULT_AB_EXTRA_PERCENT,
    DEFAULT_AB_EXTRA_MILES,
    DEFAULT_AB_EXTRA_MINUTES,
    DEFAULT_AB_FINISH_TIME,
    A_TO_B_GOAL_MODES,
    DEFAULT_ROUTE_STYLE,
    ROUTE_STYLES,
    DEFAULT_ALLOW_RELAXED_FALLBACK,
)


def _goal_mode_default(value):
    mapping = {
        "total": "Desired total distance",
        "distance": "Distance over optimal",
        "extra_distance": "Distance over optimal",
        "percent": "Percent over optimal",
        "minutes": "Time over optimal",
        "time": "Time over optimal",
        "arrive_by": "Finish by time",
        "arrival_time": "Finish by time",
        "finish_by": "Finish by time",
    }
    if value in A_TO_B_GOAL_MODES:
        return value
    if isinstance(value, str):
        return mapping.get(value.strip().lower(), DEFAULT_AB_EXTRA_MODE)
    return DEFAULT_AB_EXTRA_MODE


class WandrConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 2

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            data = dict(user_input)
            data["start_address"] = (data.get("start_address") or "").strip()
            data["end_address"] = (data.get("end_address") or "").strip()

            if not data["start_address"]:
                return self.async_show_form(
                    step_id="user",
                    data_schema=self._schema(data),
                    errors={"start_address": "start_required"},
                )

            # For loop routes, keep end_address synced with start_address even if the form field is left blank.
            if data.get("loop_route", True):
                data["end_address"] = data.get("start_address")
            elif not data.get("end_address"):
                return self.async_show_form(
                    step_id="user",
                    data_schema=self._schema(data),
                    errors={"end_address": "end_required"},
                )

            await self.async_set_unique_id("wandr")
            self._abort_if_unique_id_configured()
            title = "wandr Loop" if data.get("loop_route", True) else "wandr A to B"
            return self.async_create_entry(title=title, data=data)

        return self.async_show_form(step_id="user", data_schema=self._schema())

    def _schema(self, defaults=None):
        defaults = defaults or {}
        return vol.Schema({
            vol.Required(
                "start_address",
                default=defaults.get("start_address", DEFAULT_START_ADDRESS),
            ): str,
            vol.Required(
                "loop_route",
                default=defaults.get("loop_route", DEFAULT_LOOP_ROUTE),
            ): bool,
            vol.Optional(
                "end_address",
                default=defaults.get("end_address", DEFAULT_END_ADDRESS),
            ): str,
            vol.Required(
                "target_miles",
                default=defaults.get("target_miles", DEFAULT_TARGET_MILES),
            ): vol.Coerce(float),
            vol.Required(
                "walking_minutes_per_mile",
                default=defaults.get("walking_minutes_per_mile", DEFAULT_WALKING_MINUTES_PER_MILE),
            ): vol.Coerce(float),
            vol.Required(
                "ab_extra_mode",
                default=_goal_mode_default(defaults.get("ab_extra_mode", DEFAULT_AB_EXTRA_MODE)),
            ): vol.In(A_TO_B_GOAL_MODES),
            vol.Required(
                "ab_extra_miles",
                default=defaults.get("ab_extra_miles", DEFAULT_AB_EXTRA_MILES),
            ): vol.Coerce(float),
            vol.Required(
                "ab_extra_percent",
                default=defaults.get("ab_extra_percent", DEFAULT_AB_EXTRA_PERCENT),
            ): vol.Coerce(float),
            vol.Required(
                "ab_extra_minutes",
                default=defaults.get("ab_extra_minutes", DEFAULT_AB_EXTRA_MINUTES),
            ): vol.Coerce(int),
            vol.Required(
                "ab_finish_time",
                default=defaults.get("ab_finish_time", DEFAULT_AB_FINISH_TIME),
            ): str,
            vol.Required(
                "route_style",
                default=defaults.get("route_style", DEFAULT_ROUTE_STYLE),
            ): vol.In(ROUTE_STYLES),
            vol.Required(
                "allow_relaxed_fallback",
                default=defaults.get("allow_relaxed_fallback", DEFAULT_ALLOW_RELAXED_FALLBACK),
            ): bool,
            vol.Required(
                "route_count",
                default=defaults.get("route_count", DEFAULT_ROUTE_COUNT),
            ): vol.Coerce(int),
        })
