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
    DEFAULT_ROUTE_STYLE,
    DEFAULT_ALLOW_RELAXED_FALLBACK,
    DEFAULT_MAP_APP,
)


class WandrConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 3

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            start_address = (user_input.get("start_address") or "").strip()

            if not start_address:
                return self.async_show_form(
                    step_id="user",
                    data_schema=self._schema(user_input),
                    errors={"start_address": "start_required"},
                )

            target_miles = float(user_input.get("target_miles", DEFAULT_TARGET_MILES))

            # Keep setup intentionally small.
            #
            # These defaults are still stored so the existing entities/card/backend
            # can work immediately after install. Users can change them later from
            # the dashboard/entities instead of being forced through a giant setup form.
            data = {
                "start_address": start_address,
                "end_address": start_address,
                "loop_route": True,
                "target_miles": target_miles,
                "route_count": DEFAULT_ROUTE_COUNT,
                "walking_minutes_per_mile": DEFAULT_WALKING_MINUTES_PER_MILE,
                "ab_extra_mode": DEFAULT_AB_EXTRA_MODE,
                "ab_extra_percent": DEFAULT_AB_EXTRA_PERCENT,
                "ab_extra_miles": DEFAULT_AB_EXTRA_MILES,
                "ab_extra_minutes": DEFAULT_AB_EXTRA_MINUTES,
                "ab_finish_time": DEFAULT_AB_FINISH_TIME,
                "route_style": DEFAULT_ROUTE_STYLE,
                "allow_relaxed_fallback": DEFAULT_ALLOW_RELAXED_FALLBACK,
                "map_app": DEFAULT_MAP_APP,
            }

            await self.async_set_unique_id("wandr")
            self._abort_if_unique_id_configured()

            return self.async_create_entry(title="wandr", data=data)

        return self.async_show_form(step_id="user", data_schema=self._schema())

    def _schema(self, defaults=None):
        defaults = defaults or {}

        return vol.Schema(
            {
                vol.Required(
                    "start_address",
                    default=defaults.get("start_address", DEFAULT_START_ADDRESS),
                ): str,
                vol.Required(
                    "target_miles",
                    default=defaults.get("target_miles", DEFAULT_TARGET_MILES),
                ): vol.Coerce(float),
            }
        )
