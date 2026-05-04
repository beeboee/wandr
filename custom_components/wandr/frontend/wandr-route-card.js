class WandrRouteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._lastKey = '';
    this._map = null;
    this._line = null;
    this._start = null;
    this._end = null;
    this._leafletPromise = null;
  }

  setConfig(config) {
    this._config = {
      route_entity: 'sensor.wandr_route_name',
      json_url: '/local/wandr/current_route.json',
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() { return 7; }

  _state(id) { return this._hass?.states?.[id]; }
  _value(id, fallback = '') {
    const state = this._state(id);
    if (!state || state.state === 'unknown' || state.state === 'unavailable') return fallback;
    return state.state;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        .card {
          background: var(--ha-card-background, var(--card-background-color));
          color: var(--primary-text-color);
          border-radius: 30px;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          box-shadow: var(--ha-card-box-shadow, 0 12px 30px rgba(0,0,0,.18));
        }
        .top { padding: 22px 22px 14px; display:flex; gap:16px; align-items:center; }
        .badge { width:56px; height:56px; border-radius:20px; display:grid; place-items:center; background:color-mix(in srgb, var(--primary-color) 22%, transparent); color:var(--primary-color); flex:0 0 auto; }
        .badge ha-icon { --mdc-icon-size: 31px; }
        .title { min-width:0; flex:1; }
        .name { font-size:29px; line-height:1.05; font-weight:850; letter-spacing:-.035em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .meta { margin-top:7px; opacity:.72; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .stats { padding: 0 18px 16px; display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:10px; }
        .stat { border-radius:22px; padding:14px 12px; min-height:64px; background:color-mix(in srgb, var(--primary-text-color) 5%, transparent); border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
        .stat-label { font-size:12px; opacity:.62; margin-bottom:8px; }
        .stat-value { font-size:20px; font-weight:800; letter-spacing:-.02em; }
        .mapbox { padding: 0 18px 18px; }
        #map { height: 310px; border-radius:25px; overflow:hidden; background:color-mix(in srgb, var(--primary-text-color) 5%, transparent); border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
        .actions { padding: 0 18px 20px; display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:10px; }
        button { border:0; border-radius:18px; padding:14px 10px; min-height:52px; color:var(--primary-text-color); background:color-mix(in srgb, var(--primary-text-color) 7%, transparent); font:inherit; font-weight:750; cursor:pointer; }
        button.primary { background:color-mix(in srgb, var(--primary-color) 30%, transparent); }
        button:active { transform:scale(.985); }
        .foot { padding:0 22px 18px; font-size:12px; opacity:.55; }
        @media (max-width: 600px) {
          .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          #map { height:260px; }
          .name { font-size:25px; }
        }
      </style>
      <div class="card">
        <div class="top">
          <div class="badge"><ha-icon icon="mdi:walk"></ha-icon></div>
          <div class="title"><div class="name" id="name">wandr</div><div class="meta" id="meta">Loading…</div></div>
        </div>
        <div class="stats">
          <div class="stat"><div class="stat-label">Distance</div><div class="stat-value" id="distance">—</div></div>
          <div class="stat"><div class="stat-label">Duration</div><div class="stat-value" id="duration">—</div></div>
          <div class="stat"><div class="stat-label">Elevation</div><div class="stat-value" id="elevation">—</div></div>
          <div class="stat"><div class="stat-label">Quality</div><div class="stat-value" id="quality">—</div></div>
        </div>
        <div class="mapbox"><div id="map"></div></div>
        <div class="actions">
          <button data-action="previous">Prev</button>
          <button data-action="random">Random</button>
          <button data-action="next">Next</button>
          <button data-action="today" class="primary">Today</button>
          <button data-action="open">Maps</button>
          <button data-action="done" class="primary">Done</button>
        </div>
        <div class="foot" id="foot">Updates when the route entity changes.</div>
      </div>`;
    this.shadowRoot.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => this._action(button.dataset.action));
    });
  }

  async _action(action) {
    const press = (entity_id) => this._hass?.callService('button', 'press', { entity_id });
    if (action === 'previous') return press('button.wandr_previous_route');
    if (action === 'random') return press('button.wandr_random_route');
    if (action === 'next') return press('button.wandr_next_route');
    if (action === 'today') return press('button.wandr_pick_today_route');
    if (action === 'done') return press('button.wandr_mark_completed');
    if (action === 'open') {
      const url = this._value('sensor.wandr_preferred_map_url') || this._value('sensor.wandr_google_maps_url');
      if (url) window.location.href = url;
    }
  }

  _loadLeaflet() {
    if (this._leafletPromise) return this._leafletPromise;
    this._leafletPromise = new Promise((resolve, reject) => {
      if (window.L) return resolve();
      if (!document.querySelector('link[data-wandr-leaflet]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.dataset.wandrLeaflet = '1';
        document.head.appendChild(link);
      }
      const existing = document.querySelector('script[data-wandr-leaflet]');
      if (existing) {
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.dataset.wandrLeaflet = '1';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return this._leafletPromise;
  }

  async _routeJson() {
    const url = `${this._config.json_url}?v=107&ts=${Date.now()}`;
    const res = await fetch(url, { cache:'no-store', headers:{ 'Cache-Control':'no-cache' } });
    if (!res.ok) throw new Error(`current_route.json ${res.status}`);
    return res.json();
  }

  async _update() {
    if (!this._hass || !this.shadowRoot) return;
    const entity = this._state(this._config.route_entity);
    const key = JSON.stringify([
      entity?.state,
      this._value('sensor.wandr_distance'),
      this._value('sensor.wandr_estimated_duration'),
      this._value('sensor.wandr_elevation_gain'),
      this._value('sensor.wandr_route_quality_score'),
    ]);
    if (key === this._lastKey) return;
    this._lastKey = key;

    const name = this._value('sensor.wandr_route_name', 'No route');
    const distance = this._value('sensor.wandr_distance', '—');
    const duration = this._value('sensor.wandr_estimated_duration', '—');
    const elevation = this._value('sensor.wandr_elevation_gain', '—');
    const quality = this._value('sensor.wandr_route_quality_score', '—');
    const mode = this._value('sensor.wandr_mode', '');

    this.shadowRoot.getElementById('name').textContent = name;
    this.shadowRoot.getElementById('meta').textContent = `${distance} mi · ${duration} min${mode ? ' · ' + mode : ''}`;
    this.shadowRoot.getElementById('distance').textContent = `${distance} mi`;
    this.shadowRoot.getElementById('duration').textContent = `${duration} min`;
    this.shadowRoot.getElementById('elevation').textContent = elevation === '—' ? '—' : `${elevation} ft`;
    this.shadowRoot.getElementById('quality').textContent = quality === '—' ? '—' : quality;

    try {
      const route = await this._routeJson();
      await this._draw(route);
      this.shadowRoot.getElementById('foot').textContent = 'Map synced from current_route.json.';
    } catch (err) {
      this.shadowRoot.getElementById('foot').textContent = `Map refresh failed: ${err.message}`;
    }
  }

  async _draw(route) {
    const coords = Array.isArray(route?.coords) ? route.coords : [];
    await this._loadLeaflet();
    const mapEl = this.shadowRoot.getElementById('map');
    if (!this._map) {
      this._map = L.map(mapEl, { zoomControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(this._map);
    }
    [this._line, this._start, this._end].forEach((layer) => layer && this._map.removeLayer(layer));
    this._line = this._start = this._end = null;

    if (!coords.length) {
      this._map.setView([39.8283, -98.5795], 4);
      return;
    }

    this._line = L.polyline(coords, { weight: 6, color: '#2f80ed' }).addTo(this._map);
    const same = JSON.stringify(coords[0]) === JSON.stringify(coords[coords.length - 1]);
    this._start = L.marker(coords[0]).addTo(this._map).bindPopup(same ? 'Start / End' : 'Start');
    if (!same) this._end = L.marker(coords[coords.length - 1]).addTo(this._map).bindPopup('End');
    this._map.fitBounds(this._line.getBounds(), { padding:[22,22] });
    setTimeout(() => this._map.invalidateSize(), 120);
  }
}

customElements.define('wandr-route-card', WandrRouteCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'wandr-route-card', name: 'wandr Route Card', description: 'Route summary, controls, and live map for wandr.' });
