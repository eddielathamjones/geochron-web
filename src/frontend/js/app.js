'use strict';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

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

/**
 * Returns the subsolar point and solar declination for a given UTC date.
 *
 * Subsolar longitude: the meridian where solar noon is occurring right now,
 * derived from SunCalc's solar noon at the prime meridian + current UTC offset.
 *
 * Solar declination: signed angle from the equator to the sub-solar latitude.
 * Determined from altitude at the equator at the subsolar meridian (H = 0).
 * Sign is resolved by comparing altitudes at ±1° latitude.
 */
function getSubsolarPoint(date) {
  const noon   = SunCalc.getTimes(date, 0, 0).solarNoon;
  const noonH  = noon.getUTCHours() + noon.getUTCMinutes() / 60 + noon.getUTCSeconds() / 3600;
  const utcH   = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // Subsolar longitude: solar noon at prime meridian gives equation-of-time offset;
  // shift by current hour to get the longitude where noon is happening now.
  let ssLon = (noonH - utcH) * 15;
  ssLon = ((ssLon + 180) % 360 + 360) % 360 - 180; // normalise to [-180, 180]

  // Declination: at H = 0, sin(alt) = cos(decl), so |decl| = 90° - alt.
  // Resolve sign by comparing altitudes at +1° and -1° latitude.
  const posEq = SunCalc.getPosition(date, 0,  ssLon);
  const posN  = SunCalc.getPosition(date, 1,  ssLon);
  const posS  = SunCalc.getPosition(date, -1, ssLon);
  const sign  = posN.altitude >= posS.altitude ? 1 : -1;
  const decl  = sign * (Math.PI / 2 - posEq.altitude); // radians

  return { lon: ssLon, lat: decl * DEG, decl };
}

/**
 * Returns a GeoJSON Polygon covering the region where solar altitude < altThresholdDeg.
 *
 * Boundary formula (isoline at constant solar altitude α₀):
 *   sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(H) = sin(α₀)
 * Solved analytically for φ at each longitude step.
 *
 * Near the equinox (|δ| < 2°) declination is clamped to ±2° to avoid
 * numerical degeneracy where the formula approaches a meridian line.
 * TODO: implement proper equinox half-sphere polygon.
 */
function buildNightPolygon(date, altThresholdDeg = 0) {
  const { lon: ssLon, decl: declRaw } = getSubsolarPoint(date);

  const MIN_DECL = 2 * RAD;
  const decl  = Math.abs(declRaw) < MIN_DECL
    ? (declRaw >= 0 ? MIN_DECL : -MIN_DECL)
    : declRaw;

  const sinA0 = Math.sin(altThresholdDeg * RAD);
  const coords = [];

  for (let lon = -180; lon <= 180; lon++) {
    const H = (lon - ssLon) * RAD;
    const p = Math.sin(decl);
    const q = Math.cos(decl) * Math.cos(H);
    const R = Math.sqrt(p * p + q * q);

    if (R < Math.abs(sinA0)) continue; // no solution at this longitude

    const psi = Math.atan2(q, p);
    let lat = (Math.asin(sinA0 / R) - psi) * DEG;
    lat = Math.max(-89.9, Math.min(89.9, lat));
    coords.push([lon, lat]);
  }

  if (coords.length === 0) return null;

  // Close the polygon around the pole that lies on the night side.
  // South pole altitude = arcsin(-sin(δ)); in night when -sin(δ) < sin(altThreshold).
  const southInNight = Math.sin(decl) > -sinA0;
  const pole         = southInNight ? -90 : 90;

  coords.push([180,  pole]);
  coords.push([-180, pole]);
  coords.push(coords[0]); // close ring

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  };
}

// ── Layer config: stacked translucent bands simulate twilight gradient ─────────
//
// Each band covers the region deeper than its altitude threshold.
// Opacity accumulates across overlapping layers, creating a smooth gradient
// from civil twilight (~12%) through to full astronomical night (~55%).

const BANDS = [
  { id: 'night-0',  alt:   0, opacity: 0.12 }, // civil twilight outer edge
  { id: 'night-6',  alt:  -6, opacity: 0.18 }, // nautical twilight
  { id: 'night-12', alt: -12, opacity: 0.20 }, // astronomical twilight
  { id: 'night-18', alt: -18, opacity: 0.22 }, // full dark
];

const NIGHT_COLOR = '#0a1428';

// ── Map layer management ──────────────────────────────────────────────────────

function addLayers() {
  const date = new Date();

  // Night overlay bands
  for (const { id, alt, opacity } of BANDS) {
    const poly = buildNightPolygon(date, alt);
    if (!poly) continue;

    map.addSource(`src-${id}`, { type: 'geojson', data: poly });
    map.addLayer({
      id:     `lyr-${id}`,
      type:   'fill',
      source: `src-${id}`,
      paint:  { 'fill-color': NIGHT_COLOR, 'fill-opacity': opacity },
    });
  }

  // Terminator line (α = 0 boundary)
  const terminatorLine = buildTerminatorLine(date);
  map.addSource('src-terminator', { type: 'geojson', data: terminatorLine });
  map.addLayer({
    id:     'lyr-terminator',
    type:   'line',
    source: 'src-terminator',
    paint:  { 'line-color': '#ffffff', 'line-width': 0.8, 'line-opacity': 0.25 },
  });

  // Subsolar point marker
  const ss = getSubsolarPoint(date);
  map.addSource('src-subsolar', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [ss.lon, ss.lat] },
      properties: {},
    },
  });
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

  updateSubsolarInfo(ss);
}

function updateLayers() {
  const date = new Date();

  for (const { id, alt } of BANDS) {
    const poly = buildNightPolygon(date, alt);
    if (poly) map.getSource(`src-${id}`)?.setData(poly);
  }

  const terminatorLine = buildTerminatorLine(date);
  map.getSource('src-terminator')?.setData(terminatorLine);

  const ss = getSubsolarPoint(date);
  map.getSource('src-subsolar')?.setData({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [ss.lon, ss.lat] },
    properties: {},
  });

  updateSubsolarInfo(ss);
}

/**
 * Extracts the terminator boundary (α = 0) as a GeoJSON LineString.
 * Re-uses the polygon coords, minus the pole-closing points.
 */
function buildTerminatorLine(date) {
  const poly = buildNightPolygon(date, 0);
  if (!poly) return { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} };

  // coords = [...terminator points, [180, pole], [-180, pole], first_point]
  // Drop the last 3 (pole closes) to get just the terminator curve.
  const all    = poly.geometry.coordinates[0];
  const coords = all.slice(0, all.length - 3);

  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  };
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  const h   = String(now.getUTCHours()).padStart(2, '0');
  const m   = String(now.getUTCMinutes()).padStart(2, '0');
  const s   = String(now.getUTCSeconds()).padStart(2, '0');
  document.getElementById('utc-time').textContent = `${h}:${m}:${s}`;
}

function updateSubsolarInfo(ss) {
  const lat = ss.lat.toFixed(1);
  const lon = ss.lon.toFixed(1);
  const ns  = ss.lat >= 0 ? 'N' : 'S';
  const ew  = ss.lon >= 0 ? 'E' : 'W';
  document.getElementById('subsolar-info').textContent =
    `subsolar  ${Math.abs(lat)}°${ns}  ${Math.abs(lon)}°${ew}`;
}

// ── Init ──────────────────────────────────────────────────────────────────────

map.on('load', () => {
  addLayers();

  updateClock();
  setInterval(updateClock, 1000);       // clock ticks every second

  setInterval(updateLayers, 60_000);    // terminator updates every minute
});
