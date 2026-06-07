# Changelog

## 1.1.1-beta

- Simplified the Home Assistant setup flow.
- Setup now only asks for:
  - Start / home address
  - Desired daily loop miles
- Moved advanced controls out of first setup and into runtime dashboard/card/entity controls.
- Default setup now creates a loop-mode wandr instance using sensible defaults:
  - 183 base routes
  - 3-mile target unless changed
  - 20 minutes per mile
  - Balanced route style
  - Relaxed fallback enabled
- A-to-B settings, route style, route count, pace, map app, and fallback behavior remain editable after setup.

## 1.1.0-beta

- Replaced coordinator monkey-patching with `EnhancedWandrCoordinator`.
- Moved compact route-library writing into the coordinator layer.
- Moved guarded first-run loop-library generation into the coordinator layer.
- Bulk route-library auto-generation only runs for loop/circle mode when a start/home address exists, no routes are loaded, and the current home/settings signature has not already been attempted.
- Replaced per-route export spam with compact route library files:
  - `/local/wandr/routes/index.json`
  - `/local/wandr/routes/routes.min.json`
  - `/local/wandr/routes/routes.pretty.json`
- Kept current-route exports available:
  - `/local/wandr/current_route.json`
  - `/local/wandr/current_route.html`
  - `/local/wandr/current_directions.html`
  - `/local/wandr/current_route.gpx`
  - `/local/wandr/current_route.geojson`
- Updated `custom:wandr-card` so Loop vs A-to-B presentation is card-specific via `route_mode`.
- Added visual-editor support for card content and card route mode.
- 
## 1.0.9-beta

- Changed bulk route-library generation to be guarded and first-run only.
- Automatic bulk generation now only runs when wandr is in loop/circle mode, a start/home address exists, no routes are already loaded, and the current home/settings signature has not already been attempted.
- Added a delayed startup/task-based auto-generation flow so Home Assistant can finish loading before wandr tries to build the local route library.
- Removed the need for the optional startup automation for the normal first-run loop route-library case.

## 1.0.8-beta

- Replaced the separate route and avoid custom card approach with one `custom:wandr-card` card type.
- Added a visual editor dropdown for the card content: Route + map, Avoid list, Generate, Navigate, Progress, and Files.
- Updated the example dashboard to use only `custom:wandr-card` with different `view` values.
- Added route-library artifact writing under `/local/wandr/routes/`, including `index.json`, `all_routes.json`, per-route JSON, directions HTML, GPX, and GeoJSON.
- Added an optional Home Assistant automation YAML example to generate the route library after startup when routes are missing or below the configured route count.

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
