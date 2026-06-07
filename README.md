<div align="center">
  <img src="assets/wandr-logo.svg" alt="wandr logo" width="420" />

# wandr for Home Assistant
</div>
`wandr` is a Home Assistant custom integration for generating rotating walking routes from a home/start address.

It is meant for people who want a daily walk that stays around a target distance, changes from day to day, avoids streets or paths they dislike, and can open the current route in a map app.

## What it does

* Generates loop walking routes from a start/home address
* Supports A-to-B route generation
* Creates a local route library for daily rotation
* Can generate 183 base loop routes, then mirror them clockwise/counterclockwise for 366 route instances
* Tracks the current route, distance, estimated duration, elevation, route quality, and progress stats
* Lets users block streets, paths, alleys, or street sections
* Provides route controls through Home Assistant entities and a custom Lovelace card
* Exports current route data as JSON, GPX, GeoJSON, and directions HTML
* Writes a compact local route library under `/local/wandr/routes/`

## Current state

`wandr` is installable through HACS as a custom repository.

It is not finished. The current goal is a polished beta that works well enough for real testing while keeping the codebase simple enough to keep improving.

Known rough edges:

* The route generator is still prototype-level.
* Only one active backend route library is supported at a time.
* Loop vs A-to-B can be configured per card for UI purposes, but true simultaneous saved Loop and A-to-B libraries are not implemented yet.
* Map-app chooser behavior depends on Android/iOS/browser defaults.
* The custom Lovelace card may need to be manually added as a frontend resource.

## Installation through HACS

### 1. Add the custom repository

In Home Assistant:

1. Open **HACS**
2. Go to **Integrations**
3. Open the three-dot menu
4. Choose **Custom repositories**
5. Add this repository:

```text
https://github.com/beeboee/wandr
```

Category:

```text
Integration
```

### 2. Install wandr

After adding the custom repository:

1. Search HACS for **wandr**
2. Install it
3. Restart Home Assistant

### 3. Add the integration

After restarting:

1. Go to **Settings**
2. Open **Devices & services**
3. Click **Add integration**
4. Search for **wandr**
5. Enter:

   * Start / home address
   * Desired daily loop miles

The setup flow is intentionally small. Most controls are changed later from the dashboard/card/entities.

## First-run route generation

For the normal loop-route use case, wandr can automatically build the first local route library.

Automatic bulk generation only runs when:

* wandr is in Loop route / circle mode
* a start/home address exists
* no routes are already loaded
* the current home/settings signature has not already been attempted

It waits about 90 seconds after startup/setup before generating, so Home Assistant has time to finish loading.

Default behavior aims for:

```text
183 base loop routes × clockwise/counterclockwise = 366 route instances
```

That gives roughly a full year of daily walks, with one spare.

You can manually rebuild routes any time by pressing:

```text
button.wandr_generate_routes
```

or by using the Generate view in the `custom:wandr-card`.

## Custom Lovelace card

wandr includes one custom card:

```yaml
type: custom:wandr-card
```

The card has different views controlled by the `view` option.

Valid views:

```yaml
view: route
view: avoid
view: generate
view: navigate
view: progress
view: files
```

The card also supports a card-specific route mode:

```yaml
route_mode: current
route_mode: loop
route_mode: a_to_b
```

Important: `route_mode` controls how that card presents and requests generation. The backend still has one active route library at a time.

### Add the card resource

If Home Assistant does not automatically recognize the card, add this resource manually:

```text
/wandr/frontend/wandr-card.js
```

Resource type:

```text
JavaScript module
```

In Home Assistant:

1. Go to **Settings**
2. Open **Dashboards**
3. Open the three-dot menu
4. Choose **Resources**
5. Add the JavaScript module above
6. Refresh the browser or clear frontend cache

## Example dashboard cards

### Route card

```yaml
type: custom:wandr-card
view: route
route_mode: current
route_entity: sensor.wandr_route_name
json_url: /local/wandr/current_route.json
```

### Loop generate card

```yaml
type: custom:wandr-card
view: generate
route_mode: loop
```

### A-to-B generate card

```yaml
type: custom:wandr-card
view: generate
route_mode: a_to_b
```

### Avoid-list card

```yaml
type: custom:wandr-card
view: avoid
```

### Navigate card

```yaml
type: custom:wandr-card
view: navigate
```

### Progress card

```yaml
type: custom:wandr-card
view: progress
```

### Files card

```yaml
type: custom:wandr-card
view: files
```

## Example dashboard

This repository includes:

```text
dashboard.yaml
```

You can copy that YAML into a Home Assistant dashboard as a starting point.

The dashboard is intentionally simple. It uses the single `custom:wandr-card` type with different `view` values, then keeps deeper route settings in normal Home Assistant entity cards.

## Route library files

