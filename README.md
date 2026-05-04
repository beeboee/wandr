<div align="center">
  <img src="assets/wandr-logo.svg" alt="wandr logo" width="420" />

# wandr for Home Assistant
</div>

**Current version:** `1.0.6-beta`

wandr is a Home Assistant custom integration for generating rotating walkable routes and exposing the route controls as normal Home Assistant entities, so you can build your own dashboard around it.

It supports loop routes, A-to-B routes, configurable route goals, street/segment blocking, daily route assignment, completion tracking, route history, route style preferences, Google Maps links, GPX/GeoJSON export, and app-style dashboard cards.

> **AI-generated code notice:** This project contains AI-generated code. Treat it as experimental community software. Review and test it before relying on it for daily use, safety decisions, or a production Home Assistant setup.

## Current status

wandr is a beta custom integration. It is intended to be installed through HACS as a custom repository or copied manually into Home Assistant for testing.

It is not affiliated with Home Assistant, HACS, Google Maps, OpenStreetMap, Nominatim, Overpass, or OpenTopoData.

## Compatibility

wandr targets Home Assistant `2024.12.0` and newer.

Supported install types:

- Home Assistant OS / HAOS
- Home Assistant Container / Docker
- Home Assistant Supervised
- Home Assistant Core / venv, best effort

For setup-specific notes and troubleshooting, see [`SUPPORT.md`](SUPPORT.md).

wandr needs outbound HTTPS access to:

```text
nominatim.openstreetmap.org
overpass-api.de
api.opentopodata.org
```

## Features

- Loop routes or A-to-B routes
- Start/end address editable from the Home Assistant UI
- A-to-B goal modes:
  - Desired total distance
  - Distance over optimal
  - Percent over optimal
  - Time over optimal
  - Finish by time
- Route style selector:
  - Balanced
  - Quiet Streets
  - Flattest
  - Most Variety
  - Direct-ish
  - Parks / Paths
- Daily route assignment
- Completed/skipped tracking
- History, streak, weekly, and monthly progress sensors
- Street recognition from the current route for easier avoid rules
- Manual street/segment blocking with optional cross-street bounds
- Blocked-section list with remove action
- Best-effort route quality scoring
- Relaxed fallback mode when strict generation fails
- Google Maps tap-to-open URL
- Generated route map preview
- Turn-by-turn style directions page
- GPX and GeoJSON exports
- Settings export/import support
- Optional configurable Lovelace cards for building a wandr dashboard

## Install with HACS

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=beeboee&repository=wandr&category=integration)

This is the recommended install method.

1. In Home Assistant, open **HACS**.
2. Open the three-dot menu in the top right.
3. Choose **Custom repositories**.
4. Paste this repository URL:

   ```text
   https://github.com/beeboee/wandr
   ```

5. Set the category to **Integration**.
6. Click **Add**.
7. Find **wandr** in HACS and install it.
8. Restart Home Assistant.
9. Add the integration:

   ```text
   Settings → Devices & services → Add integration → wandr
   ```

## Manual install

Use this if you want to test wandr without HACS.

1. Download this repository.
2. Copy the `wandr` integration folder into Home Assistant:

   ```text
   /config/custom_components/wandr
   ```

3. Restart Home Assistant.
4. Add the integration:

   ```text
   Settings → Devices & services → Add integration → wandr
   ```

For Docker/Container installs, `/config` means the Home Assistant container's config path. The host folder depends on your volume mapping.

## First setup

After adding the integration:

1. Set your start address.
2. Choose **Loop route** or **A-to-B route**.
3. If using A-to-B, set your end address.
4. Choose a route style.
5. Choose a route goal mode.
6. Set your desired distance, extra distance, extra time, or finish-by time depending on the selected mode.
7. Press **Generate Routes**.
8. Press **Pick Today Route**, **Next Route**, **Previous Route**, or **Random Route**.
9. Open the route in Google Maps or use the generated route preview.
10. Mark the walk complete or skipped when done.

## Dashboard setup

wandr includes multiple Lovelace cards. The normal card picker should show these options after the resource is loaded:

```text
wandr Daily Walk
wandr Route Planner
wandr Avoid Segments
wandr Stats
wandr Custom Layout
```

First, add this Lovelace resource:

```text
URL: /wandr/frontend/wandr-card.js
Resource type: JavaScript Module
```

If you are updating the card and your browser keeps showing an old version, add a cache-buster:

```text
/wandr/frontend/wandr-card.js?v=6
```

### Daily Walk card

This is the recommended main dashboard card. It is app-style and focuses on the current route.

```yaml
type: custom:wandr-daily-card
```

Equivalent advanced form:

```yaml
type: custom:wandr-card
layout: daily
```

The Daily Walk card shows:

```text
Distance / duration / climb
Large route map
A-to-B destination shortcut
Previous / Random / Next
Today / Maps / Done / Skip
Compact monthly and streak stats
```

