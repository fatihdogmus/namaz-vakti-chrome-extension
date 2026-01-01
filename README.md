# Namaz Vakti Chrome Extension

Manifest V3 toolbar popup (Turkish UI) that asks for your şehir, fetches yearly prayer times JSON from this repo
(via raw GitHub URL), caches them in IndexedDB, and shows today’s times.


## Files

- `manifest.json` — extension metadata, host permissions, and entry points.
- `background.js` — service worker that updates the badge and notifications using cached city data.
- `popup/` — popup UI assets (`popup.html`, `popup.css`) and JS modules (`js/` with popup logic, constants, and API
  client).
- `data/json/` — generated yearly prayer time JSON per city (used by the extension).
- `scrape-diyanet.js` — Playwright scraper + Excel parser that generates JSONs.

## Data & caching

- City data is fetched from `https://raw.githubusercontent.com/fatihdogmus/namaz-vakti-chrome-extension/master/data/json/<city>.json`.
- Responses are cached in IndexedDB by city slug; cache is refreshed automatically when the year changes or on manual refresh.

## Automated updates

- `.github/workflows/update-prayer-times.yml` runs yearly (03:00 UTC+3) to regenerate `data/json/` and commits changes.
- Note: the source site may show a captcha in headless mode; if the workflow fails, run the scraper locally or on a
  self-hosted runner.


## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension and open the toolbar icon to see the popup.
