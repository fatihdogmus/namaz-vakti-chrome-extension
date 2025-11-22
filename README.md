# Namaz Vakti Chrome Extension

Manifest V3 toolbar popup (Turkish UI) that asks for your şehir, fetches monthly prayer times from
ezanvakti.imsakiyem.com, caches them locally, and shows today’s times.

## Files

- `manifest.json` — extension metadata, host permissions, and entry points.
- `background.js` — service worker that seeds default settings on install.
- `popup/` — popup UI assets (`popup.html`, `popup.css`) and JS modules (`js/` with popup logic, constants, and API
  client).

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension and open the toolbar icon to see the popup.
