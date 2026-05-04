class WandrCard extends HTMLElement {
  static getStubConfig() {
    return {
      sections: ["summary", "stats", "remote", "map", "progress"],
      columns: 1,
      show_header: false,
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid card configuration");

    this.config = {
      sections: ["summary", "stats", "remote", "map", "progress"],
      columns: 1,
      show_header: false,
      ...config,
    };

    if (!Array.isArray(this.config.sections)) {
      this.config.sections = [this.config.sections];
    }

    this._renderStatic();
    this._updateDynamicValues();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._renderStatic();
    this._updateDynamicValues();
  }

  getCardSize() {
    const sectionCount = this.config?.sections?.length || 1;
    return Math.max(3, sectionCount * 2);
  }

  _state(entityId) {
    const value = this._hass?.states?.[entityId]?.state;
    if (value === undefined || value === null || value === "unknown" || value === "unavailable") return "—";
    return value;
  }

  _number(entityId) {
    const value = Number(this._state(entityId));
    return Number.isFinite(value) ? value : 0;
  }

  _callService(service) {
    if (!this._hass || !service) return;
    this._hass.callService("wandr", service);
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    const event = new Event("hass-more-info", { bubbles: true, cancelable: false, composed: true });
    event.detail = { entityId };
    this.dispatchEvent(event);
  }

  _openUrl(entityId, fallbackUrl = "") {
    const url = this._state(entityId);
    const target = url && url !== "—" && /^https?:\/\//.test(url) ? url : fallbackUrl;
    if (!target) return;
    window.open(target, "_blank", "noopener,noreferrer");
  }

  _formatSummary() {
    const distance = this._state("sensor.wandr_distance");
    const duration = this._state("sensor.wandr_estimated_duration");
    const gain = this._state("sensor.wandr_elevation_gain");
    return `${distance} mi · ${duration} min · ${gain} ft gain`;
  }

  _button(label, icon, service, extraClass = "") {
    return `
      <button class="wandr-button ${extraClass}" data-service="${service}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span>${label}</span>
      </button>
    `;
  }

  _simpleTile(entityId, label, icon) {
    return `
      <button class="wandr-tile" data-entity="${entityId}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="wandr-label">${label}</span>
        <span class="wandr-value" data-state="${entityId}">—</span>
      </button>
    `;
  }

  _distanceTile() {
    return `
      <button class="wandr-tile wandr-tile-large" data-entity="sensor.wandr_distance" type="button">
        <ha-icon icon="mdi:map-marker-distance"></ha-icon>
        <span class="wandr-label">Distance</span>
        <span class="wandr-value"><span data-state="sensor.wandr_distance">—</span> mi</span>
      </button>
    `;
  }

  _durationTile() {
    return `
      <button class="wandr-tile wandr-tile-large" data-entity="sensor.wandr_estimated_duration" type="button">
        <ha-icon icon="mdi:clock-outline"></ha-icon>
        <span class="wandr-label">Duration</span>
        <span class="wandr-value"><span data-state="sensor.wandr_estimated_duration">—</span> min</span>
      </button>
    `;
  }

  _elevationTile() {
    return `
      <button class="wandr-tile wandr-visual-tile" data-entity="sensor.wandr_elevation_gain" type="button">
        <div class="wandr-slope" data-visual="elevation"><span></span></div>
        <span class="wandr-label">Elevation</span>
        <span class="wandr-value"><span data-state="sensor.wandr_elevation_gain">—</span> ft</span>
      </button>
    `;
  }

  _qualityTile() {
    return `
      <button class="wandr-tile wandr-visual-tile" data-entity="sensor.wandr_route_quality_score" type="button">
        <div class="wandr-ring" data-visual="quality"><span data-state="sensor.wandr_route_quality_score">—</span></div>
        <span class="wandr-label">Quality</span>
        <span class="wandr-value">route fit</span>
      </button>
    `;
  }

  _row(entityId, label, icon) {
    return `
      <button class="wandr-row" data-entity="${entityId}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="wandr-label">${label}</span>
        <span class="wandr-value" data-state="${entityId}">—</span>
      </button>
    `;
  }

  _sectionSummary() {
    return `
      <section class="wandr-section wandr-summary">
        <div class="wandr-summary-icon"><ha-icon icon="mdi:walk"></ha-icon></div>
        <div class="wandr-summary-copy">
          <div class="wandr-route-name" data-state="sensor.wandr_route_name">—</div>
          <div class="wandr-muted" data-summary="route">—</div>
        </div>
      </section>
    `;
  }

  _sectionStats() {
    return `
      <section class="wandr-section">
        <div class="wandr-grid wandr-grid-4">
          ${this._distanceTile()}
          ${this._durationTile()}
          ${this._elevationTile()}
          ${this._qualityTile()}
        </div>
      </section>
    `;
  }

  _sectionRemote() {
    return `
      <section class="wandr-section">
        <div class="wandr-grid wandr-grid-4 wandr-remote-grid">
          ${this._button("Prev", "mdi:chevron-left", "previous_route")}
          ${this._button("Today", "mdi:calendar-star", "pick_daily_route", "wandr-primary")}
          ${this._button("Next", "mdi:chevron-right", "next_route")}
          ${this._button("Random", "mdi:dice-5", "random_route")}
          ${this._button("Generate", "mdi:refresh", "generate_year")}
          ${this._button("Done", "mdi:check-circle", "mark_completed", "wandr-primary")}
          ${this._button("Skip", "mdi:skip-next-circle", "skip_today", "wandr-warning")}
          <button class="wandr-button" data-url="sensor.wandr_google_maps_url" data-fallback-url="/local/wandr/current_route.html" type="button">
            <ha-icon icon="mdi:google-maps"></ha-icon>
            <span>Maps</span>
          </button>
        </div>
      </section>
    `;
  }

  _sectionMap() {
    return `
      <section class="wandr-section wandr-map-section">
        <iframe class="wandr-frame" src="/local/wandr/current_route.html"></iframe>
      </section>
    `;
  }

  _sectionDirections() {
    return `
      <section class="wandr-section wandr-map-section">
        <iframe class="wandr-frame wandr-directions-frame" src="/local/wandr/current_directions.html"></iframe>
      </section>
    `;
  }

  _sectionProgress() {
    return `
      <section class="wandr-section">
        <div class="wandr-grid wandr-grid-4">
          ${this._simpleTile("sensor.wandr_current_streak", "Streak", "mdi:fire")}
          ${this._simpleTile("sensor.wandr_this_week_walks", "Week", "mdi:calendar-week")}
          ${this._simpleTile("sensor.wandr_this_week_miles", "Week Miles", "mdi:map-marker-distance")}
          ${this._simpleTile("sensor.wandr_this_month_miles", "Month Miles", "mdi:map")}
        </div>
      </section>
    `;
  }

  _sectionSetup() {
    return `
      <section class="wandr-section">
        <div class="wandr-list">
          ${this._row("text.wandr_start_address", "Start Address", "mdi:map-marker")}
          ${this._row("switch.wandr_loop_route", "Loop Route", "mdi:map-marker-path")}
          ${this._row("text.wandr_end_address", "End Address", "mdi:map-marker-check")}
          ${this._row("number.wandr_target_miles", "Desired Miles", "mdi:map-marker-distance")}
          ${this._row("number.wandr_pace", "Walking Pace", "mdi:speedometer")}
          ${this._row("select.wandr_route_style", "Route Style", "mdi:routes")}
          ${this._row("switch.wandr_allow_relaxed_fallback", "Relaxed Fallback", "mdi:shield-check-outline")}
        </div>
      </section>
    `;
  }

  _sectionAToB() {
    return `
      <section class="wandr-section">
        <div class="wandr-list">
          ${this._row("select.wandr_a_to_b_goal_mode", "Goal Mode", "mdi:target")}
          ${this._row("number.wandr_a_to_b_extra_miles", "Extra Miles", "mdi:map-plus")}
          ${this._row("number.wandr_a_to_b_extra_percent", "Extra Percent", "mdi:percent")}
          ${this._row("number.wandr_a_to_b_extra_minutes", "Extra Minutes", "mdi:timer-plus")}
          ${this._row("time.wandr_a_to_b_finish_by_time", "Finish By", "mdi:clock-end")}
          ${this._row("sensor.wandr_a_to_b_goal_plan", "Current Goal", "mdi:clipboard-text-outline")}
        </div>
      </section>
    `;
  }

  _sectionAvoid() {
    return `
      <section class="wandr-section">
        <div class="wandr-list">
          ${this._row("select.wandr_current_route_street", "Route Street", "mdi:road-variant")}
          ${this._row("text.wandr_street_to_avoid", "Street To Avoid", "mdi:map-marker-remove")}
          ${this._row("text.wandr_avoid_from_cross_street", "From Cross Street", "mdi:arrow-left-bottom")}
          ${this._row("text.wandr_avoid_to_cross_street", "To Cross Street", "mdi:arrow-right-top")}
          ${this._row("select.wandr_blocked_street_section", "Blocked Section", "mdi:block-helper")}
          ${this._row("sensor.wandr_blocked_street_sections", "Block Count", "mdi:counter")}
        </div>
        <div class="wandr-grid wandr-grid-2 wandr-actions-row">
          ${this._button("Block", "mdi:map-marker-remove", "add_blocked_section", "wandr-warning")}
          ${this._button("Generate", "mdi:refresh", "generate_year")}
        </div>
      </section>
    `;
  }

  _sectionExport() {
    return `
      <section class="wandr-section">
        <div class="wandr-grid wandr-grid-2">
          ${this._button("Export", "mdi:file-export", "export_settings")}
          ${this._button("Import", "mdi:file-import", "import_settings")}
        </div>
        <div class="wandr-list wandr-actions-row">
          ${this._row("sensor.wandr_directions_url", "Directions URL", "mdi:directions")}
          ${this._row("sensor.wandr_gpx_url", "GPX URL", "mdi:file-code-outline")}
          ${this._row("sensor.wandr_geojson_url", "GeoJSON URL", "mdi:code-json")}
        </div>
      </section>
    `;
  }

  _renderSection(section) {
    switch (section) {
      case "summary": return this._sectionSummary();
      case "stats": return this._sectionStats();
      case "remote": return this._sectionRemote();
      case "map": return this._sectionMap();
      case "directions": return this._sectionDirections();
      case "progress": return this._sectionProgress();
      case "setup": return this._sectionSetup();
      case "a_to_b": return this._sectionAToB();
      case "avoid": return this._sectionAvoid();
      case "export": return this._sectionExport();
      default: return `<section class="wandr-section"><div class="wandr-muted">Unknown section: ${section}</div></section>`;
    }
  }

  _renderStatic() {
    if (!this.config) return;
    const columns = Number(this.config.columns || 1);
    const safeColumns = Math.max(1, Math.min(columns, 3));
    const sectionHtml = this.config.sections.map((section) => this._renderSection(section)).join("");

    this.innerHTML = `
      <ha-card class="wandr-card">
        <style>
          .wandr-card {
            --wandr-accent: var(--wandr-accent-color, var(--primary-color));
            --wandr-radius: var(--ha-card-border-radius, 18px);
            --wandr-border: var(--divider-color);
            overflow: hidden;
          }

          .wandr-header { display: none; }

          .wandr-header ha-icon,
          .wandr-summary-icon ha-icon,
          .wandr-button ha-icon,
          .wandr-tile ha-icon,
          .wandr-row ha-icon { color: var(--wandr-accent); }

          .wandr-inner {
            display: grid;
            grid-template-columns: repeat(${safeColumns}, minmax(0, 1fr));
            gap: 12px;
            padding: 14px;
          }

          .wandr-section {
            border: 1px solid var(--wandr-border);
            border-radius: var(--wandr-radius);
            padding: 12px;
            background: var(--card-background-color);
            min-width: 0;
          }

          .wandr-summary,
          .wandr-map-section { grid-column: 1 / -1; }

          .wandr-summary {
            display: grid;
            grid-template-columns: 42px 1fr;
            align-items: center;
            gap: 12px;
          }

          .wandr-summary-icon {
            width: 42px;
            height: 42px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            background: color-mix(in srgb, var(--wandr-accent) 14%, transparent);
          }

          .wandr-summary-icon ha-icon { width: 26px; height: 26px; }
          .wandr-muted,
          .wandr-label { color: var(--secondary-text-color); }

          .wandr-route-name {
            font-size: 24px;
            font-weight: 900;
            line-height: 1.1;
            margin: 0 0 4px;
          }

          .wandr-grid { display: grid; gap: 10px; }
          .wandr-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .wandr-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

          .wandr-button,
          .wandr-tile,
          .wandr-row {
            border: 1px solid var(--divider-color);
            background: var(--card-background-color);
            color: var(--primary-text-color);
            border-radius: calc(var(--wandr-radius) - 6px);
            cursor: pointer;
            font: inherit;
            min-width: 0;
          }

          .wandr-button {
            min-height: 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            font-weight: 750;
          }

          .wandr-primary {
            background: color-mix(in srgb, var(--wandr-accent) 18%, transparent);
            border-color: color-mix(in srgb, var(--wandr-accent) 35%, var(--divider-color));
          }

          .wandr-warning ha-icon { color: var(--warning-color); }

          .wandr-tile {
            min-height: 74px;
            padding: 10px;
            display: grid;
            grid-template-areas: 'icon label' 'icon value';
            grid-template-columns: 30px minmax(0, 1fr);
            align-items: center;
            column-gap: 8px;
            text-align: left;
          }

          .wandr-tile ha-icon { grid-area: icon; }
          .wandr-tile .wandr-label { grid-area: label; font-size: 12px; }
          .wandr-tile .wandr-value { grid-area: value; font-weight: 850; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .wandr-tile-large .wandr-value { font-size: 18px; }

          .wandr-visual-tile {
            grid-template-areas: 'visual label' 'visual value';
            grid-template-columns: 44px minmax(0, 1fr);
          }

          .wandr-slope {
            grid-area: visual;
            width: 38px;
            height: 38px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--wandr-accent) var(--elevation-intensity, 18%), transparent);
            display: grid;
            place-items: center;
            overflow: hidden;
          }

          .wandr-slope span {
            display: block;
            width: 28px;
            height: 4px;
            border-radius: 999px;
            background: var(--wandr-accent);
            transform: rotate(var(--elevation-angle, 0deg));
          }

          .wandr-ring {
            grid-area: visual;
            width: 40px;
            height: 40px;
            border-radius: 999px;
            display: grid;
            place-items: center;
            font-size: 11px;
            font-weight: 850;
            background: conic-gradient(var(--wandr-accent) var(--quality-percent, 0%), color-mix(in srgb, var(--disabled-text-color) 35%, transparent) 0);
          }

          .wandr-ring span {
            width: 30px;
            height: 30px;
            border-radius: 999px;
            display: grid;
            place-items: center;
            background: var(--card-background-color);
          }

          .wandr-list { display: grid; gap: 8px; }

          .wandr-row {
            min-height: 44px;
            padding: 8px 10px;
            display: grid;
            grid-template-columns: 28px minmax(0, 1fr) auto;
            align-items: center;
            gap: 8px;
            text-align: left;
          }

          .wandr-row .wandr-value {
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 700;
          }

          .wandr-actions-row { margin-top: 10px; }

          .wandr-frame {
            width: 100%;
            height: var(--wandr-frame-height, 360px);
            border: 0;
            border-radius: calc(var(--wandr-radius) - 6px);
            background: var(--secondary-background-color);
            display: block;
          }

          .wandr-directions-frame { height: var(--wandr-directions-frame-height, 300px); }

          @media (max-width: 900px) {
            .wandr-inner { grid-template-columns: 1fr; }
          }

          @media (max-width: 600px) {
            .wandr-inner { padding: 12px; }
            .wandr-grid-4,
            .wandr-remote-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .wandr-frame { height: var(--wandr-frame-height, 320px); }
            .wandr-row .wandr-value { max-width: 120px; }
          }
        </style>
        ${this.config.show_header ? `<div class="wandr-header"><ha-icon icon="mdi:map-marker-path"></ha-icon><span>${this.config.title}</span></div>` : ""}
        <div class="wandr-inner">${sectionHtml}</div>
      </ha-card>
    `;

    this.querySelectorAll("[data-service]").forEach((button) => {
      button.addEventListener("click", () => this._callService(button.dataset.service));
    });

    this.querySelectorAll("[data-entity]").forEach((button) => {
      button.addEventListener("click", () => this._moreInfo(button.dataset.entity));
    });

    this.querySelectorAll("[data-url]").forEach((button) => {
      button.addEventListener("click", () => this._openUrl(button.dataset.url, button.dataset.fallbackUrl));
    });

    this._rendered = true;
  }

  _updateDynamicValues() {
    if (!this._hass || !this._rendered) return;

    this.querySelectorAll("[data-state]").forEach((node) => {
      node.textContent = this._state(node.dataset.state);
    });

    const summary = this.querySelector("[data-summary='route']");
    if (summary) summary.textContent = this._formatSummary();

    const elevation = this._number("sensor.wandr_elevation_gain");
    const elevationVisual = this.querySelector("[data-visual='elevation']");
    if (elevationVisual) {
      const capped = Math.max(0, Math.min(elevation, 600));
      const angle = Math.round((capped / 600) * 38);
      const intensity = Math.round(14 + (capped / 600) * 28);
      elevationVisual.style.setProperty("--elevation-angle", `${angle}deg`);
      elevationVisual.style.setProperty("--elevation-intensity", `${intensity}%`);
    }

    const quality = this._number("sensor.wandr_route_quality_score");
    const qualityVisual = this.querySelector("[data-visual='quality']");
    if (qualityVisual) {
      const percent = Math.max(0, Math.min(100, quality));
      qualityVisual.style.setProperty("--quality-percent", `${percent}%`);
    }
  }
}

customElements.define("wandr-card", WandrCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "wandr-card",
  name: "wandr Card",
  description: "Configurable wandr dashboard card with route summary, controls, map, setup, and progress sections.",
});
