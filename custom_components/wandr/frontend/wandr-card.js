class WandrCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._lastKey = "";
    this._map = null;
    this._line = null;
    this._start = null;
    this._end = null;
    this._leafletPromise = null;
  }

  static getConfigElement() {
    return document.createElement("wandr-card-editor");
  }

  static getStubConfig() {
    return {
      view: "route",
      route_mode: "current",
    };
  }

  setConfig(config) {
    this._config = {
      view: "route",
      route_mode: "current",
      route_entity: "sensor.wandr_route_name",
      json_url: "/local/wandr/current_route.json",
      ...config,
    };

    this._lastKey = "";
    this._map = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  getCardSize() {
    const view = this._config.view || "route";
    if (view === "route") return 7;
    if (view === "avoid") return 5;
    return 4;
  }

  _state(entityId) {
    return this._hass?.states?.[entityId];
  }

  _value(entityId, fallback = "") {
    const state = this._state(entityId);
    if (!state || state.state === "unknown" || state.state === "unavailable") {
      return fallback;
    }
    return state.state;
  }

  _routeModeLabel() {
    const mode = this._config.route_mode || "current";
    if (mode === "loop") return "Loop";
    if (mode === "a_to_b") return "A-to-B";
    return this._value("sensor.wandr_mode", "Current");
  }

  _desiredGenerationType() {
    const mode = this._config.route_mode || "current";
    if (mode === "loop") return "Loop route";
    if (mode === "a_to_b") return "A-to-B route";
    return "";
  }

  _styles() {
    return `
      :host { display:block; }
      .card {
        border-radius: 28px;
        background: var(--ha-card-background, var(--card-background-color));
        color: var(--primary-text-color);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
        box-shadow: var(--ha-card-box-shadow, 0 12px 30px rgba(0,0,0,.18));
        overflow: hidden;
      }
      .pad { padding: 22px; }
      .head { display:flex; gap:14px; align-items:center; margin-bottom:16px; }
      .badge {
        width:52px; height:52px; border-radius:19px;
        display:grid; place-items:center;
        background: color-mix(in srgb, var(--primary-color) 22%, transparent);
        color: var(--primary-color);
        flex: 0 0 auto;
      }
      .badge.warn {
        background: color-mix(in srgb, var(--warning-color, #f59e0b) 22%, transparent);
        color: var(--warning-color, #f59e0b);
      }
      .badge ha-icon { --mdc-icon-size:29px; }
      .title {
        font-size:25px;
        font-weight:850;
        letter-spacing:-.03em;
        line-height:1.08;
      }
      .sub {
        margin-top:4px;
        opacity:.68;
        font-size:13px;
        line-height:1.3;
      }
      .grid2 {
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap:10px;
      }
      .grid3 {
        display:grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap:10px;
      }
      .pill {
        border-radius:21px;
        padding:15px;
        background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        min-width:0;
      }
      .label {
        font-size:12px;
        opacity:.62;
        margin-bottom:7px;
      }
      .value {
        font-size:20px;
        font-weight:800;
        letter-spacing:-.02em;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      button {
        border:0;
        border-radius:18px;
        padding:14px 10px;
        min-height:50px;
        font:inherit;
        font-weight:800;
        color:var(--primary-text-color);
        background: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
        cursor:pointer;
      }
      button.primary {
        background: color-mix(in srgb, var(--primary-color) 30%, transparent);
      }
      button.warn {
        background: color-mix(in srgb, var(--warning-color, #f59e0b) 24%, transparent);
      }
      button:active { transform:scale(.985); }
      input, select {
        width:100%;
        box-sizing:border-box;
        border:0;
        outline:0;
        border-radius:18px;
        min-height:48px;
        padding:0 14px;
        background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
        color:var(--primary-text-color);
        font:inherit;
        font-weight:650;
        border:1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
      }
      label {
        display:block;
        font-size:12px;
        opacity:.65;
        margin:10px 0 6px 4px;
      }
      .mt { margin-top:14px; }
      .small {
        font-size:12px;
        opacity:.62;
        line-height:1.35;
      }
      .list {
        margin-top:16px;
        border-radius:22px;
        background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
        border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        overflow:hidden;
      }
      .item {
        padding:13px 14px;
        border-bottom:1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent);
      }
      .item:last-child { border-bottom:0; }
      .item-main {
        font-weight:780;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .item-sub {
        font-size:12px;
        opacity:.62;
        margin-top:3px;
      }
      #map {
        height:300px;
        border-radius:24px;
        overflow:hidden;
        background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
        border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent);
      }
      @media(max-width:560px) {
        .grid2, .grid3 { grid-template-columns:1fr; }
        #map { height:260px; }
      }
    `;
  }

  _render() {
    const view = this._config.view || "route";

    if (view === "avoid") return this._renderAvoid();
    if (view === "generate") return this._renderGenerate();
    if (view === "navigate") return this._renderNavigate();
    if (view === "progress") return this._renderProgress();
    if (view === "files") return this._renderFiles();

    return this._renderRoute();
  }

  _renderRoute() {
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="card">
        <div class="pad">
          <div class="head">
            <div class="badge"><ha-icon icon="mdi:walk"></ha-icon></div>
            <div style="min-width:0">
              <div class="title" id="name">wandr</div>
              <div class="sub" id="meta">Loading route…</div>
            </div>
          </div>

          <div class="grid2">
            <div class="pill"><div class="label">Distance</div><div class="value" id="distance">—</div></div>
            <div class="pill"><div class="label">Duration</div><div class="value" id="duration">—</div></div>
            <div class="pill"><div class="label">Elevation</div><div class="value" id="elevation">—</div></div>
            <div class="pill"><div class="label">Mode</div><div class="value" id="routeMode">—</div></div>
          </div>

          <div class="mt"><div id="map"></div></div>

          <div class="grid3 mt">
            <button data-action="previous">Prev</button>
            <button data-action="random">Random</button>
            <button data-action="next">Next</button>
            <button data-action="today" class="primary">Today</button>
            <button data-action="open">Maps</button>
            <button data-action="done" class="primary">Done</button>
          </div>

          <div class="small mt" id="foot">Synced from current_route.json.</div>
        </div>
      </div>
    `;

    this.shadowRoot
      .querySelectorAll("[data-action]")
      .forEach((button) => button.addEventListener("click", () => this._action(button.dataset.action)));
  }

  _renderAvoid() {
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="card">
        <div class="pad">
          <div class="head">
            <div class="badge warn"><ha-icon icon="mdi:map-marker-remove"></ha-icon></div>
            <div>
              <div class="title">Avoid list</div>
              <div class="sub">Add blocked streets or specific street sections.</div>
            </div>
          </div>

          <label>Pick from current route</label>
          <select id="streetSelect"></select>

          <label>Street or path to avoid</label>
          <input id="streetInput" placeholder="Street, path, trail, alley">

          <div class="grid2">
            <div>
              <label>From cross street</label>
              <input id="fromInput" placeholder="Optional">
            </div>
            <div>
              <label>To cross street</label>
              <input id="toInput" placeholder="Optional">
            </div>
          </div>

          <label>Existing block</label>
          <select id="blockedSelect"></select>

          <div class="grid3 mt">
            <button class="primary" id="addBtn">Add</button>
            <button class="warn" id="removeBtn">Remove</button>
            <button id="regenBtn">Regenerate</button>
          </div>

          <div class="list" id="listItems"></div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById("streetSelect").addEventListener("change", (event) => {
      this._pickStreet(event.target.value);
    });

    this.shadowRoot.getElementById("blockedSelect").addEventListener("change", (event) => {
      this._selectBlocked(event.target.value);
    });

    this.shadowRoot.getElementById("streetInput").addEventListener("change", (event) => {
      this._setText("text.wandr_street_to_avoid", event.target.value);
    });

    this.shadowRoot.getElementById("fromInput").addEventListener("change", (event) => {
      this._setText("text.wandr_avoid_from_cross_street", event.target.value);
    });

    this.shadowRoot.getElementById("toInput").addEventListener("change", (event) => {
      this._setText("text.wandr_avoid_to_cross_street", event.target.value);
    });

    this.shadowRoot.getElementById("addBtn").addEventListener("click", () => {
      this._press("button.wandr_avoid_selected_street_section");
    });

    this.shadowRoot.getElementById("removeBtn").addEventListener("click", () => {
      this._press("button.wandr_remove_blocked_street_section");
    });

    this.shadowRoot.getElementById("regenBtn").addEventListener("click", () => {
      this._press("button.wandr_generate_routes");
    });
  }

  _renderGenerate() {
    const modeLabel = this._routeModeLabel();

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="card">
        <div class="pad">
          <div class="head">
            <div class="badge"><ha-icon icon="mdi:tune"></ha-icon></div>
            <div>
              <div class="title">Generate</div>
              <div class="sub">
                This card is configured for ${this._esc(modeLabel)}. Changing route count or major settings requires Generate Routes.
              </div>
            </div>
          </div>

          <div class="grid2">
            <div class="pill">
              <div class="label">Requested base routes</div>
              <div class="value" id="configured">—</div>
            </div>
            <div class="pill">
              <div class="label">Generated routes</div>
              <div class="value" id="generated">—</div>
            </div>
            <div class="pill">
              <div class="label">Library status</div>
              <div class="value" id="libraryStatus">—</div>
            </div>
            <div class="pill">
              <div class="label">Card mode</div>
              <div class="value">${this._esc(modeLabel)}</div>
            </div>
          </div>

          <div class="grid2 mt">
            <button class="primary" data-action="generate">Generate Routes</button>
            <button data-action="library">Route Library</button>
          </div>

          <div class="small mt" id="summary">—</div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelector('[data-action="generate"]').addEventListener("click", async () => {
      await this._generateForCardMode();
    });

    this.shadowRoot.querySelector('[data-action="library"]').addEventListener("click", () => {
      window.location.href = "/local/wandr/routes/index.json";
    });
  }

  _renderProgress() {
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="card">
        <div class="pad">
          <div class="head">
            <div class="badge"><ha-icon icon="mdi:chart-line"></ha-icon></div>
            <div>
              <div class="title">Progress</div>
              <div class="sub">Walking streak and distance totals.</div>
            </div>
          </div>

          <div class="grid3">
            <div class="pill"><div class="label">Streak</div><div class="value" id="streak">—</div></div>
            <div class="pill"><div class="label">This week</div><div class="value" id="week">—</div></div>
            <div class="pill"><div class="label">This month</div><div class="value" id="month">—</div></div>
          </div>
        </div>
      </div>
    `;
  }

  _renderNavigate() {
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="card">
        <div class="pad">
          <div class="head">
            <div class="badge"><ha-icon icon="mdi:map"></ha-icon></div>
            <div>
              <div class="title">Navigate</div>
              <div class="sub">Open the current route in the selected map app.</div>
            </div>
          </div>

          <div class="grid2">
            <div class="pill"><div class="label">Map app</div><div class="value" id="mapApp">—</div></div>
            <button class="primary" data-action="open">Open Route</button>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelector('[data-action="open"]').addEventListener("click", () => {
      this._action("open");
    });
  }

  _renderFiles() {
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <div class="card">
        <div class="pad">
          <div class="head">
            <div class="badge"><ha-icon icon="mdi:file-export"></ha-icon></div>
            <div>
              <div class="title">Files</div>
              <div class="sub">Current exports and compact pre-generated route library.</div>
            </div>
          </div>

          <div class="grid2">
            <button data-open="/local/wandr/current_route.gpx">GPX</button>
            <button data-open="/local/wandr/current_route.geojson">GeoJSON</button>
            <button data-open="/local/wandr/current_directions.html">Directions</button>
            <button class="primary" data-open="/local/wandr/routes/index.json">Route Library</button>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-open]").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.href = button.dataset.open;
      });
    });
  }

  async _update() {
    if (!this._hass || !this.shadowRoot) return;

    const view = this._config.view || "route";

    if (view === "route") return this._updateRoute();
    if (view === "avoid") return this._updateAvoid();
    if (view === "generate") return this._updateGenerate();
    if (view === "progress") return this._updateProgress();
    if (view === "navigate") return this._updateNavigate();
  }

  async _updateRoute() {
    const key = JSON.stringify([
      this._value("sensor.wandr_route_name"),
      this._value("sensor.wandr_distance"),
      this._value("sensor.wandr_estimated_duration"),
      this._value("sensor.wandr_elevation_gain"),
      this._value("sensor.wandr_mode"),
    ]);

    if (key === this._lastKey) return;
    this._lastKey = key;

    const name = this._value("sensor.wandr_route_name", "No route");
    const distance = this._value("sensor.wandr_distance", "—");
    const duration = this._value("sensor.wandr_estimated_duration", "—");
    const elevation = this._value("sensor.wandr_elevation_gain", "—");
    const mode = this._routeModeLabel();

    this.shadowRoot.getElementById("name").textContent = name;
    this.shadowRoot.getElementById("meta").textContent = `${distance} mi · ${duration} min · ${mode}`;
    this.shadowRoot.getElementById("distance").textContent = `${distance} mi`;
    this.shadowRoot.getElementById("duration").textContent = `${duration} min`;
    this.shadowRoot.getElementById("elevation").textContent = elevation === "—" ? "—" : `${elevation} ft`;
    this.shadowRoot.getElementById("routeMode").textContent = mode;

    try {
      await this._draw(await this._routeJson());
      this.shadowRoot.getElementById("foot").textContent = "Map synced from current_route.json.";
    } catch (error) {
      this.shadowRoot.getElementById("foot").textContent = `Map refresh failed: ${error.message}`;
    }
  }

  _updateAvoid() {
    this._fillSelect(
      "streetSelect",
      this._optionsFrom("select.wandr_current_route_street"),
      this._value("select.wandr_current_route_street")
    );

    this._fillSelect(
      "blockedSelect",
      this._optionsFrom("select.wandr_blocked_street_section"),
      this._value("select.wandr_blocked_street_section")
    );

    this.shadowRoot.getElementById("streetInput").value = this._value("text.wandr_street_to_avoid");
    this.shadowRoot.getElementById("fromInput").value = this._value("text.wandr_avoid_from_cross_street");
    this.shadowRoot.getElementById("toInput").value = this._value("text.wandr_avoid_to_cross_street");

    const list = this.shadowRoot.getElementById("listItems");
    const items =
      this._state("sensor.wandr_avoid_list")?.attributes?.blocked_sections ||
      this._state("sensor.wandr_blocked_street_sections")?.attributes?.blocked_sections ||
      [];

    if (!items.length) {
      list.innerHTML = `<div class="item"><div class="item-sub">No blocked streets yet.</div></div>`;
      return;
    }

    list.innerHTML = items
      .map((item) => {
        const street = item.street || "Unnamed";
        const from = item.from || "";
        const to = item.to || "";
        const sub = from || to ? `${from || "?"} to ${to || "?"}` : "Whole named street/path";

        return `
          <div class="item">
            <div class="item-main">${this._esc(street)}</div>
            <div class="item-sub">${this._esc(sub)}</div>
          </div>
        `;
      })
      .join("");
  }

  _updateGenerate() {
    this.shadowRoot.getElementById("configured").textContent = this._value(
      "sensor.wandr_configured_route_count",
      "—"
    );
    this.shadowRoot.getElementById("generated").textContent = this._value(
      "sensor.wandr_generated_route_count",
      "—"
    );
    this.shadowRoot.getElementById("libraryStatus").textContent = this._value(
      "sensor.wandr_generation_status",
      "—"
    );
    this.shadowRoot.getElementById("summary").textContent = this._value(
      "sensor.wandr_last_generation_summary",
      "No generation summary yet."
    );
  }

  _updateProgress() {
    this.shadowRoot.getElementById("streak").textContent = `${this._value(
      "sensor.wandr_current_streak",
      "0"
    )} days`;

    this.shadowRoot.getElementById("week").textContent = `${this._value(
      "sensor.wandr_this_week_walks",
      "0"
    )} / ${this._value("sensor.wandr_this_week_miles", "0")} mi`;

    this.shadowRoot.getElementById("month").textContent = `${this._value(
      "sensor.wandr_this_month_walks",
      "0"
    )} / ${this._value("sensor.wandr_this_month_miles", "0")} mi`;
  }

  _updateNavigate() {
    this.shadowRoot.getElementById("mapApp").textContent = this._value(
      "sensor.wandr_map_app",
      "Ask every time"
    );
  }

  async _generateForCardMode() {
    const desired = this._desiredGenerationType();

    if (desired) {
      await this._hass?.callService("select", "select_option", {
        entity_id: "select.wandr_generation_type",
        option: desired,
      });
    }

    await this._press("button.wandr_generate_routes");
  }

  async _action(action) {
    if (action === "previous") return this._press("button.wandr_previous_route");
    if (action === "random") return this._press("button.wandr_random_route");
    if (action === "next") return this._press("button.wandr_next_route");
    if (action === "today") return this._press("button.wandr_pick_today_route");
    if (action === "done") return this._press("button.wandr_mark_completed");

    if (action === "open") {
      const url = this._value("sensor.wandr_preferred_map_url") || this._value("sensor.wandr_google_maps_url");
      if (url) window.location.href = url;
    }
  }

  _loadLeaflet() {
    if (this._leafletPromise) return this._leafletPromise;

    this._leafletPromise = new Promise((resolve, reject) => {
      if (window.L) return resolve();

      if (!document.querySelector("link[data-wandr-leaflet]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.dataset.wandrLeaflet = "1";
        document.head.appendChild(link);
      }

      const existing = document.querySelector("script[data-wandr-leaflet]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.dataset.wandrLeaflet = "1";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return this._leafletPromise;
  }

  async _routeJson() {
    const response = await fetch(`${this._config.json_url}?v=110&ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });

    if (!response.ok) throw new Error(`current_route.json ${response.status}`);
    return response.json();
  }

  async _draw(route) {
    const coords = Array.isArray(route?.coords) ? route.coords : [];

    await this._loadLeaflet();

    const mapEl = this.shadowRoot.getElementById("map");
    if (!this._map) {
      this._map = L.map(mapEl, { zoomControl: true });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      }).addTo(this._map);
    }

    [this._line, this._start, this._end].forEach((layer) => {
      if (layer) this._map.removeLayer(layer);
    });

    this._line = null;
    this._start = null;
    this._end = null;

    if (!coords.length) {
      this._map.setView([39.8283, -98.5795], 4);
      return;
    }

    this._line = L.polyline(coords, { weight: 6, color: "#2f80ed" }).addTo(this._map);

    const sameStartEnd = JSON.stringify(coords[0]) === JSON.stringify(coords[coords.length - 1]);

    this._start = L.marker(coords[0])
      .addTo(this._map)
      .bindPopup(sameStartEnd ? "Start / End" : "Start");

    if (!sameStartEnd) {
      this._end = L.marker(coords[coords.length - 1]).addTo(this._map).bindPopup("End");
    }

    this._map.fitBounds(this._line.getBounds(), { padding: [22, 22] });
    setTimeout(() => this._map.invalidateSize(), 120);
  }

  _optionsFrom(entityId) {
    return this._state(entityId)?.attributes?.options || [];
  }

  _fillSelect(id, options, selected) {
    const select = this.shadowRoot.getElementById(id);
    if (!select) return;

    const html = options
      .map((option) => {
        return `<option value="${this._esc(option)}" ${
          option === selected ? "selected" : ""
        }>${this._esc(option)}</option>`;
      })
      .join("");

    if (select.innerHTML !== html) select.innerHTML = html;
    if (selected) select.value = selected;
  }

  _setText(entityId, value) {
    return this._hass?.callService("text", "set_value", {
      entity_id: entityId,
      value,
    });
  }

  _press(entityId) {
    return this._hass?.callService("button", "press", {
      entity_id: entityId,
    });
  }

  _pickStreet(option) {
    if (!option || option === "No streets available") return;

    this._hass?.callService("select", "select_option", {
      entity_id: "select.wandr_current_route_street",
      option,
    });

    this._setText("text.wandr_street_to_avoid", option);
  }

  _selectBlocked(option) {
    if (!option || option === "No blocked sections") return;

    this._hass?.callService("select", "select_option", {
      entity_id: "select.wandr_blocked_street_section",
      option,
    });
  }

  _esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char];
    });
  }
}

class WandrCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
  }

  setConfig(config) {
    this._config = {
      view: "route",
      route_mode: "current",
      route_entity: "sensor.wandr_route_name",
      json_url: "/local/wandr/current_route.json",
      ...(config || {}),
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        .field { margin: 12px 0; }
        label {
          display:block;
          font-size:12px;
          opacity:.7;
          margin-bottom:6px;
        }
        select, input {
          width:100%;
          box-sizing:border-box;
          padding:10px;
          border-radius:8px;
          border:1px solid var(--divider-color);
          background:var(--card-background-color);
          color:var(--primary-text-color);
          font:inherit;
        }
      </style>

      <div class="field">
        <label>Card content</label>
        <select id="view">
          <option value="route">Route + map</option>
          <option value="avoid">Avoid list</option>
          <option value="generate">Generate</option>
          <option value="navigate">Navigate</option>
          <option value="progress">Progress</option>
          <option value="files">Files</option>
        </select>
      </div>

      <div class="field">
        <label>Route mode shown by this card</label>
        <select id="routeMode">
          <option value="current">Current backend mode</option>
          <option value="loop">Loop / circle</option>
          <option value="a_to_b">A-to-B</option>
        </select>
      </div>

      <div class="field">
        <label>Route entity</label>
        <input id="routeEntity">
      </div>

      <div class="field">
        <label>Route JSON URL</label>
        <input id="jsonUrl">
      </div>
    `;

    this.shadowRoot.getElementById("view").value = this._config.view || "route";
    this.shadowRoot.getElementById("routeMode").value = this._config.route_mode || "current";
    this.shadowRoot.getElementById("routeEntity").value =
      this._config.route_entity || "sensor.wandr_route_name";
    this.shadowRoot.getElementById("jsonUrl").value =
      this._config.json_url || "/local/wandr/current_route.json";

    this.shadowRoot.querySelectorAll("select,input").forEach((element) => {
      element.addEventListener("change", () => this._changed());
    });
  }

  _changed() {
    const config = {
      ...this._config,
      view: this.shadowRoot.getElementById("view").value,
      route_mode: this.shadowRoot.getElementById("routeMode").value,
      route_entity: this.shadowRoot.getElementById("routeEntity").value,
      json_url: this.shadowRoot.getElementById("jsonUrl").value,
    };

    this._config = config;

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define("wandr-card", WandrCard);
customElements.define("wandr-card-editor", WandrCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "wandr-card",
  name: "wandr Card",
  description:
    "One wandr card with a visual-editor dropdown for Route, Avoid List, Generate, Navigate, Progress, or Files.",
});
