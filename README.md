# Daily Walks for Home Assistant

Daily Walks generates rotating walkable routes and exposes the controls as normal Home Assistant entities so users can build their own dashboard.

## Current status

This is a polished beta package. It is installable through HACS as a custom repository, but it should still be treated as community/custom integration software, not a finished App Store product.

## Highlights

- Loop routes or A-to-B routes
- Start/end address editable from the UI
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
- Current route map at `/local/daily_walks/current_route.html`
- Turn-by-turn style directions at `/local/daily_walks/current_directions.html`
- GPX export at `/local/daily_walks/current_route.gpx`
- GeoJSON export at `/local/daily_walks/current_route.geojson`
- History export at `/local/daily_walks/history.json`
- Settings export at `/local/daily_walks/settings_export.json`

## Install with HACS as a custom repository

1. Upload this repo to GitHub.
2. In HACS, add it as a custom repository.
3. Category: Integration.
4. Install.
5. Restart Home Assistant.
6. Add the integration from Settings → Devices & services → Add integration → Daily Walks.

## Basic use

1. Set your start address.
2. Choose loop route or A-to-B route.
3. Pick route style and distance goal.
4. Press Generate Routes.
5. Use Pick Today Route, Next, Previous, or Random.
6. Mark Complete or Skip when done.

## Backups / restore

The integration continuously writes a settings export here:

`/local/daily_walks/settings_export.json`

To import settings:

1. Copy that JSON into Home Assistant as:
   `/config/www/daily_walks/settings_import.json`
2. Press the **Daily Walk Import Settings** button.
3. Press **Generate Routes**.

## Notes and limits

This integration uses OpenStreetMap/Nominatim/Overpass data and best-effort elevation data. Street-section blocking depends on OSM street and intersection names being present and consistent. If cross-street matching fails, the integration avoids the named street more broadly, because avoiding a bad segment is more important than preserving a route through it.

Route style scoring is heuristic. It improves route preference, but it is not a safety guarantee. Users should still sanity-check routes before walking them.
