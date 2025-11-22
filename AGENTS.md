# Repository Guidelines

This project is a Manifest V3 Chrome extension that shows daily prayer times and a live countdown to the next vakit.

## Project Structure & Module Organization

- `manifest.json` – Extension metadata, permissions, and entrypoints.
- `background.js` – MV3 service worker, badge countdown, shared data access.
- `popup/` – Popup UI:
  - `popup.html`, `popup.css` – Markup and styling.
  - `js/popup.js` – Popup logic and state handling.
  - `js/prayerTimeApi.js` – HTTP client for ezanvakti.imsakiyem.com.
  - `js/prayerOrder.js`, `js/states.js` – Static data and ordering.
- `icons/` – Toolbar icons used by the manifest.

Keep new logic close to the relevant feature (popup vs background) and prefer reusing existing helpers (e.g., date/time utilities).

## Build, Test, and Development

There is no build step; the extension runs directly from source.

- Load in Chrome: `chrome://extensions` → *Developer mode* → **Load unpacked** → select this folder.
- During development, keep the Extensions page open and use **Reload** plus **Service worker** logs for debugging.

## Coding Style & Naming Conventions

- JavaScript: ES modules, `const`/`let`, arrow functions where appropriate, 4‑space indentation.
- CSS/HTML: Match existing formatting and class naming (`kebab-case` for classes/ids).
- Names: Use descriptive identifiers (`remainingTimeEl`, `ensureMonthlyTimes`), avoid one‑letter names and unnecessary abbreviations.
- Do not introduce new dependencies or build tooling without discussion.

## Testing Guidelines

Testing is manual:

- Verify popup: open the toolbar popup, change city, refresh, and confirm times and countdown.
- Verify badge: check the badge countdown updates over time and across day boundaries.

When altering API calls or time logic, test with at least two different cities and around vakit boundaries if possible.

## Commit & Pull Request Guidelines

- Commit messages: short, imperative subjects with optional explanatory body, e.g.:
  - `Add next-prayer remaining time countdown`
- Group related changes in a single commit; avoid mixing refactors with behavior changes.
- PRs should:
  - Summarize the change and motivation.
  - Mention UX-visible changes (screenshots of popup are helpful).
  - Call out any manifest or permission changes explicitly.

