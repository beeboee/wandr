class WandrAvoidCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._sync();
  }

  getCardSize() { return 5; }

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
          border-radius:30px;
          background:var(--ha-card-background, var(--card-background-color));
          color:var(--primary-text-color);
          border:1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
          box-shadow:var(--ha-card-box-shadow, 0 12px 30px rgba(0,0,0,.18));
          padding:22px;
        }
        .head { display:flex; align-items:center; gap:14px; margin-bottom:16px; }
        .badge { width:48px; height:48px; border-radius:18px; display:grid; place-items:center; background:color-mix(in srgb, var(--warning-color, #f59e0b) 22%, transparent); color:var(--warning-color, #f59e0b); }
        .badge ha-icon { --mdc-icon-size:28px; }
        .title { font-size:24px; font-weight:850; letter-spacing:-.03em; }
        .sub { margin-top:3px; opacity:.68; font-size:13px; }
        .field { margin:10px 0; }
        label { display:block; font-size:12px; opacity:.65; margin:0 0 6px 4px; }
        input, select {
          width:100%; box-sizing:border-box; border:none; outline:none;
          border-radius:18px; min-height:48px; padding:0 14px;
          background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);
          color:var(--primary-text-color); font:inherit; font-weight:650;
          border:1px solid color-mix(in srgb, var(--primary-text-color) 9%, transparent);
        }
        .row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .actions { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:14px; }
        button { border:0; border-radius:18px; padding:14px 10px; min-height:50px; font:inherit; font-weight:800; color:var(--primary-text-color); background:color-mix(in srgb, var(--primary-text-color) 7%, transparent); cursor:pointer; }
        button.primary { background:color-mix(in srgb, var(--primary-color) 30%, transparent); }
        button.warn { background:color-mix(in srgb, var(--warning-color, #f59e0b) 24%, transparent); }
        button:active { transform:scale(.985); }
        .list { margin-top:16px; border-radius:22px; background:color-mix(in srgb, var(--primary-text-color) 4%, transparent); border:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); overflow:hidden; }
        .list-title { padding:13px 14px; font-size:12px; text-transform:uppercase; letter-spacing:.08em; opacity:.55; border-bottom:1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
        .item { padding:13px 14px; display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid color-mix(in srgb, var(--primary-text-color) 7%, transparent); }
        .item:last-child { border-bottom:0; }
        .item-main { font-weight:780; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .item-sub { font-size:12px; opacity:.62; margin-top:3px; }
        .empty { padding:18px 14px; opacity:.6; font-size:14px; }
        @media (max-width: 520px) { .row, .actions { grid-template-columns:1fr; } }
      </style>
      <div class="card">
        <div class="head">
          <div class="badge"><ha-icon icon="mdi:map-marker-remove"></ha-icon></div>
          <div><div class="title">Avoid list</div><div class="sub">Block streets or specific sections from future generated routes.</div></div>
        </div>

        <div class="field">
          <label>Pick from current route</label>
          <select id="streetSelect"></select>
        </div>
        <div class="field">
          <label>Street or path to avoid</label>
          <input id="streetInput" placeholder="Street, path, trail, alley" />
        </div>
        <div class="row">
          <div class="field"><label>From cross street</label><input id="fromInput" placeholder="Optional" /></div>
          <div class="field"><label>To cross street</label><input id="toInput" placeholder="Optional" /></div>
        </div>

        <div class="field">
          <label>Existing blocked item</label>
          <select id="blockedSelect"></select>
        </div>

        <div class="actions">
          <button class="primary" id="addBtn">Add</button>
          <button class="warn" id="removeBtn">Remove</button>
          <button id="regenBtn">Regenerate</button>
        </div>

        <div class="list"><div class="list-title">Current blocks</div><div id="listItems"></div></div>
      </div>
    `;
    this.shadowRoot.getElementById('streetSelect').addEventListener('change', (ev) => this._pickStreet(ev.target.value));
    this.shadowRoot.getElementById('blockedSelect').addEventListener('change', (ev) => this._selectBlocked(ev.target.value));
    this.shadowRoot.getElementById('streetInput').addEventListener('change', (ev) => this._setText('text.wandr_street_to_avoid', ev.target.value));
    this.shadowRoot.getElementById('fromInput').addEventListener('change', (ev) => this._setText('text.wandr_avoid_from_cross_street', ev.target.value));
    this.shadowRoot.getElementById('toInput').addEventListener('change', (ev) => this._setText('text.wandr_avoid_to_cross_street', ev.target.value));
    this.shadowRoot.getElementById('addBtn').addEventListener('click', () => this._press('button.wandr_avoid_selected_street_section'));
    this.shadowRoot.getElementById('removeBtn').addEventListener('click', () => this._press('button.wandr_remove_blocked_street_section'));
    this.shadowRoot.getElementById('regenBtn').addEventListener('click', () => this._press('button.wandr_generate_routes'));
  }

  _optionsFrom(entityId) {
    return this._state(entityId)?.attributes?.options || [];
  }

  _sync() {
    if (!this.shadowRoot || !this._hass) return;
    const streetOptions = this._optionsFrom('select.wandr_current_route_street');
    const blockedOptions = this._optionsFrom('select.wandr_blocked_street_section');
    this._fillSelect('streetSelect', streetOptions, this._value('select.wandr_current_route_street'));
    this._fillSelect('blockedSelect', blockedOptions, this._value('select.wandr_blocked_street_section'));
    this.shadowRoot.getElementById('streetInput').value = this._value('text.wandr_street_to_avoid');
    this.shadowRoot.getElementById('fromInput').value = this._value('text.wandr_avoid_from_cross_street');
    this.shadowRoot.getElementById('toInput').value = this._value('text.wandr_avoid_to_cross_street');
    this._renderList();
  }

  _fillSelect(id, options, selected) {
    const select = this.shadowRoot.getElementById(id);
    const current = select.value;
    const next = options.map((option) => `<option value="${this._esc(option)}" ${option === selected ? 'selected' : ''}>${this._esc(option)}</option>`).join('');
    if (select.innerHTML !== next) select.innerHTML = next;
    if (selected && select.value !== selected) select.value = selected;
    if (!selected && current && options.includes(current)) select.value = current;
  }

  _renderList() {
    const attr = this._state('sensor.wandr_avoid_list')?.attributes?.blocked_sections || this._state('sensor.wandr_blocked_street_sections')?.attributes?.blocked_sections || [];
    const list = this.shadowRoot.getElementById('listItems');
    if (!attr.length) {
      list.innerHTML = `<div class="empty">No blocked streets yet.</div>`;
      return;
    }
    list.innerHTML = attr.map((item) => {
      const street = item.street || 'Unnamed';
      const from = item.from || '';
      const to = item.to || '';
      const sub = from || to ? `${from || '?'} to ${to || '?'}` : 'Whole named street/path';
      return `<div class="item"><div><div class="item-main">${this._esc(street)}</div><div class="item-sub">${this._esc(sub)}</div></div></div>`;
    }).join('');
  }

  _esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  _setText(entity_id, value) {
    return this._hass?.callService('text', 'set_value', { entity_id, value });
  }

  _press(entity_id) {
    return this._hass?.callService('button', 'press', { entity_id });
  }

  _pickStreet(option) {
    if (!option || option === 'No streets available') return;
    this._hass?.callService('select', 'select_option', { entity_id:'select.wandr_current_route_street', option });
    this._setText('text.wandr_street_to_avoid', option);
  }

  _selectBlocked(option) {
    if (!option || option === 'No blocked sections') return;
    this._hass?.callService('select', 'select_option', { entity_id:'select.wandr_blocked_street_section', option });
  }
}

customElements.define('wandr-avoid-card', WandrAvoidCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'wandr-avoid-card', name: 'wandr Avoid Card', description: 'Manage wandr avoid-list streets and street sections.' });
