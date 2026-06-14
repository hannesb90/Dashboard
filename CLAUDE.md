# Dashboard – Claude instructions

## After every code change
- Bump the service worker cache version in `sw.js` (`energy-pwa-vN` → next N)
- Update the matching `<div id="ver-badge">vN</div>` in `index.html`
- Push directly to `main` (no feature branches)
