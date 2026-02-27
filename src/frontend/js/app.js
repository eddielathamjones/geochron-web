'use strict';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const MIN_DECL = 2 * RAD;

// ── Map init ───────────────────────────────────────────────────────────────────

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [0, 20],
  zoom: 1.8,
  minZoom: 1,
  maxZoom: 10,
  attributionControl: { compact: true },
});

// ── Solar geometry ─────────────────────────────────────────────────────────────

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

/**
 * Clamp declination away from zero to avoid degeneracy near the equinox.
 * Preserves sign; when |decl| < MIN_DECL, snaps to +/- MIN_DECL.
 */
function clampDeclination(declRaw) {
  if (Math.abs(declRaw) >= MIN_DECL) return declRaw;
  return (declRaw >= 0 ? 1 : -1) * MIN_DECL;
}

/**
 * Builds a GeoJSON Polygon covering the region where solar altitude < altThresholdDeg.
 *
 * Uses the Weierstrass half-angle substitution t = tan(phi/2) to solve:
 *   A*sin(phi) + B*cos(phi) = s
 * where A = sin(decl), B = cos(decl)*cos(H), s = sin(altThreshold).
 *
 * The (+) root always yields the night-side boundary for thresholds >= -6 deg,
 * which have polar-cap topology. Deeper thresholds (< -12 deg) form a band near
 * the anti-solar side and are not handled here (V1 scope: 0 deg and -6 deg only).
 *
 * Near the equinox (|decl| < 2 deg) declination is clamped to avoid degeneracy.
 */
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

  // Close the polygon by sweeping to the pole in night.
  // Night pole is south when sun is in NH (decl > 0), north when in SH.
  const pole = decl > 0 ? -90 : 90;
  coords.push([180, pole]);
  coords.push([-180, pole]);
  coords.push(coords[0]);

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  };
}

function buildTerminatorLine(ssLon, declRaw) {
  const decl = clampDeclination(declRaw);
  const coords = [];

  for (let lon = -180; lon <= 180; lon++) {
    const H   = (lon - ssLon) * RAD;
    const lat = Math.atan(-Math.cos(H) / Math.tan(decl)) * DEG;
    coords.push([lon, lat]);
  }

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  };
}

function buildPointFeature(lon, lat) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {},
  };
}

// ── Layer config ───────────────────────────────────────────────────────────────
//
// Two stacked layers:
//   night    (alt < 0 deg)  -- outer, larger polygon -- 0.30 opacity
//   twilight (alt < -6 deg) -- inner, smaller polygon -- 0.30 opacity added on top
//
// Combined opacity: civil twilight band ~ 30%, deeper night ~ 51%.

const BANDS = [
  { id: 'night',    alt:  0, opacity: 0.30 },
  { id: 'twilight', alt: -6, opacity: 0.30 },
];

const NIGHT_COLOR = '#0a1428';

// ── Map layer management ───────────────────────────────────────────────────────

function addLayers() {
  const { lon, lat, decl } = getSubsolarPoint(new Date());

  for (const { id, alt, opacity } of BANDS) {
    const poly = buildNightPolygon(lon, decl, alt);
    if (!poly) continue;
    map.addSource(`src-${id}`, { type: 'geojson', data: poly });
    map.addLayer({
      id:     `lyr-${id}`,
      type:   'fill',
      source: `src-${id}`,
      paint:  { 'fill-color': NIGHT_COLOR, 'fill-opacity': opacity },
    });
  }

  map.addSource('src-terminator', { type: 'geojson', data: buildTerminatorLine(lon, decl) });
  map.addLayer({
    id:     'lyr-terminator',
    type:   'line',
    source: 'src-terminator',
    paint:  { 'line-color': '#ffffff', 'line-width': 0.8, 'line-opacity': 0.25 },
  });

  map.addSource('src-subsolar', { type: 'geojson', data: buildPointFeature(lon, lat) });
  map.addLayer({
    id:     'lyr-subsolar',
    type:   'circle',
    source: 'src-subsolar',
    paint:  {
      'circle-radius':       5,
      'circle-color':        '#ffd700',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
      'circle-opacity':      0.9,
    },
  });

  updateSubsolarInfo(lat, lon);
}

function updateLayers() {
  const { lon, lat, decl } = getSubsolarPoint(new Date());

  for (const { id, alt } of BANDS) {
    const poly = buildNightPolygon(lon, decl, alt);
    if (poly) map.getSource(`src-${id}`)?.setData(poly);
  }

  map.getSource('src-terminator')?.setData(buildTerminatorLine(lon, decl));
  map.getSource('src-subsolar')?.setData(buildPointFeature(lon, lat));

  updateSubsolarInfo(lat, lon);
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function updateClock() {
  const utc = new Date().toISOString().slice(11, 19);
  document.getElementById('utc-time').textContent = utc;
}

function updateSubsolarInfo(lat, lon) {
  const latStr = Math.abs(lat).toFixed(1);
  const lonStr = Math.abs(lon).toFixed(1);
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  document.getElementById('subsolar-info').textContent =
    `subsolar  ${latStr}\u00B0${ns}  ${lonStr}\u00B0${ew}`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

map.on('load', () => {
  addLayers();

  updateClock();
  setInterval(updateClock, 1000);

  setInterval(updateLayers, 60_000);
});