wandr writes current route files here:

```text
/local/wandr/current_route.json
/local/wandr/current_route.html
/local/wandr/current_directions.html
/local/wandr/current_route.gpx
/local/wandr/current_route.geojson
```

It writes the compact route library here:

```text
/local/wandr/routes/index.json
/local/wandr/routes/routes.min.json
/local/wandr/routes/routes.pretty.json
```

The compact route library is preferred over writing hundreds of per-route GPX/GeoJSON/HTML files.

For 366 route instances, expected size should usually be small — likely megabytes, not gigabytes.

## Main entities

Entity names may vary slightly depending on Home Assistant naming, but the integration exposes controls like:

```text
button.wandr_generate_routes
button.wandr_next_route
button.wandr_previous_route
button.wandr_random_route
button.wandr_pick_today_route
button.wandr_mark_completed
button.wandr_skip_today
```

Common sensors include:

```text
sensor.wandr_route_name
sensor.wandr_distance
sensor.wandr_estimated_duration
sensor.wandr_elevation_gain
sensor.wandr_generation_status
sensor.wandr_last_generation_summary
sensor.wandr_generated_route_count
sensor.wandr_configured_route_count
sensor.wandr_avoid_list
sensor.wandr_preferred_map_url
```

Common settings include:

```text
text.wandr_start_address
text.wandr_end_address
number.wandr_target_miles
number.wandr_base_route_count
number.wandr_pace
select.wandr_generation_type
select.wandr_route_style
select.wandr_map_app
switch.wandr_allow_relaxed_fallback
```

## Avoid-list behavior

The avoid-list card lets you:

* pick a recognized street from the current route
* manually type a street, path, trail, or alley
* optionally add from/to cross streets
* add that item to the blocked list
* remove selected blocked items
* regenerate routes after changing the avoid list

Use full-street blocks when you never want to use a street/path. Use from/to cross streets when only one section is bad.

## A-to-B behavior

A-to-B routing supports goal modes such as:

* desired total distance
* distance over optimal
* percent over optimal
* time over optimal
* finish by time

These are runtime settings, not setup settings.

A-to-B route generation is user-requested. It does not currently auto-generate a yearly A-to-B library on first setup.

## Privacy and external services

wandr uses external OpenStreetMap-related data/services for geocoding, map/route graph data, and map display behavior.

Do not assume routes are generated fully offline.

Current external dependencies may include:

* OpenStreetMap / Nominatim-style geocoding
* Overpass-style OSM data lookup
* tile providers used by the map preview/card

Do not use this for sensitive location workflows without reviewing the code and network behavior.

## Development notes

The current architecture is moving toward:

```text
Base route engine:
custom_components/wandr/coordinator.py

Enhanced coordinator / library behavior:
custom_components/wandr/enhanced_coordinator.py

Lovelace UI:
custom_components/wandr/frontend/wandr-card.js
```

Older compatibility/prototype files may still exist temporarily, but the intended direction is:

* no coordinator monkey-patching
* compact route-library storage
* minimal setup flow
* polished runtime UI through `custom:wandr-card`
* normal HA entities preserved for automations

## Updating

After pushing or installing an update:

1. Open HACS
2. Open wandr
3. Choose **Redownload**
4. Restart Home Assistant
5. Refresh browser/app cache if the old card UI sticks

For frontend/card changes, mobile Companion App caching can be stubborn. A full app restart or frontend cache clear may be needed.

## Troubleshooting

### The custom card does not appear

Add this resource manually:

```text
/wandr/frontend/wandr-card.js
```

Type:

```text
JavaScript module
```

Then refresh the frontend.

### Route generation does not start

Check:

```text
sensor.wandr_generation_status
sensor.wandr_last_generation_summary
sensor.wandr_last_error
```

Also check Home Assistant logs for:

```text
wandr
```

### I changed route count but nothing changed

Changing the route count does not expand the existing library immediately.

After changing:

```text
number.wandr_base_route_count
```

press:

```text
button.wandr_generate_routes
```

### I want 365+ daily routes

Use loop mode and set:

```text
number.wandr_base_route_count = 183
```

Then generate routes.

Loop routes are mirrored:

```text
183 base routes × 2 directions = 366 route instances
```

## Roadmap

Likely next improvements:

* cleaner multi-library/profile support
* simultaneous saved Loop and A-to-B libraries
* better route generation scoring and clustering
* better generation progress reporting
* better native Home Assistant card/editor behavior
* on-demand GPX/GeoJSON export instead of writing unnecessary files
* cleaner first-run onboarding dashboard
* optional local-only/offline route library modes where practical

<details>
<summary>Disclaimer</summary>

```yaml
> **Code note:** this project was primarily AI-generated and should be reviewed, tested, and cleaned up before being treated as production-quality software.
```

</details>
