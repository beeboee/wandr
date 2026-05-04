class WandrCard extends HTMLElement {
  static getStubConfig() {
    return {
      sections: ["summary", "remote", "map"],
      columns: 2,
    };
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid card configuration");
    }

    this.config = {
      title: "wandr",
      sections: ["summary", "stats", "remote", "map", "progress"],
      columns: 2,
      show_header: true,
      ...config,
    };

    if (!Array.isArray(this.config.sections)) {
      this.config.sections = [this.config.sections];
    }

    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  getCardSize() {
    const sectionCount = this.config?.sections?.length || 1;
    return Math.max(3, sectionCount * 2);
  }

  fire(type, detail = {}) {
    const event = new Event(type, {
      bubbles: true,
      cancelable: false,
      composed: true,
    });
    event.detail = detail;
    this.dispatchEvent(event);
  }

  state(entityId) {
    return this._hass?.states?.[entityId]?.state ?? "—";
  }

  attr(entityId, attrName) {
    return this._hass?.states?.[entityId]?.attributes?.[attrName];
  }

  friendly(entityId) {
    return this.attr(entityId, "friendly_name") || entityId;
  }

  callService(domain, service) {
    if (!this._hass) return;
    this._hass.callService(domain, service);
  }

  moreInfo(entityId) {
    this.fire("hass-more-info", { entityId });
  }

  openUrl(entityId) {
    const url = this.state(entityId);
    if (!url || url === "unknown" || url === "unavailable" || url === "—") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  actionButton(label, icon, service, extraClass = "") {
    return `
      <button class="wandr-button ${extraClass}" @service="${service}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span>${label}</span>
      </button>
    `;
  }

  entityTile(entityId, label, icon) {
    return `
      <button class="wandr-tile" @entity="${entityId}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="wandr-tile-label">${label}</span>
        <span class="wandr-tile-state">${this.state(entityId)}</span>
      </button>
    `;
  }

  entityRow(entityId, label, icon) {
    return `
      <button class="wandr-row" @entity="${entityId}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="wandr-row-label">${label}</span>
        <span class="wandr-row-state">${this.state(entityId)}</span>
      </button>
    `;
  }

  sectionSummary() {
    return `
      <section class="wandr-section wandr-section-summary">
        <div class="wandr-summary-main">
          <ha-icon icon="mdi:walk"></ha-icon>
          <div>
            <div class="wandr-kicker">Today's Route</div>
            <div class="wandr-route-name">${this.state("sensor.wandr_route_name")}</div>
            <div class="wandr-muted">
              ${this.state("sensor.wandr_distance")} • ${this.state("sensor.wandr_estimated_duration")} • ${this.state("sensor.wandr_elevation_gain")} gain
            </div>
          </div>
        </div>
      </section>
    `;
  }

  sectionStats() {
    return `
      <section class="wandr-section wandr-section-stats">
        <div class="wandr-grid wandr-grid-4">
          ${this.entityTile("sensor.wandr_distance", "Distance", "mdi:map-marker-distance")}
          ${this.entityTile("sensor.wandr_estimated_duration", "Duration", "mdi:clock-outline")}
          ${this.entityTile("sensor.wandr_elevation_gain", "Elevation", "mdi:elevation-rise")}
          ${this.entityTile("sensor.wandr_route_quality_score", "Quality", "mdi:star-outline")}
        </div>
      </section>
    `;
  }

  sectionRemote() {
    return `
      <section class="wandr-section wandr-section-remote">
        <div class="wandr-section-title">Route Remote</div>
        <div class="wandr-grid wandr-grid-3">
          ${this.actionButton("Prev", "mdi:chevron-left", "previous_route")}
          ${this.actionButton("Today", "mdi:calendar-star", "pick_daily_route", "wandr-primary")}
          ${this.actionButton("Next", "mdi:chevron-right", "next_route")}
          ${this.actionButton("Random", "mdi:dice-5", "random_route")}
          ${this.actionButton("Generate", "mdi:refresh", "generate_year")}
          ${this.actionButton("Done", "mdi:check-circle", "mark_completed", "wandr-primary")}
          ${this.actionButton("Skip", "mdi:skip-next-circle", "skip_today", "wandr-warning")}
          <button class="wandr-button" @url="sensor.wandr_google_maps_url" type="button">
            <ha-icon icon="mdi:google-maps"></ha-icon>
            <span>Maps</span>
          </button>
        </div>
      </section>
    `;
  }

  sectionMap() {
    return `
      <section class="wandr-section wandr-section-map">
        <div class="wandr-section-title">Map</div>
        <iframe class="wandr-frame" src="/local/wandr/current_route.html"></iframe>
      </section>
    `;
  }

  sectionDirections() {
    return `
      <section class="wandr-section wandr-section-directions">
        <div class="wandr-section-title">Directions</div>
        <iframe class="wandr-frame" src="/local/wandr/current_directions.html"></iframe>
      </section>
    `;
  }

  sectionProgress() {
    return `
      <section class="wandr-section wandr-section-progress">
        <div class="wandr-section-title">Progress</div>
        <div class="wandr-grid wandr-grid-4">
          ${this.entityTile("sensor.wandr_current_streak", "Streak", "mdi:fire")}
          ${this.entityTile("sensor.wandr_this_week_walks", "Week", "mdi:calendar-week")}
          ${this.entityTile("sensor.wandr_this_week_miles", "Week Miles", "mdi:map-marker-distance")}
          ${this.entityTile("sensor.wandr_this_month_miles", "Month Miles", "mdi:map")}
        </div>
      </section>
    `;
  }

  sectionSetup() {
    return `
      <section class="wandr-section wandr-section-setup">
        <div class="wandr-section-title">Route Setup</div>
        <div class="wandr-list">
          ${this.entityRow("text.wandr_start_address", "Start Address", "mdi:map-marker")}
          ${this.entityRow("switch.wandr_loop_route", "Loop Route", "mdi:map-marker-path")}
          ${this.entityRow("text.wandr_end_address", "End Address", "mdi:map-marker-check")}
          ${this.entityRow("number.wandr_target_miles", "Desired Miles", "mdi:map-marker-distance")}
          ${this.entityRow("number.wandr_pace", "Walking Pace", "mdi:speedometer")}
          ${this.entityRow("select.wandr_route_style", "Route Style", "mdi:routes")}
          ${this.entityRow("switch.wandr_allow_relaxed_fallback", "Relaxed Fallback", "mdi:shield-check-outline")}
        </div>
      </section>
    `;
  }

  sectionAToB() {
    return `
      <section class="wandr-section wandr-section-a-to-b">
        <div class="wandr-section-title">A-to-B Goal</div>
        <div class="wandr-list">
          ${this.entityRow("select.wandr_a_to_b_goal_mode", "Goal Mode", "mdi:target")}
          ${this.entityRow("number.wandr_a_to_b_extra_miles", "Extra Miles", "mdi:map-plus")}
          ${this.entityRow("number.wandr_a_to_b_extra_percent", "Extra Percent", "mdi:percent")}
          ${this.entityRow("number.wandr_a_to_b_extra_minutes", "Extra Minutes", "mdi:timer-plus")}
          ${this.entityRow("time.wandr_a_to_b_finish_by_time", "Finish By", "mdi:clock-end")}
          ${this.entityRow("sensor.wandr_a_to_b_goal_plan", "Current Goal", "mdi:clipboard-text-outline")}
        </div>
      </section>
    `;
  }

  sectionAvoid() {
    return `
      <section class="wandr-section wandr-section-avoid">
        <div class="wandr-section-title">Avoid Streets</div>
        <div class="wandr-list">
          ${this.entityRow("select.wandr_current_route_street", "Route Street", "mdi:road-variant")}
          ${this.entityRow("text.wandr_street_to_avoid", "Street To Avoid", "mdi:map-marker-remove")}
          ${this.entityRow("text.wandr_avoid_from_cross_street", "From Cross Street", "mdi:arrow-left-bottom")}
          ${this.entityRow("text.wandr_avoid_to_cross_street", "To Cross Street", "mdi:arrow-right-top")}
          ${this.entityRow("select.wandr_blocked_street_section", "Blocked Section", "mdi:block-helper")}
          ${this.entityRow("sensor.wandr_blocked_street_sections", "Block Count", "mdi:counter")}
        </div>
        <div class="wandr-grid wandr-grid-2 wandr-actions-row">
          ${this.actionButton("Block", "mdi:map-marker-remove", "add_blocked_section", "wandr-warning")}
          ${this.actionButton("Generate", "mdi:refresh", "generate_year")}
        </div>
      </section>
    `;
  }

  sectionExport() {
    return `
      <section class="wandr-section wandr-section-export">
        <div class="wandr-section-title">Export / Backup</div>
        <div class="wandr-grid wandr-grid-2">
          ${this.actionButton("Export", "mdi:file-export", "export_settings")}
          ${this.actionButton("Import", "mdi:file-import", "import_settings")}
        </div>
        <div class="wandr-list wandr-actions-row">
          ${this.entityRow("sensor.wandr_directions_url", "Directions URL", "mdi:directions")}
          ${this.entityRow("sensor.wandr_gpx_url", "GPX URL", "mdi:file-code-outline")}
          ${this.entityRow("sensor.wandr_geojson_url", "GeoJSON URL", "mdi:code-json")}
        </div>
      </section>
    `;
  }

  renderSection(section) {
    switch (section) {
      case "summary": return this.sectionSummary();
      case "stats": return this.sectionStats();
      case "remote": return this.sectionRemote();
      case "map": return this.sectionMap();
      case "directions": return this.sectionDirections();
      case "progress": return this.sectionProgress();
      case "setup": return this.sectionSetup();
      case "a_to_b": return this.sectionAToB();
      case "avoid": return this.sectionAvoid();
      case "export": return this.sectionExport();
      default: return `<section class="wandr-section"><div class="wandr-muted">Unknown section: ${section}</div></section>`;
    }
  }

  render() {
    if (!this.config) return;

    const columns = Number(this.config.columns || 2);
    const sectionHtml = this.config.sections.map((section) => this.renderSection(section)).join("");

    this.innerHTML = `
      <ha-card class="wandr-card">
        <style>
          .wandr-card {
            --wandr-accent: var(--wandr-accent-color, var(--primary-color));
            --wandr-radius: var(--ha-card-border-radius, 18px);
            --wandr-subtle-bg: color-mix(in srgb, var(--wandr-accent) 12%, transparent);
            --wandr-strong-bg: color-mix(in srgb, var(--wandr-accent) 22%, transparent);
            --wandr-border: var(--divider-color);
            overflow: hidden;
          }

          .wandr-inner {
            display: grid;
            grid-template-columns: repeat(${Math.max(1, Math.min(columns, 4))}, minmax(0, 1fr));
            gap: 12px;
            padding: 16px;
          }

          .wandr-header {
            padding: 16px 16px 0;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 20px;
            font-weight: 800;
          }

          .wandr-header ha-icon {
            color: var(--wandr-accent);
          }

          .wandr-section {
            border: 1px solid var(--wandr-border);
            border-radius: var(--wandr-radius);
            padding: 14px;
            background: var(--card-background-color);
            min-width: 0;
          }

          .wandr-section-summary,
          .wandr-section-map,
          .wandr-section-directions {
            grid-column: 1 / -1;
          }

          .wandr-section-title {
            font-weight: 800;
            margin-bottom: 10px;
          }

          .wandr-summary-main {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .wandr-summary-main ha-icon {
            color: var(--wandr-accent);
            width: 42px;
            height: 42px;
          }

          .wandr-kicker,
          .wandr-muted,
          .wandr-tile-label,
          .wandr-row-label {
            color: var(--secondary-text-color);
          }

          .wandr-route-name {
            font-size: 22px;
            font-weight: 900;
            line-height: 1.15;
            margin: 2px 0;
          }

          .wandr-grid {
            display: grid;
            gap: 10px;
          }

          .wandr-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .wandr-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .wandr-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

          .wandr-button,
          .wandr-tile,
          .wandr-row {
            border: 1px solid var(--divider-color);
            background: var(--card-background-color);
            color: var(--primary-text-color);
            border-radius: calc(var(--wandr-radius) - 4px);
            cursor: pointer;
            font: inherit;
          }

          .wandr-button {
            min-height: 72px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-weight: 750;
          }

          .wandr-button ha-icon,
          .wandr-tile ha-icon,
          .wandr-row ha-icon {
            color: var(--wandr-accent);
          }

          .wandr-primary {
            background: var(--wandr-strong-bg);
            border-color: color-mix(in srgb, var(--wandr-accent) 35%, var(--divider-color));
          }

          .wandr-warning ha-icon {
            color: var(--warning-color);
          }

          .wandr-tile {
            min-height: 78px;
            padding: 10px;
            display: grid;
            grid-template-areas: 'icon label' 'icon state';
            grid-template-columns: 28px 1fr;
            text-align: left;
            align-items: center;
            column-gap: 8px;
          }

          .wandr-tile ha-icon { grid-area: icon; }
          .wandr-tile-label { grid-area: label; font-size: 12px; }
          .wandr-tile-state { grid-area: state; font-weight: 850; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

          .wandr-list {
            display: grid;
            gap: 8px;
          }

          .wandr-row {
            display: grid;
            grid-template-columns: 28px 1fr auto;
            align-items: center;
            gap: 8px;
            min-height: 44px;
            padding: 8px 10px;
            text-align: left;
          }

          .wandr-row-state {
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-weight: 650;
          }

          .wandr-actions-row {
            margin-top: 10px;
          }

          .wandr-frame {
            width: 100%;
            height: var(--wandr-frame-height, 420px);
            border: 0;
            border-radius: calc(var(--wandr-radius) - 4px);
            background: var(--secondary-background-color);
          }

          @media (max-width: 700px) {
            .wandr-inner {
              grid-template-columns: 1fr;
            }
            .wandr-grid-3,
            .wandr-grid-4 {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .wandr-row-state {
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

    this.querySelectorAll("[\\@service]").forEach((button) => {
      button.addEventListener("click", () => this.callService("wandr", button.getAttribute("@service")));
    });

    this.querySelectorAll("[\\@entity]").forEach((button) => {
      button.addEventListener("click", () => this.moreInfo(button.getAttribute("@entity")));
    });

    this.querySelectorAll("[\\@url]").forEach((button) => {
      button.addEventListener("click", () => this.openUrl(button.getAttribute("@url")));
    });
  }
}

customElements.define("wandr-card", WandrCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "wandr-card",
  name: "wandr Card",
  description: "Configurable wandr dashboard card with route summary, controls, map, setup, and progress sections.",
});
