# geochron-web

**Live day/night terminator map — real-time solar geometry, no third-party services.**

A MapLibre GL component that draws the day/night terminator line, civil twilight band, and subsolar point on a world basemap. Calculates everything client-side using SunCalc. Updates every 60 seconds (configurable).

![geochron-web dark vibe](https://github.com/eddielathamjones/geochron-web/raw/main/docs/screenshot-dark.png)

---

## Hosted Embed — $5/mo

The fastest path: embed a live geochron map on your site with a single iframe.

```html
<iframe
  src="https://geochron.eddielathamjones.com/embed?style=dark&zoom=2"
  width="100%" height="400"
  frameborder="0"
  style="border-radius:8px;"
  title="Live day/night map"
  loading="lazy"
></iframe>
```

**Free tier** includes the `geochron-web` attribution badge.
**$5/mo** removes the badge and unlocks custom vibe/style options.

[Get the hosted embed →](https://geochron.eddielathamjones.com)

---

## Self-Host

### Requirements

- Python 3.11+
- pip

### Quick Start

```bash
git clone https://github.com/eddielathamjones/geochron-web.git
cd geochron-web
pip install -r requirements.txt
python -m src.backend.app
# Open http://localhost:5002
```

### Docker

```bash
docker build -t geochron-web .
docker run -p 5002:5002 geochron-web
```

### Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/eddielathamjones/geochron-web)

The `render.yaml` is pre-configured. One-click deploy.

---

## Embed URL Parameters

The `/embed` endpoint is configurable via URL query parameters.

| Parameter     | Default   | Description |
|---------------|-----------|-------------|
| `center`      | `0,20`    | Map center as `lon,lat` |
| `zoom`        | `1.8`     | Initial zoom level (1–10) |
| `style`       | `liberty` | Map style: `liberty`, `dark`, `toner`, `blueprint`, `vintage`, `watercolor`, `highcontrast` |
| `interval`    | `60`      | Solar layer refresh in seconds |
| `controls`    | `false`   | Show style switcher buttons (`true`/`false`) |
| `clock`       | `false`   | Show UTC clock (`true`/`false`) |
| `info`        | `false`   | Show subsolar coordinates (`true`/`false`) |
| `subsolar`    | `true`    | Show subsolar point marker (`true`/`false`) |
| `terminator`  | `true`    | Show terminator line (`true`/`false`) |
| `night`       | `true`    | Show night polygon (`true`/`false`) |
| `attribution` | `true`    | Show attribution badge (`true`/`false` — paid tier removes it) |

### Examples

Operations dashboard (dark, no controls):
```
/embed?style=dark&zoom=1.5
```

Weather nerd display (full UI, centered on US):
```
/embed?center=-97,38&zoom=3&style=toner&controls=true&clock=true&info=true
```

Ambient display:
```
/embed?style=watercolor&interval=30&attribution=false
```

### Snippet API

Generate a ready-to-paste iframe snippet:
```
GET /api/embed-snippet?style=dark&zoom=2&controls=false
```

Returns:
```json
{
  "snippet": "<iframe src=\"...\" ...></iframe>",
  "src": "https://geochron.eddielathamjones.com/embed?style=dark&zoom=2&controls=false&attribution=true"
}
```

---

## How It Works

All solar geometry runs client-side:

1. **Subsolar point** — uses SunCalc to find solar noon at the prime meridian, converts to longitude, then resolves declination from solar altitude readings
2. **Night polygon** — solves the solar altitude equation using Weierstrass half-angle substitution; handles polar topology correctly
3. **Terminator line** — standard great-circle calculation from declination
4. **Equinox clamping** — declination is clamped to ±2° near the equinox to avoid numerical degeneracy

No backend calls for the solar layer. The Flask backend only serves tile transforms for custom vibes.

---

## Map Vibes

| Vibe | Description |
|------|-------------|
| `liberty` | OpenFreeMap Liberty (default, no backend) |
| `dark` | Dark inverted tiles, cool-tinted |
| `toner` | High-contrast black and white |
| `blueprint` | Blue gradient, cartographic feel |
| `vintage` | Sepia tones |
| `watercolor` | Soft, saturated, blurred |
| `highcontrast` | Maximum contrast for accessibility |

Custom vibes (dark, toner, blueprint, vintage, watercolor, highcontrast) require the Flask backend for tile transforms.

---

## Use Cases

- **Live operations dashboards** — "what time is it everywhere in our network right now"
- **IoT status pages** — ambient display showing where it's day/night for deployed devices
- **Logistics & aviation** — quick reference for global ops teams
- **Weather nerd displays** — always-on ambient solar map
- **GIS project UIs** — day/night context layer for data that's time-of-day sensitive

---

## Contributing

Issues and PRs welcome. The solar geometry module (`getSubsolarPoint`, `buildNightPolygon`, `buildTerminatorLine`) is intentionally standalone — it can be extracted into other MapLibre projects.

---

## License

MIT © Eddie Latham-Jones
