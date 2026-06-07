from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from .coordinator import WandrCoordinator, exportable_settings, render_map_html

_LOGGER = logging.getLogger(__name__)
AUTO_DELAY_SECONDS = 90


class EnhancedWandrCoordinator(WandrCoordinator):
    """Coordinator with built-in compact route library