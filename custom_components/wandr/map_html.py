from __future__ import annotations

import html
import json


def render_map_html(route):
    """Render the route map iframe.

    The Home Assistant dashboard may keep this iframe loaded while the backend
    changes routes. This page polls current_route.json so Next/Prev/Random can
    update the visible route without requiring the Lovelace card itself to reload.
    """
    coords = route.get("coords") if route else []
    title = html.escape(route.get("name", "No route generated") if route else "No route generated")
    coords_json = json.dumps(coords)
    distance = route.get("distance_miles", "?") if route else "?"
    duration = route.get("duration_minutes", "?") if route else "?"
    fallback = coords[0] if coords else [39.8283, -98.5795]
    fallback_json = json.dumps(fallback)

    return f'''<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{{height:100%;margin:0}}
.info{{position:absolute;z-index:999;left:10px;top:10px;background:white;padding:8px 10px;border-radius:8px;font-family:sans-serif;box-shadow:0 1px 8px #999;max-width:70%;line-height:1.25}}
.leaflet-container{{font-family:system-ui,sans-serif}}
</style></head>
<body><div id="map"></div><div class="info" id="info"><b>{title}</b><br>{distance} mi · {duration} min</div>
<script>
let coords = {coords_json};
const fallback = {fallback_json};
const map = L.map('map');

L.tileLayer('https://{{s}}.basemaps.cartocdn.com/rastertiles/voyager/{{z}}/{{x}}/{{y}}{{r}}.png', {{
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}}).addTo(map);

let routeLine = null;
let startMarker = null;
let endMarker = null;
let routeKey = '';

function escapeHtml(value) {{
  return String(value ?? '').replace(/[&<>"']/g, function (ch) {{
    return ({{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}})[ch];
  }});
}}

function clearLayer(layer) {{
  if (layer) {{
    map.removeLayer(layer);
  }}
}}

function setRoute(route, fit) {{
  const nextCoords = Array.isArray(route?.coords) ? route.coords : [];
  const nextKey = JSON.stringify([
    route?.name || '',
    route?.distance_miles || '',
    route?.duration_minutes || '',
    route?.elevation_gain_ft || '',
    nextCoords
  ]);

  if (nextKey === routeKey) {{
    return;
  }}
  routeKey = nextKey;
  coords = nextCoords;

  clearLayer(routeLine);
  clearLayer(startMarker);
  clearLayer(endMarker);
  routeLine = null;
  startMarker = null;
  endMarker = null;

  const name = route?.name || 'No route generated';
  const miles = route?.distance_miles ?? '?';
  const mins = route?.duration_minutes ?? '?';
  document.getElementById('info').innerHTML =
    '<b>' + escapeHtml(name) + '</b><br>' + escapeHtml(miles) + ' mi · ' + escapeHtml(mins) + ' min';

  if (coords.length) {{
    routeLine = L.polyline(coords, {{weight: 6, color: '#2f80ed'}}).addTo(map);
    const sameStartEnd = JSON.stringify(coords[0]) === JSON.stringify(coords[coords.length - 1]);
    startMarker = L.marker(coords[0]).addTo(map).bindPopup(sameStartEnd ? 'Start / End' : 'Start');
    if (!sameStartEnd) {{
      endMarker = L.marker(coords[coords.length - 1]).addTo(map).bindPopup('End');
    }}
    if (fit || !map._loaded) {{
      map.fitBounds(routeLine.getBounds(), {{padding:[20,20]}});
    }}
  }} else {{
    map.setView(fallback, 14);
  }}
}}

async function refreshRoute() {{
  try {{
    const response = await fetch('/local/wandr/current_route.json?ts=' + Date.now(), {{cache: 'no-store'}});
    if (!response.ok) return;
    const route = await response.json();
    setRoute(route, false);
  }} catch (err) {{
    // Keep the last visible route if Home Assistant is briefly unavailable.
  }}
}}

setRoute({{name: "{title}", distance_miles: "{distance}", duration_minutes: "{duration}", coords}}, true);
setInterval(refreshRoute, 1500);
refreshRoute();
</script></body></html>'''
