class WandrCard extends HTMLElement {
  static getStubConfig() {
    return {
      sections: ["summary", "remote", "map", "progress"],
      columns: 1,
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid card configuration");
    }

    this.config = {
      title: "wandr",
      sections: ["summary", "remote", "map", "progress"],
      columns: 1,
      show_header: true,
      show_map: true,
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
    if (!this._rendered) {
      this._renderStatic();
    }
    this._updateDynamicValues();
  }

  getCardSize() {
    const sectionCount = this.config?.sections?.length || 1;
    return Math.max(3, sectionCount * 2);
  }

  _state(entityId) {
    const value = this._hass?.states?.[entityId]?.state;
    if (value === undefined || value === null || value === "unknown" || value === "unavailable") {
      return "—";
    }
    return value;
  }

  _callService(service) {
    if (!this._hass || !service) return;
    this._hass.callService("wandr", service);
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    const event = new Event("hass-more-info", {
      bubbles: true,
      cancelable: false,
      composed: true,
    });
    event.detail = { entityId };
    this.dispatchEvent(event);
  }

  _openUrl(entityId) {
    const url = this._state(entityId);
    if (!url || url === "—") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  _formatSummary() {
    const distance = this._state("sensor.wandr_distance");
    const duration = this._state("sensor.wandr_estimated_duration");
    const gain = this._state("sensor.wandr_elevation_gain");
    return `${distance} · ${duration} · ${gain} gain`;
  }

  _button(label, icon, service, extraClass = "") {
    return `
      <button class="wandr-button ${extraClass}" data-service="${service}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span>${label}</span>
      </button>
    `;
  }

  _tile(entityId, label, icon) {
    return `
      <button class="wandr-tile" data-entity="${entityId}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="wandr-label">${label}</span>
        <span class="wandr-value" data-state="${entityId}">—</span>
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
          <div class="wandr-kicker">Today's Route</div>
          <div class="wandr-route-name" data-state="sensor.wandr_route_name">—</div>
          <div class="wandr-muted" data-summary="route">—</div>
        </div>
      </section>
    `;
  }

  _sectionStats() {
    return `
      <section class="wandr-section">
        <div class="wandr-section-title">Route Stats</div>
        <div class="wandr-grid wandr-grid-4">
          ${this._tile("sensor.wandr_distance", "Distance", "mdi:map-marker-distance")}
          ${this._tile("sensor.wandr_estimated_duration", "Duration", "mdi:clock-outline")}
          ${this._tile("sensor.wandr_elevation_gain", "Elevation", "mdi:elevation-rise")}
          ${this._tile("sensor.wandr_route_quality_score", "Quality", "mdi:star-outline")}
        </div>
      </section>
    `;
  }

  _sectionRemote() {
    return `
      <section class="wandr-section">
        <div class="wandr-section-title">Route Remote</div>
        <div class="wandr-grid wandr-grid-4 wandr-remote-grid">
          ${this._button("Prev", "mdi:chevron-left", "previous_route")}
          ${this._button("Today", "mdi:calendar-star", "pick_daily_route", "wandr-primary")}
          ${this._button("Next", "mdi:chevron-right", "next_route")}
          ${this._button("Random", "mdi:dice-5", "random_route")}
          ${this._button("Generate", "mdi:refresh", "generate_year")}
          ${this._button("Done", "mdi:check-circle", "mark_completed", "wandr-primary")}
          ${this._button("Skip", "mdi:skip-next-circle", "skip_today", "wandr-warning")}
          <button class="wandr-button" data-url="sensor.wandr_google_maps_url" type="button">
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
        <div class="wandr-section-title">Map</div>
        <iframe class="wandr-frame" src="/local/wandr/current_route.html"></iframe>
      </section>
    `;
  }

  _sectionDirections() {
    return `
      <section class="wandr-section wandr-map-section">
        <div class="wandr-section-title">Directions</div>
        <iframe class="wandr-frame wandr-directions-frame" src="/local/wandr/current_directions.html"></iframe>
      </section>
    `;
  }

  _sectionProgress() {
    return `
      <section class="wandr-section">
        <div class="wandr-section-title">Progress</div>
        <div class="wandr-grid wandr-grid-4">
          ${this._tile("sensor.wandr_current_streak", "Streak", "mdi:fire")}
          ${this._tile("sensor.wandr_this_week_walks", "Week", "mdi:calendar-week")}
          ${this._tile("sensor.wandr_this_week_miles", "Week Miles", "mdi:map-marker-distance")}
          ${this._tile("sensor.wandr_this_month_miles", "Month Miles", "mdi:map")}
        </div>
      </section>
    `;
  }

  _sectionSetup() {
    return `
      <section class="wandr-section">
        <div class="wandr-section-title">Route Setup</div>
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
        <div class="wandr-section-title">A-to-B Goal</div>
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
        <div class="wandr-section-title">Avoid Streets</div>
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
        <div class="wandr-section-title">Export / Backup</div>
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

          .wandr-header {
            padding: 18px 18px 0;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 20px;
            font-weight: 850;
          }

          .wandr-header ha-icon,
          .wandr-summary-icon ha-icon,
          .wandr-button ha-icon,
          .wandr-tile ha-icon,
          .wandr-row ha-icon {
            color: var(--wandr-accent);
          }

          .wandr-inner {
            display: grid;
            grid-template-columns: repeat(${safeColumns}, minmax(0, 1fr));
            gap: 14px;
            padding: 18px;
          }

          .wandr-section {
            border: 1px solid var(--wandr-border);
            border-radius: var(--wandr-radius);
            padding: 14px;
            background: var(--card-background-color);
            min-width: 0;
          }

          .wandr-summary,
          .wandr-map-section {
            grid-column: 1 / -1;
          }

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

          .wandr-summary-icon ha-icon {
            width: 26px;
            height: 26px;
          }

          .wandr-section-title {
            font-weight: 850;
            margin-bottom: 12px;
          }

          .wandr-kicker,
          .wandr-muted,
          .wandr-label {
            color: var(--secondary-text-color);
          }

          .wandr-kicker {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .wandr-route-name {
            font-size: 24px;
            font-weight: 900;
            line-height: 1.1;
            margin: 2px 0 4px;
          }

          .wandr-grid {
            display: grid;
            gap: 10px;
          }

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
            min-height: 64px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-weight: 750;
          }

          .wandr-primary {
            background: color-mix(in srgb, var(--wandr-accent) 18%, transparent);
            border-color: color-mix(in srgb, var(--wandr-accent) 35%, var(--divider-color));
          }

          .wandr-warning ha-icon {
            color: var(--warning-color);
          }

          .wandr-tile {
            min-height: 74px;
            padding: 10px;
            display: grid;
            grid-template-areas: 'icon label' 'icon value';
            grid-template-columns: 28px minmax(0, 1fr);
            align-items: center;
            column-gap: 8px;
            text-align: left;
          }

          .wandr-tile ha-icon { grid-area: icon; }
          .wandr-tile .wandr-label { grid-area: label; font-size: 12px; }
          .wandr-tile .wandr-value { grid-area: value; font-weight: 850; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

          .wandr-list {
            display: grid;
            gap: 8px;
          }

          .wandr-row {
            min-height: 46px;
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

          .wandr-actions-row {
            margin-top: 10px;
          }

          .wandr-frame {
            width: 100%;
            height: var(--wandr-frame-height, 360px);
            border: 0;
            border-radius: calc(var(--wandr-radius) - 6px);
            background: var(--secondary-background-color);
            display: block;
          }

          .wandr-directions-frame {
            height: var(--wandr-directions-frame-height, 300px);
          }

          @media (max-width: 900px) {
            .wandr-inner {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 600px) {
            .wandr-inner,
            .wandr-header {
              padding-left: 14px;
              padding-right: 14px;
            }

            .wandr-grid-4,
            .wandr-remote-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .wandr-frame {
              height: var(--wandr-frame-height, 320px);
            }

            .wandr-row .wandr-value {
              max-width: 120px;
            }
          }
        </style>
        ${this.config.show_header ? `<div class="wandr-header"><ha-icon icon="mdi:map-marker-path"></ha-icon><span>${this.config.title}</span></div>` : ""}
        <div class="wandr-inner">
          ${sectionHtml}
        </div>
      </ha-card>
    `;

    this.querySelectorAll("[data-service]").forEach((button) => {
      button.addEventListener("click", () => this._callService(button.dataset.service));
    });

    this.querySelectorAll("[data-entity]").forEach((button) => {
      button.addEventListener("click", () => this._moreInfo(button.dataset.entity));
    });

    this.querySelectorAll("[data-url]").forEach((button) => {
      button.addEventListener("click", () => this._openUrl(button.dataset.url));
    });

    this._rendered = true;
  }

  _updateDynamicValues() {
    if (!this._hass || !this._rendered) return;

    this.querySelectorAll("[data-state]").forEach((node) => {
      const entityId = node.dataset.state;
      node.textContent = this._state(entityId);
    });

    const summary = this.querySelector("[data-summary='route']");
    if (summary) {
      summary.textContent = this._formatSummary();
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
