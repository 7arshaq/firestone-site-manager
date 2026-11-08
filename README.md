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

> **Version 2** — the scope is a simple to-do list. Version 1 (device quantities, weighted stages and worked-out materials) is kept as the `v1.0` tag and the `version-1` branch. See [Versions](#versions).

> The app starts empty. To look around first, open **Settings → Load sample data** (8 example sites, 22 crew, two weeks of history). Everything you add stays in your own browser.

## Why

A site engineer running several fire safety installations at once juggles WhatsApp groups, Excel sheets and paper. This app puts it in one place that works on a laptop in the office **and** a phone on site — even without signal.

## Features

| | |
|---|---|
| **Map home** | The UAE drawn as an engineering drawing sheet — zone grid on a real 0.5° graticule (A–K / 1–6), title block, north arrow and scale. Each site is a pin with a progress ring; its grid reference (e.g. `F3`) links the list and the map. Everything about a site — team, today's tasks, materials, expenses, photos, reports — lives inside that site. |
| **Scope as a to-do list** | Write the site's scope as sentences — one item per line, FA, FF or general. Add variations and pending work found on site as they come up. Progress is simply the share of items ticked off, per system and overall; no quantities or weights to keep up to date. |
| **Start from the drawings** | When adding a site, drop in the drawing PDFs or photos. Claude reads them in the background, fills in the project details, writes a first scope list for you to check, asks a few simple questions about anything unclear, and compares the drawings with the pin on a satellite view. Uses your own Claude API key (Settings → Drawing reader); the drawings are kept with the site. |
| **Daily tasks** | Each day, assign pending items from the scope list to the team. Tasks have a status, hold-ups (with reason), one-tap carry-over and a daily log. Marking a task Done ticks its item off the scope list. |
| **Team per site** | Each site's Team tab: choose the day's crew, bring people over from another site, mark leave or absence, repeat yesterday's crew, and add new technicians and helpers right there. |
| **Materials on site** | Type each material the site needs and how much. For each one: needed, requested, delivered, used and on site, with low-stock alerts. Material requests are saved as “requested” until delivered and sent as a WhatsApp message; deliveries carry DN numbers. |
| **Expenses & photos** | Running costs by category and site in AED. Photos are taken from the phone camera, compressed and kept on the device. |
| **Reports** | A4 PDF reports (daily site report, weekly summary, materials, expenses) and WhatsApp-formatted notes (daily progress, all-sites summary, manpower allocation). Site reports are in each site's Report tab; the all-sites ones are under Share on the map. |
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

React 19 · TypeScript · Vite · Zustand + IndexedDB · d3-geo / d3-zoom · jsPDF · pdf.js · Claude API (Anthropic SDK) · vite-plugin-pwa · Lucide icons.
Type: Archivo (display), Public Sans (text), IBM Plex Mono (codes and quantities).

## Run it locally

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5180. The app starts empty; **Settings → Load sample data** fills it with example sites.

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

**Progress** — items ticked off ÷ items on the scope list, for fire alarm, fire fighting and overall. Adding a variation or work found on site adds to the list, so the percentage stays honest about what is left.

```
src/
  components/   map sheet, shell, dialogs, charts, task cards
  pages/        map home, add/edit site, settings, crew mode
  pages/site/   overview, today, team, scope list, materials, expenses, photos, report
  lib/          progress maths, material estimates, PDF and WhatsApp builders
  store/        app data (IndexedDB), photos, display preferences
  data/         UAE boundaries and sample data
scripts/        build-brand (logos & icons), build-geo (map data)
```

## Versions

| | |
|---|---|
| **Version 2** (current) | The scope is a to-do list written in sentences. Pending work is assigned to the team day by day; finished items are ticked off. Materials are typed in by hand. |
| **Version 1** — tag `v1.0`, branch `version-1` | FA/FF device quantities and site conditions; weighted installation stages; materials worked out from the scope and the building; progress read from highlighted drawings. |

Opening Version 2 on a device that used Version 1 converts its data automatically: each stage becomes a scope list item (ticked when it was complete), and the worked-out material list becomes the site's own list, with its deliveries and usage. Version 1 backups can be restored too.

## Credits

- Emirate boundaries © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors via [geoBoundaries](https://www.geoboundaries.org) (ODbL 1.0); neighbouring coastlines from [Natural Earth](https://www.naturalearthdata.com) (public domain).
- The Firestone name and logo belong to Firestone and are not licensed for reuse.
- Sample sites, companies and people are fictional.
- Satellite imagery © Esri, Maxar, Earthstar Geographics. Addresses from OpenStreetMap Nominatim. Drawings are read by Claude (Anthropic) using the engineer's own API key, which stays in their browser.
