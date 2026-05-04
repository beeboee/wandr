# Changelog

## 1.0.3-beta

- Fixed setup form validation for numeric fields that could show `expected float` in Home Assistant.
- Added missing setup labels for route style and relaxed fallback.

## 1.0.2-beta

- Renamed remaining user-facing project references to wandr.
- Removed leftover Daily Walks wording from documentation and labels.


## 1.0.0-beta

Good stopping point / installable beta.

### Added

- Route style selector: Balanced, Quiet Streets, Flattest, Most Variety, Direct-ish, Parks / Paths.
- Route quality score sensor.
- Generation status, validation warning, and generation summary sensors.
- Relaxed fallback switch for route generation.
- Turn-by-turn style directions artifact and URL sensor.
- GPX and GeoJSON current-route exports.
- Settings export/import workflow.
- Export/import buttons and services.
- More complete dashboard and onboarding dashboard YAML.

### Improved

- Route generator now ranks accepted routes instead of using raw generation order.
- Map/directions/export URLs are exposed through route attributes and sensors.
- Last error now acts more like a user-facing generator status.

## 0.7.0

- Added A-to-B Goal Mode model.
- Added Desired total distance, Distance over optimal, Percent over optimal, Time over optimal, Finish by time.

## 0.6.0

- Made desired total A-to-B distance the default A-to-B model.

## 0.5.0

- Added route assignment.
- Added completion/skipping.
- Added history and progress sensors.
- Added street-specific blocked sections.
- Added mobile-first dashboard layout.
