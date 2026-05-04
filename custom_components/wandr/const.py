DOMAIN = "wandr"
PLATFORMS = ["sensor", "binary_sensor", "switch", "select", "number", "text", "button", "time"]
STORAGE_KEY = "wandr_storage"
STORAGE_VERSION = 2

DEFAULT_START_ADDRESS = ""
DEFAULT_END_ADDRESS = ""
DEFAULT_LOOP_ROUTE = True
DEFAULT_TARGET_MILES = 3.0
DEFAULT_ROUTE_COUNT = 183
DEFAULT_RADIUS_METERS = 3000
DEFAULT_WALKING_MINUTES_PER_MILE = 20
DEFAULT_AB_EXTRA_MODE = "Desired total distance"
DEFAULT_AB_EXTRA_PERCENT = 25.0
DEFAULT_AB_EXTRA_MILES = 1.0
DEFAULT_AB_EXTRA_MINUTES = 20
DEFAULT_AB_FINISH_TIME = "18:00:00"
A_TO_B_GOAL_MODES = [
    "Desired total distance",
    "Distance over optimal",
    "Percent over optimal",
    "Time over optimal",
    "Finish by time",
]
DEFAULT_AUTO_PICK_DAILY_ROUTE = False
DEFAULT_DAILY_PICK_TIME = "06:00:00"
DEFAULT_ROUTE_STYLE = "Balanced"
ROUTE_STYLES = [
    "Balanced",
    "Quiet Streets",
    "Flattest",
    "Most Variety",
    "Direct-ish",
    "Parks / Paths",
]
DEFAULT_ALLOW_RELAXED_FALLBACK = True
