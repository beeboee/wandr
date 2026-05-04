<div align="center">
  <img src="assets/wandr-logo.svg" alt="wandr logo" width="420" />

# wandr for Home Assistant

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=beeboee&repository=wandr&category=integration)
</div>

wandr is a Home Assistant custom integration for generating rotating walkable routes and exposing the route controls as normal Home Assistant entities, so you can build your own dashboard around it.

It supports loop routes, A-to-B routes, configurable route goals, street/segment blocking, daily route assignment, completion tracking, route history, route style preferences, Google Maps links, GPX/GeoJSON export, and mobile-friendly dashboard examples.

> **AI-generated code notice:** This project contains AI-generated code. Treat it as experimental community software. Review and test it before relying on it for daily use, safety decisions, or a production Home Assistant setup.

## Current status

wandr is a beta custom integration. It is intended to be installed through HACS as a custom repository or copied manually into Home Assistant for testing.

It is not affiliated with Home Assistant, HACS, Google Maps, OpenStreetMap, Nominatim, Overpass, or OpenTopoData.

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
- Street-specific avoid/block list with optional cross-street bounds
- Best-effort route quality scoring
- Relaxed fallback mode when strict generation fails
- Google Maps tap-to-open URL
- Generated route map preview
- Turn-by-turn style directions page
- GPX and GeoJSON exports
- Settings export/import support
- Optional configurable Lovelace card for building a wandr dashboard

## Install with HACS

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

wandr includes a configurable Lovelace card that can show as many or as few wandr sections as you want.

First, add this Lovelace resource:

```text
URL: /wandr/frontend/wandr-card.js
Resource type: JavaScript Module
```

Then add the card to a dashboard:

```yaml
type: custom:wandr-card
title: wandr
columns: 2
sections:
  - summary
  - stats
  - remote
  - map
  - directions
  - progress
```

You can also make smaller cards by choosing fewer sections:

```yaml
type: custom:wandr-card
title: Route Remote
columns: 1
sections:
  - remote
```

Available sections:

```text
summary
stats
remote
map
directions
progress
setup
a_to_b
avoid
export
```

The card follows Home Assistant theme variables by default. If your theme defines a primary color, wandr uses it. You can optionally define a wandr-specific accent in your theme:

```yaml
wandr-accent-color: '#24B33B'
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
sensor.wandr_duration
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
switch.wandr_loop_route
switch.wandr_auto_pick_daily_route
switch.wandr_allow_relaxed_fallback
text.wandr_start_address
text.wandr_end_address
text.wandr_blacklist
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
```

Services:

```yaml
wandr.generate_year
wandr.next_route
wandr.previous_route
wandr.random_route
wandr.pick_today_route
wandr.mark_completed
wandr.skip_today
wandr.set_blacklist
wandr.set_a_to_b_goal
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
