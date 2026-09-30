<p align="center">
  <img src="public/brand/mark.png" alt="Firestone" width="110" />
</p>

<h1 align="center">Firestone Site Manager</h1>

<p align="center">
  Site management for <b>fire alarm</b> and <b>fire fighting</b> projects across the UAE —<br />
  every site on one map, daily tasks per technician, live progress, materials, expenses, photos and reports.
</p>

<p align="center">
  <b>Live demo:</b> see the website link in the <i>About</i> box on this page ·
  <a href="#features">Features</a> ·
  <a href="#run-it-locally">Run it locally</a> ·
  <a href="#how-it-works">How it works</a>
</p>

![Map of the UAE drawn as an engineering sheet, with every site and its progress](docs/screenshots/map-light.png)

> The live demo opens with realistic **sample data** (8 sites, 22 crew, two weeks of history). Everything you change stays in your own browser.

## Why

A site engineer running several fire safety installations at once juggles WhatsApp groups, Excel sheets and paper. This app puts it in one place that works on a laptop in the office **and** a phone on site — even without signal.

## Features

| | |
|---|---|
| **Map home** | The UAE drawn as an engineering drawing sheet — zone grid on a real 0.5° graticule (A–K / 1–6), title block, north arrow and scale. Each site is a pin with a progress ring; its grid reference (e.g. `F3`) links the list and the map. |
| **Scope → progress %** | Enter FA/FF quantities from the approved drawings. The app builds weighted installation stages (containment → cabling → devices → panel → testing → Civil Defence) and calculates FA, FF and overall progress. |
| **Daily tasks** | Tasks per technician and helper with quantity targets, status, hold-ups (with reason), one-tap carry-over and a daily log. Quantities entered on tasks move the site's progress. |
| **Team allocation** | A board of every site — drag people between sites on desktop, tap on a phone; mark leave or absence; copy yesterday's allocation. |
| **Materials by site conditions** | Required quantities worked out from the scope *and* the building: void detectors when the ceiling void is over 800 mm, 79 °C heads in non-air-conditioned spaces, NFPA 13 hanger spacing and spare heads, grooved vs threaded pipe, beam clamps on steel. The reason is shown next to every line. |
| **Stock on site** | Deliveries (with DN numbers) and usage give delivered / used / on-site balances and low-stock alerts, plus a ready-to-send material request. |
| **Expenses & photos** | Running costs by category and site in AED. Photos are taken from the phone camera, compressed and kept on the device. |
| **Reports** | A4 PDF reports (daily site report, weekly summary, materials, expenses) and WhatsApp-formatted notes (daily progress, all-sites summary, manpower allocation). |
| **Crew mode** | A foreman opens their own task list on a shared site phone with a 4-digit PIN. |
| **Works offline, light & dark** | Installable PWA; data lives in the browser (IndexedDB) with backup / restore to a file. Light and dark themes, with a bold high-visibility cursor for the white map. |

<table>
  <tr>
    <td><img src="docs/screenshots/site-overview.png" alt="Site overview with progress by stage" /></td>
    <td><img src="docs/screenshots/daily-dark.png" alt="Daily tasks in dark mode" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/materials.png" alt="Materials estimated from site conditions" /></td>
    <td><img src="docs/screenshots/team-board.png" alt="Manpower allocation board" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/report-dark.png" alt="WhatsApp note and PDF report" /></td>
    <td><img src="docs/screenshots/map-dark.png" alt="Map in dark mode" /></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/phone-map.png" alt="Phone view of the map" width="260" />
  &nbsp;&nbsp;
  <img src="docs/screenshots/phone-crew-dark.png" alt="Crew mode on a phone" width="260" />
</p>

## Built with

React 19 · TypeScript · Vite · Zustand + IndexedDB · d3-geo / d3-zoom · jsPDF · vite-plugin-pwa · Lucide icons.
Type: Archivo (display), Public Sans (text), IBM Plex Mono (codes and quantities).

## Run it locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5180. The first start loads the sample data; **Settings → Clear everything** starts empty.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run brand` | Regenerate logos, favicon and app icons from `logo/` |

## Deploy

Pushing to `main` publishes the app to **GitHub Pages** through `.github/workflows/deploy.yml` (Settings → Pages → Source: *GitHub Actions*). Any other static host works too: run `npm run build` and upload `dist/`, sending unknown paths to `index.html`.

## How it works

**Where the data lives** — in the browser of the device you use (IndexedDB). There is no server and no account; nothing leaves the device unless you send a PDF or note yourself. Settings → *Download backup* saves everything (optionally with photos) to a file; *Restore* loads it on another phone or laptop.

**Progress** — each system has stages with weights (FA: containment 14, cabling 14, 1st fix 8, detectors 14 …). Stage progress = done ÷ scope; system % = Σ(weight × stage %) ÷ Σ weight. Overall combines FA and FF by an adjustable split (default 40 / 60). Weights, base progress and extra stages are editable per site.

**Material rules** — `src/lib/estimate.ts`. They are planning estimates; every figure can be overridden to match the approved BOQ.

```
src/
  components/   map sheet, shell, dialogs, charts, task cards
  pages/        map home, today board, team, materials, expenses, reports, settings, crew mode
  pages/site/   overview, daily, scope, materials, expenses, photos, report
  lib/          progress maths, material estimates, PDF and WhatsApp builders
  store/        app data (IndexedDB), photos, display preferences
  data/         UAE boundaries and sample data
scripts/        build-brand (logos & icons), build-geo (map data)
```

## Credits

- Emirate boundaries © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors via [geoBoundaries](https://www.geoboundaries.org) (ODbL 1.0); neighbouring coastlines from [Natural Earth](https://www.naturalearthdata.com) (public domain).
- The Firestone name and logo belong to Firestone and are not licensed for reuse.
- Sample sites, companies and people are fictional.
