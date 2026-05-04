# wandr for Home Assistant

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

## Repository structure

For HACS to detect this repository correctly, the repo must contain the integration folder at this exact path:

```text
custom_components/wandr/manifest.json
```

A correct repo root should look like this:

```text
wandr/
├── custom_components/
│   └── wandr/
│       ├── __init__.py
│       ├── manifest.json
│       ├── config_flow.py
│       ├── coordinator.py
│       ├── sensor.py
│       ├── switch.py
│       ├── select.py
│       ├── number.py
│       ├── text.py
│       ├── button.py
│       ├── binary_sensor.py
│       ├── time.py
│       ├── services.yaml
│       ├── strings.json
│       └── translations/
│           └── en.json
├── hacs.json
├── README.md
├── CHANGELOG.md
├── dashboard.yaml
└── onboarding_dashboard.yaml
```

If HACS says **“Repository structure is not compliant”**, the most likely cause is that `custom_components/wandr/` was not uploaded to GitHub.

## Install with HACS as a custom repository

This is the recommended install method once the GitHub repo structure is correct.

1. Make sure this repository contains:

   ```text
   custom_components/wandr/manifest.json
   ```

2. In Home Assistant, open **HACS**.

3. Open the three-dot menu in the top right.

4. Choose **Custom repositories**.

5. Paste the GitHub repository URL, for example:

   ```text
   https://github.com/beeboee/wandr
   ```

6. Set the category to **Integration**.

7. Click **Add**.

8. Find **wandr** in HACS and install it.

9. Restart Home Assistant.

10. Add the integration:

    ```text
    Settings → Devices & services → Add integration → wandr
    ```

## Manual install

Use this if you want to test wandr before setting up HACS.

1. Download or clone this repository.

2. Copy this folder:

   ```text
   custom_components/wandr
   ```

3. Paste it into your Home Assistant config folder here:

   ```text
   /config/custom_components/wandr
   ```

4. Confirm the final path looks like this:

   ```text
   /config/custom_components/wandr/manifest.json
   ```

5. Restart Home Assistant.

6. Add the integration:

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

wandr does not automatically replace your Home Assistant dashboard. It exposes entities that you can use in any dashboard.

This repo includes two example dashboard files:

```text
onboarding_dashboard.yaml
dashboard.yaml
```

Recommended setup:

1. Create a temporary dashboard/view called **wandr Setup**.
2. Use `onboarding_dashboard.yaml` while configuring the integration.
3. Create your normal daily dashboard/view called **wandr**.
4. Use `dashboard.yaml` as the starting point.
5. Edit the cards however you like.

The generated route files are available at:

```text
/local/wandr/current_route.html
/local/wandr/current_directions.html
/local/wandr/current_route.gpx
/local/wandr/current_route.geojson
/local/wandr/history.json
/local/wandr/settings_export.json
```

A useful dashboard usually includes:

- Today’s route summary
- Open in Google Maps button
- Route map iframe/card
- Directions iframe/card
- Mark Complete and Skip buttons
- Route generation controls
- Street/segment blocking controls
- Weekly/monthly progress cards

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
