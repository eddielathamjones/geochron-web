'use strict';

// ── URL Parameter Config ────────────────────────────────────────────────────

const _p = new URLSearchParams(window.location.search);

function _parseCenter(str) {
  if (!str) return [0, 20];
  const parts = str.split(',').map(Number);
  return (parts.length === 2 && parts.every(n => !isNaN(n))) ? parts : [0, 20];
}

function _parseBool(key, defaultVal) {
  const v = _p.get(key);
  if (v === null) return defaultVal;
  return v !== 'false' && v !== '0';
}

const CFG = {
  center:      _parseCenter(_p.get('center')),
  zoom:        parseFloat(_p.get('zoom'))     || 1.8,
  style:       _p.get('style')               || 'liberty',
  interval:    parseInt(_p.get('interval'), 10) || 60,
  controls:    _parseBool('controls',    false),  // vibe picker — embed default: off
  clock:       _parseBool('clock',       false),  // UTC clock — embed default: off
  info:        _parseBool('info',        false),  // subsolar info — embed default: off
  subsolar:    _parseBool('subsolar',    true),   // subsolar map layer
  terminator:  _parseBool('terminator', true),
  night:       _parseBool('night',      true),
  attribution: _parseBool('attribution', true),
  token:       _p.get('token') || null,
};

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MIN_DECL = 2 * RAD;

// ── Vibe config ─────────────────────────────────────────────────────────────

const VIBES = {
  liberty:      { label: 'Liberty',     styleUrl: 'https://tiles.openfreemap.org/styles/liberty' },
  vintage:      { label: 'Vintage',     styleUrl: '/api/tiles/style/vintage' },
  toner:        { label: 'Toner',       styleUrl: '/api/tiles/style/toner' },
  blueprint:    { label: 'Blueprint',   styleUrl: '/api/tiles/style/blueprint' },
  dark:         { label: 'Dark',        styleUrl: '/api/tiles/style/dark' },
  watercolor:   { label: 'Watercolor',  styleUrl: '/api/tiles/style/watercolor' },
  highcontrast: { label: 'Hi-Contrast', styleUrl: '/api/tiles/style/highcontrast' },
};

const STORAGE_KEY  = 'geochron-vibe';
const DEFAULT_VIBE = VIBES[CFG.style] ? CFG.style : 'liberty';

function currentVibe() {
  if (!CFG.controls) return DEFAULT_VIBE;
  const saved = localStorage.getItem(STORAGE_KEY);
  return (saved && VIBES[saved]) ? saved : DEFAULT_VIBE;
}

function switchVibe(vibe) {
  if (!VIBES[vibe]) return;
  localStorage.setItem(STORAGE_KEY, vibe);
  document.querySelectorAll('#vibe-picker button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.vibe === vibe);
  });
  map.setStyle(VIBES[vibe].styleUrl);
}

function buildVibePicker() {
  const picker = document.getElementById('vibe-picker');
  if (!picker || !CFG.controls) return;
  const active = currentVibe();
  for (const [key, { label }] of Object.entries(VIBES)) {
    const btn = document.createElement('button');
    btn.dataset.vibe = key;
    btn.textContent  = label;
    if (key === active) btn.classList.add('active');
    btn.addEventListener('click', () => switchVibe(key));
    picker.appendChild(btn);
  }
}

// ── Map init ─────────────────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container: 'map',
  style:     VIBES[currentVibe()].styleUrl,
  center:    CFG.center,
  zoom:      CFG.zoom,
  minZoom:   1,
  maxZoom:   10,
  attributionControl: { compact: true },
});

// ── Solar geometry ────────────────────────────────────────────────────────────

function getSubsolarPoint(date) {
  const noon  = SunCalc.getTimes(date, 0, 0).solarNoon;
  const noonH = noon.getUTCHours() + noon.getUTCMinutes() / 60 + noon.getUTCSeconds() / 3600;
  const utcH  = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  let ssLon = (noonH - utcH) * 15;
  ssLon = ((ssLon + 180) % 360 + 360) % 360 - 180;

  const posEq = SunCalc.getPosition(date, 0,  ssLon);
  const posN  = SunCalc.getPosition(date, 1,  ssLon);
  const posS  = SunCalc.getPosition(date, -1, ssLon);
  const sign  = posN.altitude >= posS.altitude ? 1 : -1;
  const decl  = sign * (Math.PI / 2 - posEq.altitude);

  return { lon: ssLon, lat: decl * DEG, decl };
}

function clampDeclination(declRaw) {
  if (Math.abs(declRaw) >= MIN_DECL) return declRaw;
  return (declRaw >= 0 ? 1 : -1) * MIN_DECL;
}

