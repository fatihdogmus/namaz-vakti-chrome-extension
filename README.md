# Namaz Vakti Chrome Extension

Basic scaffolding for a Manifest V3 extension with a popup UI and a background service worker.

## Files

- `manifest.json` — extension metadata and entry points.
- `background.js` — service worker that seeds default settings on install.
- `popup.html`, `popup.css`, `popup.js` — toolbar popup UI with placeholder prayer times and a city selector in Turkish.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension and open the toolbar icon to see the popup.

You can start wiring real data and options into `popup.js` and the background worker.
