# TunisianH — Run Instructions

## Quick Start

Run the following commands in your terminal in `c:\Users\server\Music\dev\0000- dev nov 2025\electric`:

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Build for production (GitHub Pages export)
npm run build
```

The app will be accessible at: `http://localhost:5173/electric/`

---

## Implemented Features

1. **📡 Real-Time Live Scraping Indicator**:
   - UI status badge in top header & map overlay (`📡 SCRAPED LIVE DATA` vs `⚠️ DEMO MODE`).
   - Displays real-time API connection details (`famma-dhaw.com / zone_board` endpoint), status code, and poll timer.
   - Per-region popup displays scraped vote counts (`scraped_on` & `scraped_off`) vs local claims.

2. **🗺 Map Area Delimitations (Polygons)**:
   - Polygons representing area delimitations for all 24 Tunisian governorates/regions (Bizerte, Tunis, Ariana, Ben Arous, Manouba, Nabeul, Zaghouan, Béja, Jendouba, Le Kef, Siliana, Sousse, Monastir, Mahdia, Kairouan, Kasserine, Sidi Bouzid, Sfax, Gafsa, Tozeur, Kébili, Gabès, Médenine, Tataouine).
   - Filled with real-time status color coding (Green: ON, Red: OFF, Amber: Contested, Gray: No Data).
   - Interactive hover animations, glowing stroke outlines, and popup selection.

3. **⏮ Replay Mode**:
   - Scrub through past timestamps with date/time picker, timeline slider, play/pause, and variable playback speeds (1x, 60x, 3600x).

4. **📊 Rich Analytics & Stats**:
   - Real-time SVG Bar charts, Line charts, 24x7 Heatmap matrices, sortable region rankings, and CSV dataset export.

5. **🔮 1-Hour Forecast Estimation**:
   - Algorithmic predictions for region states for `now + 1h` with confidence scores and explainable methodology breakdown.

7. **⚡ Live Scraper Script**:
   - Clean, lightweight Python script (`scripts/scrape_live.py`) using standard Python (`urllib`/`json`) with zero third-party dependencies.
   - Run anytime locally:
     ```bash
     python scripts/scrape_live.py
     ```
   - Automatically populates `src/data/scraped_live.json`, which is also updated automatically every 15 minutes by GitHub Actions on GitHub Pages!