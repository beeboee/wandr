from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from .coordinator import (
    WandrCoordinator as BaseWandrCoordinator,
    exportable_settings,
    render_directions_html,
    render_geojson,
    render_gpx,
    render_map_html,
)

_LOGGER = logging.getLogger(__name__)
AUTO_DELAY_SECONDS = 90


class EnhancedWandrCoordinator(BaseWandrCoordinator):
    """Coordinator with explicit route-library and first-run generation behavior."""

    async def async_load(self) -> None:
        await super().async_load()
        self._schedule_auto_library_generation(reason="startup")

    async def shutdown(self):
       