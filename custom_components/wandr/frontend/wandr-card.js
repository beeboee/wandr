class WandrCard extends HTMLElement {
  static getStubConfig() {
    return { layout: "daily" };
  }

  setConfig(config = {}) {
    this.config = this._normalizeConfig(config);
    this._rendered = false;
    this._renderStatic();
    this._updateDynamicValues();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._renderStatic();
    this._updateDynamicValues();
  }

  getCardSize() {
    const sizes = { daily: 8, planner: 6, avoid: 5, stats: 3, custom: 6 };
    return sizes[this.config?.layout] || 6;
  }

  _normalizeConfig(config) {
    const layout = config.layout || "daily";
    const layouts = {
      daily: ["hero_stats", "map", "daily_controls", "progress_compact"],
      planner: ["planner", "a_to_b", "generation_controls"],
      avoid: ["avoid"],
      stats: ["progress"],
      custom: config.sections || ["hero_stats", "map", "daily_controls"],
    };

    const normalized = {
      layout,
      sections: layouts[layout] || layouts.daily,
      columns: layout === "stats" ? 1 : 1,
      show_header: false,
      map_height: layout === "daily" ? "390px" : "320px",
      ...config,
    };

    if (layout !== "custom") {
      normalized.sections = layouts[layout] || layouts.daily;
    } else if (!Array.isArray(normalized.sections)) {
      normalized.sections = [normalized.sections];
    }

    return normalized;
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

  _climbFlights() {
    const feet = this._number("sensor.wandr_elevation_gain");
    if (!feet) return "—";
    return Math.max(1, Math.round(feet / 10));
  }

  _button(label, icon, service, extraClass = "") {
    return `
      <button class="wandr-button ${extraClass}" data-service="${service}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span>${label}</span>
      </button>
    `;
  }

  _urlButton(label, icon, entityId, fallbackUrl = "", extraClass = "") {
    return `
      <button class="wandr-button ${extraClass}" data-url="${entityId}" data-fallback-url="${fallbackUrl}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span>${label}</span>
      </button>
    `;
  }

  _metric(entityId, label, icon, suffix = "") {
    return `
      <button class="wandr-metric" data-entity="${entityId}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <strong><span data-state="${entityId}">—</span>${suffix}</strong>
        <span>${label}</span>
      </button>
    `;
  }

  _row(entityId, label, icon, helper = "") {
    return `
      <button class="wandr-row" data-entity="${entityId}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span>
          <span class="wandr-label">${label}</span>
          ${helper ? `<small>${helper}</small>` : ""}
        </span>
        <span class="wandr-value" data-state="${entityId}">—</span>
      </button>
    `;
  }

  _field(entityId, label, icon, helper = "") {
    return `
      <button class="wandr-field" data-entity="${entityId}" type="button">
        <ha-icon icon="${icon}"></ha-icon>
        <span>
          <span class="wandr-label">${label}</span>
          <span class="wandr-value" data-state="${entityId}">—</span>
          ${helper ? `<small>${helper}</small>` : ""}
        </span>
      </button>
    `;
  }

  _sectionHeroStats() {
    return `
      <section class="wandr-section wandr-hero-stats">
        <button class="wandr-hero-stat" data-entity="sensor.wandr_distance" type="button">
          <ha-icon icon="mdi:map-marker-distance"></ha-icon>
          <strong><span data-state="sensor.wandr_distance">—</span></strong>
          <span>mi</span>
          <small>Distance</small>
        </button>
        <button class="wandr-hero-stat" data-entity="sensor.wandr_estimated_duration" type="button">
          <ha-icon icon="mdi:clock-outline"></ha-icon>
          <strong><span data-state="sensor.wandr_estimated_duration">—</span></strong>
          <span>min</span>
          <small>Duration</small>
        </button>
        <button class="wandr-hero-stat" data-entity="sensor.wandr_elevation_gain" type="button">
          <ha-icon icon="mdi:stairs-up"></ha-icon>
          <strong data-climb-flights>—</strong>
          <span>flights ↑</span>
          <small>Climb</small>
        </button>
      </section>
    `;
  }

  _sectionSummary() {
    return `
      <section class="wandr-section wandr-summary">
        <div class="wandr-summary-icon"><ha-icon icon="mdi:walk"></ha-icon></div>
        <div>
          <div class="wandr-route-name" data-state="sensor.wandr_route_name">—</div>
          <div class="wandr-muted" data-summary="route">—</div>
        </div>
      </section>
    `;
  }

  _sectionMap() {
    return `
      <section class="wandr-map-section">
        <iframe class="wandr-frame" src="/local/wandr/current_route.html"></iframe>
      </section>
    `;
  }

  _sectionDailyControls() {
    return `
      <section class="wandr-section wandr-daily-actions">
        ${this._field("text.wandr_end_address", "Address for A-to-B", "mdi:map-marker-plus", "Tap to edit destination")}
        <div class="wandr-grid wandr-grid-3">
          ${this._button("Prev", "mdi:chevron-left", "previous_route")}
          ${this._button("Random", "mdi:shuffle-variant", "random_route", "wandr-primary")}
          ${this._button("Next", "mdi:chevron-right", "next_route")}
        </div>
        <div class="wandr-grid wandr-grid-4 wandr-secondary-actions">
          ${this._button("Today", "mdi:calendar-star", "pick_daily_route")}
          ${this._urlButton("Maps", "mdi:google-maps", "sensor.wandr_google_maps_url", "/local/wandr/current_route.html")}
          ${this._button("Done", "mdi:check-circle", "mark_completed")}
          ${this._button("Skip", "mdi:skip-next-circle", "skip_today", "wandr-warning")}
        </div>
      </section>
    `;
  }

  _sectionPlanner() {
    return `
      <section class="wandr-section">
        <div class="wandr-list">
          ${this._field("text.wandr_start_address", "Start address", "mdi:map-marker", "For loop routes and fallback starting point")}
          ${this._row("select.wandr_generation_type", "Route type", "mdi:map-marker-path")}
          ${this._field("text.wandr_end_address", "A-to-B destination", "mdi:map-marker-check", "Used when route type is A-to-B")}
          ${this._row("number.wandr_target_miles", "Desired miles", "mdi:map-marker-distance")}
          ${this._row("number.wandr_pace", "Walking pace", "mdi:speedometer")}
          ${this._row("select.wandr_route_style", "Route style", "mdi:routes")}
          ${this._row("select.wandr_map_app", "Map app", "mdi:map")}
          ${this._row("switch.wandr_allow_relaxed_fallback", "Relaxed fallback", "mdi:shield-check-outline")}
        </div>
      </section>
    `;
  }

  _sectionAToB() {
    return `
      <section class="wandr-section">
        <div class="wandr-list">
          ${this._row("select.wandr_a_to_b_goal_mode", "A-to-B goal", "mdi:target")}
          ${this._row("number.wandr_a_to_b_extra_miles", "Extra miles", "mdi:map-plus")}
          ${this._row("number.wandr_a_to_b_extra_percent", "Extra percent", "mdi:percent")}
          ${this._row("number.wandr_a_to_b_extra_minutes", "Extra minutes", "mdi:timer-plus")}
          ${this._row("time.wandr_a_to_b_finish_by_time", "Finish by", "mdi:clock-end")}
          ${this._row("sensor.wandr_a_to_b_goal_plan", "Current plan", "mdi:clipboard-text-outline")}
        </div>
      </section>
    `;
  }

  _sectionGenerationControls() {
    return `
      <section class="wandr-section">
        <div class="wandr-grid wandr-grid-3">
          ${this._button("Generate", "mdi:refresh", "generate_year", "wandr-primary")}
          ${this._button("Random", "mdi:shuffle-variant", "random_route")}
          ${this._button("Today", "mdi:calendar-star", "pick_daily_route")}
        </div>
      </section>
    `;
  }

  _sectionAvoid() {
    return `
      <section class="wandr-section wandr-avoid-card">
        <div class="wandr-card-title">Avoid segments</div>
        <p class="wandr-muted wandr-help">Pick a recognized street from the current route, or type one manually. From/To are optional cross streets for blocking only part of it.</p>
        <div class="wandr-list">
          ${this._row("select.wandr_current_route_street", "Recognized route street", "mdi:road-variant", "Recommended from current route")}
          ${this._field("text.wandr_street_to_avoid", "Street to avoid", "mdi:map-marker-remove", "Auto-filled when you choose a recognized street")}
          <div class="wandr-grid wandr-grid-2">
            ${this._field("text.wandr_avoid_from_cross_street", "From cross street", "mdi:arrow-left-bottom")}
            ${this._field("text.wandr_avoid_to_cross_street", "To cross street", "mdi:arrow-right-top")}
          </div>
          ${this._row("select.wandr_blocked_street_section", "Blocked list", "mdi:format-list-bulleted", "Tap to select an existing block")}
          ${this._row("sensor.wandr_blocked_street_sections", "Blocked count", "mdi:counter")}
        </div>
        <div class="wandr-grid wandr-grid-3 wandr-actions-row">
          ${this._button("Add", "mdi:plus", "add_blocked_section", "wandr-primary")}
          ${this._button("Remove", "mdi:delete", "remove_selected_blocked_section", "wandr-warning")}
          ${this._button("Regenerate", "mdi:refresh", "generate_year")}
        </div>
      </section>
    `;
  }

  _sectionProgressCompact() {
    return `
      <section class="wandr-section wandr-progress-compact">
        ${this._metric("sensor.wandr_this_month_miles", "This Month", "mdi:shoe-print", " mi")}
        ${this._metric("sensor.wandr_current_streak", "Day Streak", "mdi:fire")}
        ${this._metric("sensor.wandr_this_week_walks", "Walks This Week", "mdi:calendar-week")}
      </section>
    `;
  }

  _sectionProgress() {
    return `
      <section class="wandr-section">
        <div class="wandr-grid wandr-grid-4">
          ${this._metric("sensor.wandr_this_month_miles", "This Month", "mdi:shoe-print", " mi")}
          ${this._metric("sensor.wandr_current_streak", "Day Streak", "mdi:fire")}
          ${this._metric("sensor.wandr_this_week_walks", "Walks This Week", "mdi:calendar-week")}
          ${this._metric("sensor.wandr_this_week_miles", "Week Miles", "mdi:map-marker-distance", " mi")}
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
      case "hero_stats": return this._sectionHeroStats();
      case "summary": return this._sectionSummary();
      case "map": return this._sectionMap();
      case "daily_controls": return this._sectionDailyControls();
      case "planner": return this._sectionPlanner();
      case "a_to_b": return this._sectionAToB();
      case "generation_controls": return this._sectionGenerationControls();
      case "avoid": return this._sectionAvoid();
      case "progress_compact": return this._sectionProgressCompact();
      case "progress": return this._sectionProgress();
      case "export": return this._sectionExport();
      case "stats": return this._sectionHeroStats();
      case "remote": return this._sectionDailyControls();
      case "setup": return this._sectionPlanner();
      default: return `<section class="wandr-section"><div class="wandr-muted">Unknown section: ${section}</div></section>`;
    }
  }

  _renderStatic() {
    if (!this.config) return;
    const columns = Number(this.config.columns || 1);
    const safeColumns = Math.max(1, Math.min(columns, 3));
    const sectionHtml = this.config.sections.map((section) => this._renderSection(section)).join("");

    this.innerHTML = `
      <ha-card class="wandr-card wandr-layout-${this.config.layout}">
        <style>
          .wandr-card {
            --wandr-accent: var(--wandr-accent-color, var(--primary-color));
            --wandr-radius: var(--ha-card-border-radius, 20px);
            --wandr-border: var(--divider-color);
            overflow: hidden;
          }

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
            background: color-mix(in srgb, var(--card-background-color) 94%, transparent);
            min-width: 0;
          }

          .wandr-map-section {
            border-radius: var(--wandr-radius);
            overflow: hidden;
            border: 1px solid var(--wandr-border);
            background: var(--secondary-background-color);
          }

          .wandr-frame {
            width: 100%;
            height: var(--wandr-frame-height, ${this.config.map_height});
            border: 0;
            display: block;
            background: var(--secondary-background-color);
          }

          .wandr-hero-stats {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            border: 0;
            background: transparent;
            padding: 4px 0 0;
          }

          .wandr-hero-stat {
            border: 0;
            background: transparent;
            color: var(--primary-text-color);
            display: grid;
            justify-items: center;
            gap: 3px;
            font: inherit;
            cursor: pointer;
            border-right: 1px solid var(--divider-color);
          }

          .wandr-hero-stat:last-child { border-right: 0; }
          .wandr-hero-stat ha-icon { color: var(--wandr-accent); }
          .wandr-hero-stat strong { font-size: 30px; line-height: 1; font-weight: 900; }
          .wandr-hero-stat span { font-size: 14px; color: var(--primary-text-color); }
          .wandr-hero-stat small { color: var(--secondary-text-color); font-size: 12px; }

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

          .wandr-summary-icon ha-icon,
          .wandr-button ha-icon,
          .wandr-row ha-icon,
          .wandr-field ha-icon,
          .wandr-metric ha-icon { color: var(--wandr-accent); }

          .wandr-route-name {
            font-size: 22px;
            font-weight: 900;
            line-height: 1.1;
            margin: 0 0 4px;
          }

          .wandr-muted,
          .wandr-label,
          .wandr-row small,
          .wandr-field small { color: var(--secondary-text-color); }

          .wandr-help { margin: 0 0 12px; line-height: 1.35; }
          .wandr-card-title { font-weight: 850; font-size: 18px; margin-bottom: 4px; }
          .wandr-grid { display: grid; gap: 10px; }
          .wandr-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .wandr-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .wandr-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .wandr-list { display: grid; gap: 8px; }
          .wandr-actions-row { margin-top: 10px; }

          .wandr-button,
          .wandr-row,
          .wandr-field,
          .wandr-metric {
            border: 1px solid var(--divider-color);
            background: var(--card-background-color);
            color: var(--primary-text-color);
            border-radius: calc(var(--wandr-radius) - 6px);
            cursor: pointer;
            font: inherit;
            min-width: 0;
          }

          .wandr-button {
            min-height: 58px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            font-weight: 750;
          }

          .wandr-primary {
            background: color-mix(in srgb, var(--wandr-accent) 18%, transparent);
            border-color: color-mix(in srgb, var(--wandr-accent) 42%, var(--divider-color));
          }

          .wandr-warning ha-icon { color: var(--warning-color); }

          .wandr-row,
          .wandr-field {
            min-height: 48px;
            padding: 9px 11px;
            display: grid;
            grid-template-columns: 28px minmax(0, 1fr) auto;
            align-items: center;
            gap: 9px;
            text-align: left;
          }

          .wandr-field {
            grid-template-columns: 28px minmax(0, 1fr);
          }

          .wandr-row span,
          .wandr-field span { min-width: 0; }
          .wandr-label { display: block; font-size: 12px; }
          .wandr-value { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 750; }
          .wandr-row small,
          .wandr-field small { display: block; font-size: 11px; margin-top: 2px; }

          .wandr-progress-compact {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }

          .wandr-metric {
            min-height: 94px;
            padding: 10px;
            display: grid;
            justify-items: center;
            align-content: center;
            gap: 5px;
            text-align: center;
          }

          .wandr-metric ha-icon {
            width: 30px;
            height: 30px;
            padding: 9px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--wandr-accent) 18%, transparent);
          }

          .wandr-metric strong { font-size: 24px; font-weight: 900; }
          .wandr-metric span:last-child { color: var(--secondary-text-color); font-size: 12px; }
          .wandr-secondary-actions { margin-top: 10px; }

          @media (max-width: 900px) {
            .wandr-inner { grid-template-columns: 1fr; }
          }

          @media (max-width: 600px) {
            .wandr-inner { padding: 12px; }
            .wandr-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .wandr-secondary-actions { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            .wandr-secondary-actions .wandr-button { min-height: 52px; font-size: 12px; }
            .wandr-frame { height: var(--wandr-frame-height, 340px); }
            .wandr-hero-stat strong { font-size: 26px; }
            .wandr-progress-compact { grid-template-columns: 1fr 1fr 1fr; }
            .wandr-metric { min-height: 82px; }
            .wandr-grid-2 { grid-template-columns: 1fr; }
          }
        </style>
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

    const climb = this.querySelector("[data-climb-flights]");
    if (climb) climb.textContent = this._climbFlights();
  }
}

