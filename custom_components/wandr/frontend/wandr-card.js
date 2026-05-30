class WandrCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = { view: 'route' };
    this._hass = null;
    this._lastKey = '';
    this._map = null;
    this._line = null;
    this._start = null;
    this._end = null;
    this._leafletPromise = null;
  }

  static getConfigElement() { return document.createElement('wandr-card-editor'); }
  static getStubConfig() { return { view: 'route' }; }
  getCardSize() { return this._config.view === 'route' ? 7 : 4; }

  setConfig(config) {
    this._config = {
      view: 'route',
      route_entity: 'sensor.wandr_route_name',
      json_url: '/local/wandr/current_route.json',
      ...config,
    };
    this._lastKey = '';
    this._map = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _state(id) { return this._hass?.states?.[id]; }
  _value(id, fallback = '') {
    const s = this._state(id);
    return (!s || s.state === 'unknown' || s.state === 'unavailable') ? fallback : s.state;
  }

  _styles() {
    return `:host{display:block}.card{border-radius:28px;background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color);border:1px solid color-mix(in srgb,var(--primary-text-color) 9%,transparent);box-shadow:var(--ha-card-box-shadow,0 12px 30px rgba(0,0,0,.18));overflow:hidden}.pad{padding:22px}.head{display:flex;gap:14px;align-items:center;margin-bottom:16px}.badge{width:52px;height:52px;border-radius:19px;display:grid;place-items:center;background:color-mix(in srgb,var(--primary-color) 22%,transparent);color:var(--primary-color)}.badge.warn{background:color-mix(in srgb,var(--warning-color,#f59e0b) 22%,transparent);color:var(--warning-color,#f59e0b)}.badge ha-icon{--mdc-icon-size:29px}.title{font-size:25px;font-weight:850;letter-spacing:-.03em}.sub{margin-top:4px;opacity:.68;font-size:13px;line-height:1.3}.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.pill{border-radius:21px;padding:15px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent);min-width:0}.label{font-size:12px;opacity:.62;margin-bottom:7px}.value{font-size:20px;font-weight:800;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}button{border:0;border-radius:18px;padding:14px 10px;min-height:50px;font:inherit;font-weight:800;color:var(--primary-text-color);background:color-mix(in srgb,var(--primary-text-color) 7%,transparent);cursor:pointer}button.primary{background:color-mix(in srgb,var(--primary-color) 30%,transparent)}button.warn{background:color-mix(in srgb,var(--warning-color,#f59e0b) 24%,transparent)}button:active{transform:scale(.985)}input,select{width:100%;box-sizing:border-box;border:0;outline:0;border-radius:18px;min-height:48px;padding:0 14px;background:color-mix(in srgb,var(--primary-text-color) 6%,transparent);color:var(--primary-text-color);font:inherit;font-weight:650;border:1px solid color-mix(in srgb,var(--primary-text-color) 9%,transparent)}label{display:block;font-size:12px;opacity:.65;margin:10px 0 6px 4px}.mt{margin-top:14px}.small{font-size:12px;opacity:.62;line-height:1.35}.list{margin-top:16px;border-radius:22px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent);overflow:hidden}.item{padding:13px 14px;border-bottom:1px solid color-mix(in srgb,var(--primary-text-color) 7%,transparent)}.item:last-child{border-bottom:0}.item-main{font-weight:780;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.item-sub{font-size:12px;opacity:.62;margin-top:3px}#map{height:300px;border-radius:24px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);border:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent)}@media(max-width:560px){.grid2,.grid3{grid-template-columns:1fr}#map{height:260px}}`;
  }

  _render() {
    const view = this._config.view || 'route';
    if (view === 'avoid') return this._renderAvoid();
    if (view === 'generate') return this._renderGenerate();
    if (view === 'navigate') return this._renderNavigate();
    if (view === 'progress') return this._renderProgress();
    if (view === 'files') return this._renderFiles();
    return this._renderRoute();
  }

  _renderRoute() {
    this.shadowRoot.innerHTML = `<style>${this._styles()}</style><div class="card"><div class="pad"><div class="head"><div class="badge"><ha-icon icon="mdi:walk"></ha-icon></div><div style="min-width:0"><div class="title" id="name">wandr</div><div class="sub" id="meta">Loading route…</div></div></div><div class="grid2"><div class="pill"><div class="label">Distance</div><div class="value" id="distance">—</div></div><div class="pill"><div class="label">Duration</div><div class="value" id="duration">—</div></div><div class="pill"><div class="label">Elevation</div><div class="value" id="elevation">—</div></div><div class="pill"><div class="label">Quality</div><div class="value" id="quality">—</div></div></div><div class="mt"><div id="map"></div></div><div class="grid3 mt"><button data-action="previous">Prev</button><button data-action="random">Random</button><button data-action="next">Next</button><button data-action="today" class="primary">Today</button><button data-action="open">Maps</button><button data-action="done" class="primary">Done</button></div><div class="small mt" id="foot">Synced from current_route.json.</div></div></div>`;
    this.shadowRoot.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => this._action(b.dataset.action)));
  }

  _renderAvoid() {
    this.shadowRoot.innerHTML = `<style>${this._styles()}</style><div class="card"><div class="pad"><div class="head"><div class="badge warn"><ha-icon icon="mdi:map-marker-remove"></ha-icon></div><div><div class="title">Avoid list</div><div class="sub">Add blocked streets or specific street sections.</div></div></div><label>Pick from current route</label><select id="streetSelect"></select><label>Street or path to avoid</label><input id="streetInput" placeholder="Street, path, trail, alley"><div class="grid2"><div><label>From cross street</label><input id="fromInput" placeholder="Optional"></div><div><label>To cross street</label><input id="toInput" placeholder="Optional"></div></div><label>Existing block</label><select id="blockedSelect"></select><div class="grid3 mt"><button class="primary" id="addBtn">Add</button><button class="warn" id="removeBtn">Remove</button><button id="regenBtn">Regenerate</button></div><div class="list" id="listItems"></div></div></div>`;
    this.shadowRoot.getElementById('streetSelect').addEventListener('change', e => this._pickStreet(e.target.value));
    this.shadowRoot.getElementById('blockedSelect').addEventListener('change', e => this._selectBlocked(e.target.value));
    this.shadowRoot.getElementById('streetInput').addEventListener('change', e => this._setText('text.wandr_street_to_avoid', e.target.value));
    this.shadowRoot.getElementById('fromInput').addEventListener('change', e => this._setText('text.wandr_avoid_from_cross_street', e.target.value));
    this.shadowRoot.getElementById('toInput').addEventListener('change', e => this._setText('text.wandr_avoid_to_cross_street', e.target.value));
    this.shadowRoot.getElementById('addBtn').addEventListener('click', () => this._press('button.wandr_avoid_selected_street_section'));
    this.shadowRoot.getElementById('removeBtn').addEventListener('click', () => this._press('button.wandr_remove_blocked_street_section'));
    this.shadowRoot.getElementById('regenBtn').addEventListener('click', () => this._press('button.wandr_generate_routes'));
  }

  _renderGenerate(){this.shadowRoot.innerHTML=`<style>${this._styles()}</style><div class="card"><div class="pad"><div class="head"><div class="badge"><ha-icon icon="mdi:tune"></ha-icon></div><div><div class="title">Generate</div><div class="sub">Changing route count or major route settings requires Generate Routes.</div></div></div><div class="grid2"><div class="pill"><div class="label">Requested base routes</div><div class="value" id="configured">—</div></div><div class="pill"><div class="label">Generated routes</div><div class="value" id="generated">—</div></div></div><div class="grid2 mt"><button class="primary" data-action="generate">Generate Routes</button><button data-action="library">Route Library</button></div><div class="small mt" id="summary">—</div></div></div>`;this.shadowRoot.querySelector('[data-action="generate"]').addEventListener('click',()=>this._press('button.wandr_generate_routes'));this.shadowRoot.querySelector('[data-action="library"]').addEventListener('click',()=>{window.location.href='/local/wandr/routes/index.json';});}
  _renderProgress(){this.shadowRoot.innerHTML=`<style>${this._styles()}</style><div class="card"><div class="pad"><div class="head"><div class="badge"><ha-icon icon="mdi:chart-line"></ha-icon></div><div><div class="title">Progress</div><div class="sub">Walking streak and distance totals.</div></div></div><div class="grid3"><div class="pill"><div class="label">Streak</div><div class="value" id="streak">—</div></div><div class="pill"><div class="label">This week</div><div class="value" id="week">—</div></div><div class="pill"><div class="label">This month</div><div class="value" id="month">—</div></div></div></div></div>`;}
  _renderNavigate(){this.shadowRoot.innerHTML=`<style>${this._styles()}</style><div class="card"><div class="pad"><div class="head"><div class="badge"><ha-icon icon="mdi:map"></ha-icon></div><div><div class="title">Navigate</div><div class="sub">Open the current route in the selected app.</div></div></div><div class="grid2"><div class="pill"><div class="label">Map app</div><div class="value" id="mapApp">—</div></div><button class="primary" data-action="open">Open Route</button></div></div></div>`;this.shadowRoot.querySelector('[data-action="open"]').addEventListener('click',()=>this._action('open'));}
  _renderFiles(){this.shadowRoot.innerHTML=`<style>${this._styles()}</style><div class="card"><div class="pad"><div class="head"><div class="badge"><ha-icon icon="mdi:file-export"></ha-icon></div><div><div class="title">Files</div><div class="sub">Current exports and pre-generated route library.</div></div></div><div class="grid2"><button data-open="/local/wandr/current_route.gpx">GPX</button><button data-open="/local/wandr/current_route.geojson">GeoJSON</button><button data-open="/local/wandr/current_directions.html">Directions</button><button class="primary" data-open="/local/wandr/routes/index.json">Route Library</button></div></div></div>`;this.shadowRoot.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{window.location.href=b.dataset.open;}));}

  async _update(){if(!this._hass||!this.shadowRoot)return;const v=this._config.view||'route';if(v==='route')return this._updateRoute();if(v==='avoid')return this._updateAvoid();if(v==='generate')return this._updateGenerate();if(v==='progress')return this._updateProgress();if(v==='navigate')return this._updateNavigate();}
  async _updateRoute(){const key=JSON.stringify([this._value('sensor.wandr_route_name'),this._value('sensor.wandr_distance'),this._value('sensor.wandr_estimated_duration'),this._value('sensor.wandr_elevation_gain'),this._value('sensor.wandr_route_quality_score')]);if(key===this._lastKey)return;this._lastKey=key;const name=this._value('sensor.wandr_route_name','No route'),d=this._value('sensor.wandr_distance','—'),m=this._value('sensor.wandr_estimated_duration','—'),e=this._value('sensor.wandr_elevation_gain','—'),q=this._value('sensor.wandr_route_quality_score','—'),mode=this._value('sensor.wandr_mode','');this.shadowRoot.getElementById('name').textContent=name;this.shadowRoot.getElementById('meta').textContent=`${d} mi · ${m} min${mode?' · '+mode:''}`;this.shadowRoot.getElementById('distance').textContent=`${d} mi`;this.shadowRoot.getElementById('duration').textContent=`${m} min`;this.shadowRoot.getElementById('elevation').textContent=e==='—'?'—':`${e} ft`;this.shadowRoot.getElementById('quality').textContent=q;try{await this._draw(await this._routeJson());}catch(err){this.shadowRoot.getElementById('foot').textContent=`Map refresh failed: ${err.message}`;}}
  _updateAvoid(){this._fillSelect('streetSelect',this._optionsFrom('select.wandr_current_route_street'),this._value('select.wandr_current_route_street'));this._fillSelect('blockedSelect',this._optionsFrom('select.wandr_blocked_street_section'),this._value('select.wandr_blocked_street_section'));this.shadowRoot.getElementById('streetInput').value=this._value('text.wandr_street_to_avoid');this.shadowRoot.getElementById('fromInput').value=this._value('text.wandr_avoid_from_cross_street');this.shadowRoot.getElementById('toInput').value=this._value('text.wandr_avoid_to_cross_street');const list=this.shadowRoot.getElementById('listItems');const items=this._state('sensor.wandr_avoid_list')?.attributes?.blocked_sections||this._state('sensor.wandr_blocked_street_sections')?.attributes?.blocked_sections||[];list.innerHTML=items.length?items.map(i=>`<div class="item"><div class="item-main">${this._esc(i.street||'Unnamed')}</div><div class="item-sub">${this._esc((i.from||i.to)?`${i.from||'?'} to ${i.to||'?'}`:'Whole named street/path')}</div></div>`).join(''):`<div class="item"><div class="item-sub">No blocked streets yet.</div></div>`;}
  _updateGenerate(){this.shadowRoot.getElementById('configured').textContent=this._value('sensor.wandr_configured_route_count','—');this.shadowRoot.getElementById('generated').textContent=this._value('sensor.wandr_generated_route_count','—');this.shadowRoot.getElementById('summary').textContent=this._value('sensor.wandr_last_generation_summary','No generation summary yet.');}
  _updateProgress(){this.shadowRoot.getElementById('streak').textContent=`${this._value('sensor.wandr_current_streak','0')} days`;this.shadowRoot.getElementById('week').textContent=`${this._value('sensor.wandr_this_week_walks','0')} / ${this._value('sensor.wandr_this_week_miles','0')} mi`;this.shadowRoot.getElementById('month').textContent=`${this._value('sensor.wandr_this_month_walks','0')} / ${this._value('sensor.wandr_this_month_miles','0')} mi`;}
  _updateNavigate(){this.shadowRoot.getElementById('mapApp').textContent=this._value('sensor.wandr_map_app','Ask every time');}

  _loadLeaflet(){if(this._leafletPromise)return this._leafletPromise;this._leafletPromise=new Promise((res,rej)=>{if(window.L)return res();if(!document.querySelector('link[data-wandr-leaflet]')){const l=document.createElement('link');l.rel='stylesheet';l.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';l.dataset.wandrLeaflet='1';document.head.appendChild(l);}const ex=document.querySelector('script[data-wandr-leaflet]');if(ex){ex.addEventListener('load',res,{once:true});ex.addEventListener('error',rej,{once:true});return;}const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.dataset.wandrLeaflet='1';s.onload=res;s.onerror=rej;document.head.appendChild(s);});return this._leafletPromise;}
  async _routeJson(){const r=await fetch(`${this._config.json_url}?v=108&ts=${Date.now()}`,{cache:'no-store',headers:{'Cache-Control':'no-cache'}});if(!r.ok)throw new Error(`current_route.json ${r.status}`);return r.json();}
  async _draw(route){const coords=Array.isArray(route?.coords)?route.coords:[];await this._loadLeaflet();const el=this.shadowRoot.getElementById('map');if(!this._map){this._map=L.map(el,{zoomControl:true});L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'}).addTo(this._map);}[this._line,this._start,this._end].forEach(x=>x&&this._map.removeLayer(x));this._line=this._start=this._end=null;if(!coords.length){this._map.setView([39.8283,-98.5795],4);return;}this._line=L.polyline(coords,{weight:6,color:'#2f80ed'}).addTo(this._map);const same=JSON.stringify(coords[0])===JSON.stringify(coords[coords.length-1]);this._start=L.marker(coords[0]).addTo(this._map).bindPopup(same?'Start / End':'Start');if(!same)this._end=L.marker(coords[coords.length-1]).addTo(this._map).bindPopup('End');this._map.fitBounds(this._line.getBounds(),{padding:[22,22]});setTimeout(()=>this._map.invalidateSize(),120);}
  async _action(a){const press=id=>this._press(id);if(a==='previous')return press('button.wandr_previous_route');if(a==='random')return press('button.wandr_random_route');if(a==='next')return press('button.wandr_next_route');if(a==='today')return press('button.wandr_pick_today_route');if(a==='done')return press('button.wandr_mark_completed');if(a==='open'){const u=this._value('sensor.wandr_preferred_map_url')||this._value('sensor.wandr_google_maps_url');if(u)window.location.href=u;}}
  _optionsFrom(id){return this._state(id)?.attributes?.options||[];}
  _fillSelect(id,opts,sel){const s=this.shadowRoot.getElementById(id);if(!s)return;const html=opts.map(o=>`<option value="${this._esc(o)}" ${o===sel?'selected':''}>${this._esc(o)}</option>`).join('');if(s.innerHTML!==html)s.innerHTML=html;if(sel)s.value=sel;}
  _setText(id,value){return this._hass?.callService('text','set_value',{entity_id:id,value});}
  _press(id){return this._hass?.callService('button','press',{entity_id:id});}
  _pickStreet(o){if(!o||o==='No streets available')return;this._hass?.callService('select','select_option',{entity_id:'select.wandr_current_route_street',option:o});this._setText('text.wandr_street_to_avoid',o);}
  _selectBlocked(o){if(!o||o==='No blocked sections')return;this._hass?.callService('select','select_option',{entity_id:'select.wandr_blocked_street_section',option:o});}
  _esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
}

class WandrCardEditor extends HTMLElement{
  constructor(){super();this.attachShadow({mode:'open'});this._config={};}
  setConfig(config){this._config={view:'route',...(config||{})};this._render();}
  set hass(hass){this._hass=hass;}
  _render(){this.shadowRoot.innerHTML=`<style>.field{margin:12px 0}label{display:block;font-size:12px;opacity:.7;margin-bottom:6px}select,input{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);font:inherit}</style><div class="field"><label>Card content</label><select id="view"><option value="route">Route + map</option><option value="avoid">Avoid list</option><option value="generate">Generate</option><option value="navigate">Navigate</option><option value="progress">Progress</option><option value="files">Files</option></select></div><div class="field"><label>Route entity</label><input id="routeEntity"></div><div class="field"><label>Route JSON URL</label><input id="jsonUrl"></div>`;this.shadowRoot.getElementById('view').value=this._config.view||'route';this.shadowRoot.getElementById('routeEntity').value=this._config.route_entity||'sensor.wandr_route_name';this.shadowRoot.getElementById('jsonUrl').value=this._config.json_url||'/local/wandr/current_route.json';this.shadowRoot.querySelectorAll('select,input').forEach(el=>el.addEventListener('change',()=>this._changed()));}
  _changed(){const c={...this._config,view:this.shadowRoot.getElementById('view').value,route_entity:this.shadowRoot.getElementById('routeEntity').value,json_url:this.shadowRoot.getElementById('jsonUrl').value};this._config=c;this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:c},bubbles:true,composed:true}));}
}

customElements.define('wandr-card',WandrCard);
customElements.define('wandr-card-editor',WandrCardEditor);
window.customCards=window.customCards||[];
window.customCards.push({type:'wandr-card',name:'wandr Card',description:'One wandr card with a visual-editor dropdown for Route, Avoid List, Generate, Navigate, Progress, or Files.'});
