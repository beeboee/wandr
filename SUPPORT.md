# wandr support and compatibility

wandr is intended to work across the common Home Assistant install types, but each setup has slightly different failure points.

## Supported Home Assistant install types

| Install type | Status | Notes |
| --- | --- | --- |
| Home Assistant OS / HAOS | Supported | Recommended path is HACS. Manual installs usually use Studio Code Server, File Editor, Samba, or the SSH add-on. |
| Home Assistant Container / Docker | Supported | Make sure the integration is inside the container's `/config/custom_components/wandr` path, not only on the host path. |
| Home Assistant Supervised | Supported | Similar to HAOS, but host permissions and add-ons can vary by system. |
| Home Assistant Core / venv | Best effort | Works if dependencies and file permissions are correct. HACS/custom component setup is more manual. |

## Supported Home Assistant versions

wandr targets Home Assistant `2024.12.0` and newer.

The integration should avoid hard failures when Home Assistant frontend/static-path APIs differ between versions. If the bundled Lovelace card cannot be registered automatically, the backend integration should still load.

## Required network access

Route generation needs outbound HTTPS access to these public services:

```text
nominatim.openstreetmap.org
overpass-api.de
api.opentopodata.org
```

If route generation fails in Docker, check DNS, firewall rules, VPN routing, Pi-hole blocking, and whether the Home Assistant container has normal internet access.

## Important paths

Inside Home Assistant, wandr uses these paths:

```text
/config/custom_components/wandr
/config/www/wandr
```

The generated dashboard/map files are served by Home Assistant under:

```text
/local/wandr/current_route.html
/local/wandr/current_directions.html
/local/wandr/current_route.gpx
/local/wandr/current_route.geojson
/local/wandr/history.json
/local/wandr/settings_export.json
```

For Docker/Container users, `/config` is the path inside the Home Assistant container. The host path depends on how the container volume is mounted.

Example:

```text
Host path:      /mnt/user/appdata/homeassistant
Container path: /config
```

## Lovelace card resource

The bundled custom card is served from:

```text
/wandr/frontend/wandr-card.js
```

Add it in Home Assistant:

```text
Settings → Dashboards → Resources → Add Resource
```

Use:

```text
URL: /wandr/frontend/wandr-card.js
Resource type: JavaScript Module
```

If the card does not load, the backend integration can still work. Use normal Home Assistant entity cards until the frontend resource issue is fixed.

## Common errors

### Invalid handler specified

Usually means Home Assistant could not import the integration or its config flow.

Check logs for the real error:

```bash
grep -i "wandr\|config flow\|invalid handler" /config/home-assistant.log | tail -80
```

Common causes:

- stale HACS download
- Home Assistant not fully restarted
- Python import error
- version-specific Home Assistant API changed
- files are nested incorrectly under `custom_components`

### Card not found: custom:wandr-card

Usually means the Lovelace resource was not added, did not load, or the browser has cached the old dashboard resources.

Try:

1. Confirm the resource URL is `/wandr/frontend/wandr-card.js`.
2. Confirm the resource type is `JavaScript Module`.
3. Restart Home Assistant.
4. Hard refresh the browser or clear frontend cache.

### Route files return 404

The route files are written after wandr loads and when routes are generated. If `/local/wandr/current_route.html` is missing:

1. Make sure the integration loaded successfully.
2. Press **Generate Routes**.
3. Check that Home Assistant can write to `/config/www/wandr`.

### Geocoding fails

Check that the start address is complete enough for Nominatim. Use a full street address, city, and state/province when possible.

Also check outbound access to:

```text
nominatim.openstreetmap.org
```

### Overpass timeout or no walkable street data

Overpass can be slow or rate-limited. Try again later, remove avoid-list items, reduce route count, or use a more walkable/start area.

### Permission errors in Docker/Core

Make sure the Home Assistant process can write to:

```text
/config/www/wandr
```

Container users should check the host directory permissions for the mounted config volume.

## Reporting issues

When reporting a problem, include:

- Home Assistant version
- install type: HAOS, Container/Docker, Supervised, or Core
- wandr version
- whether it was installed through HACS or manually
- the relevant log lines from `home-assistant.log`
- whether `/config/www/wandr` exists and is writable