function buildNightPolygon(ssLon, declRaw, altThresholdDeg) {
  const decl = clampDeclination(declRaw);
  const A = Math.sin(decl);
  const s = Math.sin(altThresholdDeg * RAD);
  const coords = [];

  for (let lon = -180; lon <= 180; lon++) {
    const H    = (lon - ssLon) * RAD;
    const B    = Math.cos(decl) * Math.cos(H);
    const disc = A * A + B * B - s * s;
    if (disc < 0) continue;
    const denom = B + s;
    let t;
    if (Math.abs(denom) < 1e-8) {
      t = -(B - s) / (2 * A);
    } else {
      t = (A + Math.sqrt(disc)) / denom;
    }
    let lat = 2 * Math.atan(t) * DEG;
    lat = Math.max(-89.9, Math.min(89.9, lat));
    coords.push([lon, lat]);
  }

  if (coords.length === 0) return null;
  const pole = decl > 0 ? -90 : 90;
  coords.push([180, pole], [-180, pole], coords[0]);
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

function buildTerminatorLine(ssLon, declRaw) {
  const decl = clampDeclination(declRaw);
  const coords = [];
  for (let lon = -180; lon <= 180; lon++) {
    const H   = (lon - ssLon) * RAD;
    const lat = Math.atan(-Math.cos(H) / Math.tan(decl)) * DEG;
    coords.push([lon, lat]);
  }
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} };
}

function buildPointFeature(lon, lat) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} };
}

// ── Layer management ──────────────────────────────────────────────────────────

const BANDS = [
  { id: 'night',    alt:  0, opacity: 0.30 },
  { id: 'twilight', alt: -6, opacity: 0.30 },
];
const NIGHT_COLOR = '#0a1428';

function addLayers() {
  const { lon, lat, decl } = getSubsolarPoint(new Date());

  if (CFG.night) {
    for (const { id, alt, opacity } of BANDS) {
      const poly = buildNightPolygon(lon, decl, alt);
      if (!poly) continue;
      map.addSource(`src-${id}`, { type: 'geojson', data: poly });
      map.addLayer({ id: `lyr-${id}`, type: 'fill', source: `src-${id}`,
        paint: { 'fill-color': NIGHT_COLOR, 'fill-opacity': opacity } });
    }
  }

  if (CFG.terminator) {
    map.addSource('src-terminator', { type: 'geojson', data: buildTerminatorLine(lon, decl) });
    map.addLayer({ id: 'lyr-terminator', type: 'line', source: 'src-terminator',
      paint: { 'line-color': '#ffffff', 'line-width': 0.8, 'line-opacity': 0.25 } });
  }

  if (CFG.subsolar) {
    map.addSource('src-subsolar', { type: 'geojson', data: buildPointFeature(lon, lat) });
    map.addLayer({ id: 'lyr-subsolar', type: 'circle', source: 'src-subsolar',
      paint: { 'circle-radius': 5, 'circle-color': '#ffd700',
               'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
               'circle-opacity': 0.9 } });
  }

  updateSubsolarInfo(lat, lon);
}

function updateLayers() {
  const { lon, lat, decl } = getSubsolarPoint(new Date());

  if (CFG.night) {
    for (const { id, alt } of BANDS) {
      const poly = buildNightPolygon(lon, decl, alt);
      if (poly) map.getSource(`src-${id}`)?.setData(poly);
    }
  }
  if (CFG.terminator) {
    map.getSource('src-terminator')?.setData(buildTerminatorLine(lon, decl));
  }
  if (CFG.subsolar) {
    map.getSource('src-subsolar')?.setData(buildPointFeature(lon, lat));
  }
  updateSubsolarInfo(lat, lon);
}

// ── Clock & info ──────────────────────────────────────────────────────────────

function updateClock() {
  const el = document.getElementById('utc-time');
  if (el) el.textContent = new Date().toISOString().slice(11, 19);
}

function updateSubsolarInfo(lat, lon) {
  const el = document.getElementById('subsolar-info');
  if (!el) return;
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  el.textContent = `subsolar  ${Math.abs(lat).toFixed(1)}\u00B0${ns}  ${Math.abs(lon).toFixed(1)}\u00B0${ew}`;
}

// ── Attribution badge ─────────────────────────────────────────────────────────

function buildAttributionBadge() {
  if (!CFG.attribution) return;
  const badge = document.createElement('a');
  badge.id        = 'geochron-badge';
  badge.href      = 'https://geochron.eddielathamjones.com';
  badge.target    = '_blank';
  badge.rel       = 'noopener noreferrer';
  badge.textContent = 'geochron-web';
  document.body.appendChild(badge);
}

// ── Init ──────────────────────────────────────────────────────────────────────

// Show optional UI elements based on config
if (CFG.clock) {
  const el = document.getElementById('clock');
  if (el) el.style.display = '';
}
if (CFG.info) {
  const el = document.getElementById('subsolar-info');
  if (el) el.style.display = '';
}
if (CFG.controls) {
  const el = document.getElementById('vibe-picker');
  if (el) el.style.display = '';
}

map.on('style.load', addLayers);

updateClock();
setInterval(updateClock, 1000);
setInterval(updateLayers, CFG.interval * 1000);

buildVibePicker();
buildAttributionBadge();
