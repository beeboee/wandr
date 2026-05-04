# Changelog

## 1.0.7-beta

- Added a custom `wandr-route-card` Lovelace card with route summary, route controls, and a Leaflet map that updates from Home Assistant state instead of relying on an iframe.
- Added a custom `wandr-avoid-card` Lovelace card for a cleaner avoid-list workflow.
- Reworked the example dashboard to use the new custom route and avoid cards.
- Kept the existing entity-based controls and export files available for compatibility.

## 1.0.6-beta

- Strengthened the mobile map iframe refresh behavior with no-cache headers, a cache-busted JSON fetch, faster polling, focus refresh, page-show refresh, and visibility-change refresh.
- Added `Ask every time` as the default map app option, using a `geo:` URL that can trigger Android's app chooser when Android has no pinned default map app.
- Added a Configured Route Count sensor so the dashboard can show requested base routes separately from generated route instances.
- Updated the dashboard map and directions iframe URLs with cache-busting query strings.

## 1.0.5-beta

- Reworked the example dashboard into clearer sections: Today, Navigate, Generate, Avoid List, Progress, and Files & Backup.
- Added a Generation Type selector for Loop route vs A-to-B route.
- Added a Map App selector and preferred map URL sensor for Google Maps, Apple Maps, Waze, and OpenStreetMap.
- Added an Avoid List summary sensor so blocked streets/sections can be shown as a list card.
- Kept the existing street-section block workflow, but renamed dashboard controls around adding/removing avoid items.

## 1.0.4-beta

- Added a live-updating map renderer so the route preview can update after Next, Previous, or Random without relying on the dashboard iframe to reload.
- Switched the route preview tile layer away from OpenStreetMap's default tile server to avoid the `403r Access blocked` tile issue in Home Assistant.
- Added a simple local integration icon.

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