### Route Planner card

Use this for route setup and generation controls.

```yaml
type: custom:wandr-planner-card
```

Equivalent advanced form:

```yaml
type: custom:wandr-card
layout: planner
```

The Route Planner card shows start/end address, route type, desired miles, pace, route style, map app, relaxed fallback, A-to-B goal settings, and generation controls.

### Avoid Segments card

Use this when you want to block a street or part of a street.

```yaml
type: custom:wandr-avoid-card
```

Equivalent advanced form:

```yaml
type: custom:wandr-card
layout: avoid
```

The Avoid Segments card is designed around two workflows:

1. **Recognized street workflow**
   - Generate a route.
   - Open the Avoid Segments card.
   - Tap **Recognized route street** and choose a street from the current route.
   - Optionally set **From cross street** and **To cross street**.
   - Press **Add**.

2. **Manual input workflow**
   - Tap **Street to avoid** and type a street name.
   - Optionally set **From cross street** and **To cross street**.
   - Press **Add**.

The blocked list is shown as **Blocked list**. Select an existing blocked segment, then press **Remove** to delete it. Press **Regenerate** afterward if you want to immediately rebuild routes around the updated avoid list.

Street recognition depends on the streets present in the current generated route. Cross-street matching depends on OpenStreetMap data quality.

### Stats card

Use this for a compact progress card.

```yaml
type: custom:wandr-stats-card
```

Equivalent advanced form:

```yaml
type: custom:wandr-card
layout: stats
```

### Custom layout card

Advanced users can still build a custom card from sections.

```yaml
type: custom:wandr-card
layout: custom
sections:
  - hero_stats
  - map
  - daily_controls
  - progress_compact
```

Available custom sections:

```text
hero_stats
summary
map
daily_controls
planner
a_to_b
generation_controls
avoid
progress_compact
progress
export
```

The generated route files are available at:

```text
/local/wandr/current_route.html
/local/wandr/current_directions.html
/local/wandr/current_route.gpx
/local/wandr/current_route.geojson
/local/wandr/history.json
/local/wandr/settings_export.json
```

## Main entities

Common sensors:

```text
sensor.wandr_route_name
sensor.wandr_distance
sensor.wandr_estimated_duration
sensor.wandr_elevation_gain
sensor.wandr_generation_status
sensor.wandr_last_generation_summary
sensor.wandr_validation_warnings
sensor.wandr_route_quality_score
sensor.wandr_google_maps_url
sensor.wandr_directions_url
sensor.wandr_gpx_url
sensor.wandr_geojson_url
```

Common controls:

```text
select.wandr_generation_type
select.wandr_current_route_street
select.wandr_blocked_street_section
switch.wandr_loop_route
switch.wandr_auto_pick_daily_route
switch.wandr_allow_relaxed_fallback
text.wandr_start_address
text.wandr_end_address
text.wandr_blacklist
text.wandr_street_to_avoid
text.wandr_avoid_from_cross_street
text.wandr_avoid_to_cross_street
number.wandr_target_miles
number.wandr_pace
number.wandr_base_route_count
select.wandr_route_style
select.wandr_a_to_b_goal_mode
button.wandr_generate_routes
button.wandr_pick_today_route
button.wandr_next_route
button.wandr_previous_route
button.wandr_random_route
button.wandr_mark_completed
button.wandr_skip_today
button.wandr_avoid_selected_street_section
button.wandr_remove_blocked_street_section
```

Services:

```yaml
wandr.generate_year
wandr.next_route
wandr.previous_route
wandr.random_route
wandr.pick_daily_route
wandr.pick_today_route
wandr.mark_completed
wandr.skip_today
wandr.set_blacklist
wandr.set_a_to_b_goal
wandr.add_blocked_section
wandr.remove_selected_blocked_section
wandr.export_settings
wandr.import_settings
```

## Street and segment blocking

wandr can avoid a full street name or a street section between two cross streets.

Examples:

```text
Street: N Example Alley
From cross street: N First Ave
To cross street: N Second Ave
```

Street-section blocking depends on OpenStreetMap data. If the street or cross streets are not mapped clearly, wandr may avoid the whole named street instead of only the requested section.

## Backups and restore

wandr writes a settings export here:

```text
/local/wandr/settings_export.json
```

To import settings:

1. Copy the exported JSON to:

   ```text
   /config/www/wandr/settings_import.json
   ```

2. Press the **wandr Import Settings** button.
3. Press **Generate Routes**.

## Notes and limits

wandr uses OpenStreetMap/Nominatim/Overpass data and best-effort elevation data. The quality of routes depends on the quality of the local map data.

Route style scoring is heuristic. It can prefer quieter, flatter, more varied, or more direct routes, but it is not a safety guarantee.

Always sanity-check generated routes before walking them, especially in unfamiliar areas, after dark, near highways, or around private roads/paths.
