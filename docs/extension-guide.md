# 99.95 Extension — Developer & Packaging Guide

This document explains setup, development, and packaging for the 99.95 Chrome extension (Manifest V3).

## Quick start (run locally)
1. Clone the repo or open the folder in VS Code.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project root directory (`99.95`).
5. The extension icon should appear in the toolbar. Click it to open the popup.

Notes: This extension bundles all runtime libs locally (no network required).

## Project structure
- `manifest.json` — MV3 manifest.
- `background.js` — service worker for action popup management.
- `popup/` — UI and scripts for the popup.
- `landing-page/` — upload UI for ICS files.
- `assets/` — images and icons.
- `pdfs/` — reference PDF files used by sidebar.
- `shared/` — common utilities used by popup and landing page.
- `docs/` — documentation.

## Development setup
We recommend using ESLint + Prettier for consistent style.

1. Node is only required for dev tools (lint/format). Install Node.js.
2. Install dev dependencies:

   pwsh
   npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier

3. Add scripts to `package.json` (example):

  "scripts": {
    "lint": "eslint . --ext .js",
    "format": "prettier --write ."
  }

4. Run `npm run lint` and `npm run format` during development.

## Packaging (publishable crx)
1. Build steps are minimal because assets are already static.
2. In Chrome, go to `chrome://extensions` > **Pack extension**.
3. Select the project root and follow prompts. Keep private key safe.

## Testing approach
We suggest adding unit tests for the ICS parsing logic and date utilities.

- Write tests for `shared/utils.js` (timezone handling, getDateTime, isWeekend).
- Write tests for `landing-page/landing.js` parsing function `parseIcsData` by extracting parsing into a testable module or mocking `ICAL.Component`.

Simple testing using Jest (dev only):

1. npm install --save-dev jest
2. Add `test` script to `package.json`: `jest`
3. Create `__tests__/utils.test.js` asserting timezone calculations.

## Contribution guide
- Use feature branches and open PRs against `main`.
- Run `npm run lint` and `npm run format` before opening PRs.
- Add unit tests for new parsing or date logic.

## Notes & Best Practices
- Keep `permissions` minimal (currently only `storage`).
- Avoid network calls — bundle libs locally.
- Use `chrome.storage.local` for user data; data is JSON-stringified in `parsedIcsData`.
- Background service worker should avoid frequent wake-ups; use events (storage change) to update popup.

## Troubleshooting
- If popup shows errors about missing moment/ical: ensure you loaded the extension unpacked from the repository root.
- To reset stored data: in the popup sidebar choose "Upload New" or run `chrome.storage.local.remove(['parsedIcsData'])` in the console for the extension's context.

---
Last updated: $(date)