class WandrDailyCard extends WandrCard {
  static getStubConfig() { return { layout: "daily" }; }
  setConfig(config = {}) { super.setConfig({ ...config, layout: "daily" }); }
}

class WandrPlannerCard extends WandrCard {
  static getStubConfig() { return { layout: "planner" }; }
  setConfig(config = {}) { super.setConfig({ ...config, layout: "planner" }); }
}

class WandrAvoidCard extends WandrCard {
  static getStubConfig() { return { layout: "avoid" }; }
  setConfig(config = {}) { super.setConfig({ ...config, layout: "avoid" }); }
}

class WandrStatsCard extends WandrCard {
  static getStubConfig() { return { layout: "stats" }; }
  setConfig(config = {}) { super.setConfig({ ...config, layout: "stats" }); }
}

customElements.define("wandr-card", WandrCard);
customElements.define("wandr-daily-card", WandrDailyCard);
customElements.define("wandr-planner-card", WandrPlannerCard);
customElements.define("wandr-avoid-card", WandrAvoidCard);
customElements.define("wandr-stats-card", WandrStatsCard);

window.customCards = window.customCards || [];
window.customCards.push(
  {
    type: "wandr-daily-card",
    name: "wandr Daily Walk",
    description: "App-style daily route card with hero stats, map, route controls, and compact progress.",
  },
  {
    type: "wandr-planner-card",
    name: "wandr Route Planner",
    description: "Route setup card for loop routes, A-to-B destinations, style, pace, and generation controls.",
  },
  {
    type: "wandr-avoid-card",
    name: "wandr Avoid Segments",
    description: "Street recognition, manual avoid input, blocked section list, add/remove actions, and regeneration.",
  },
  {
    type: "wandr-stats-card",
    name: "wandr Stats",
    description: "Progress card for monthly miles, streak, weekly walks, and weekly distance.",
  },
  {
    type: "wandr-card",
    name: "wandr Custom Layout",
    description: "Advanced configurable wandr card using layout: custom and sections.",
  },
);
