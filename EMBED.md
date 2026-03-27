# GeoChron Web — Embed Guide

GeoChron Web is a live day/night terminator map you can embed anywhere with a single `<iframe>`. It shows what time it is everywhere on Earth — no API keys, no third-party data, pure client-side solar math.

## Quick Embed

```html
<iframe
  src="https://geochron.app"
  width="100%"
  height="400"
  frameborder="0"
  allowfullscreen
  title="Live Day/Night Map">
</iframe>
```

## URL Parameters

All configuration is done via query string. Every parameter is optional.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `center` | `0,20` | Initial map center as `lng,lat` |
| `zoom` | `1.8` | Initial zoom level (1–10) |
| `minzoom` | `1` | Minimum zoom |
| `maxzoom` | `10` | Maximum zoom |
| `style` | OpenFreeMap Liberty | MapLibre style URL |
| `interval` | `60` | Layer refresh interval in seconds |
| `clock` | `true` | Set `false` to hide the UTC clock |
| `subsolar` | `true` | Set `false` to hide the subsolar coordinates bar |
| `attribution` | `true` | Set `false` to hide the geochron.app badge (paid tier) |

## Examples

**Default full-world view:**
```
https://geochron.app
```

**Centered on the Pacific, zoomed out:**
```
https://geochron.app?center=-160,20&zoom=2
```

**Clean kiosk embed — no overlays:**
```
https://geochron.app?clock=false&subsolar=false&attribution=false
```

**Faster refresh for a live ops dashboard:**
```
https://geochron.app?interval=10
```

**Focused on Europe:**
```
https://geochron.app?center=15,50&zoom=3
```

## Self-Hosting

The frontend is pure HTML/CSS/JS — no build step required. Clone the repo and serve `src/frontend/` from any static host.

```bash
git clone https://github.com/eddielathamjones/geochron-web
cd geochron-web
# serve with any static server:
python3 -m http.server 8080 --directory src/frontend/
```

Or deploy via Docker / Render using the included `render.yaml`.

## npm

```bash
npm install @eddielathamjones/geochron-web
```

The package contains the full frontend source (`src/frontend/`). Copy or reference the files in your own build pipeline.

## Paid Tier — Remove Attribution

The hosted embed is **free** with the `geochron.app` attribution badge. To remove the badge and unlock custom styling, subscribe at **$5/month**:

→ [geochron.app/pro](https://geochron.app/pro) *(Stripe payment link — see STRIPE.md)*

Paid subscribers receive a URL token that enables `?attribution=false` on the hosted embed.

## Architecture

- **Solar math:** [SunCalc](https://github.com/mourner/suncalc) (MIT) for subsolar point derivation
- **Rendering:** [MapLibre GL JS](https://maplibre.org/) (BSD-3) for the map canvas
- **Tiles:** [OpenFreeMap](https://openfreemap.org/) (free, no key required)
- **Night polygon:** Weierstrass half-angle substitution solver — closed-form, no iteration
- **Backend:** Flask + Gunicorn, only serves static files (no server-side solar math)

Everything runs client-side. The Flask backend is a thin static file host; you can replace it with Nginx, Caddy, or any CDN.
