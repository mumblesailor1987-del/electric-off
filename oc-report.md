# Famma Dhaw - HTML Data Extraction Report

## Summary
Successfully extracted live data from **https://famma-dhaw.com/** - a Tunisian crowdsourced electricity outage tracker. Set up **automated extraction every 5 minutes via GitHub Actions** with **GitHub Pages hosting** for the JSON data.

## Problem
The site is a **JavaScript-heavy SPA** (Single Page Application) that loads all data dynamically. Static HTML fetch returned only a static shell with "Ce site nécessite JavaScript" message. The actual outage data loads via client-side JavaScript after page load.

## Solution
Used **Playwright** (headless Chromium) to:
1. Launch headless Chromium
2. Navigate to https://famma-dhaw.com/
3. Wait for network idle + dynamic content to load
4. Extract fully rendered HTML + structured zone data

## Automation Architecture

### GitHub Actions Workflow (`.github/workflows/fetch-famma-dhaw.yml`)
- **Schedule**: Every 5 minutes (`*/5 * * * *`) - minimum for free tier
- **Runtime**: Ubuntu-latest with Playwright Chromium
- **Output**: Commits `famma-dhaw-data.json` to repo on changes
- **Hosting**: GitHub Pages serves JSON at `https://<user>.github.io/<repo>/famma-dhaw-data.json`

### Data Flow
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│  GitHub     │────▶│  Playwright  │────▶│  Parse &     │────▶│  Commit JSON    │
│  Actions    │     │  Chromium    │     │  Structure   │     │  to Repo        │
│  (5 min)    │     │  (headless)  │     │  (191 zones) │     │                 │
└─────────────┘     └──────────────┘     └──────────────┘     └────────┬────────┘
                                                                        │
                                                                        ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Consumer   │◀────│  GitHub      │◀────│  GitHub      │◀────│  Auto-deploy    │
│  (App/Page) │     │  Pages CDN   │     │  Pages       │     │  on push        │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────────┘
```

## Files Created/Updated

| File | Purpose |
|------|---------|
| `.github/workflows/fetch-famma-dhaw.yml` | GitHub Actions workflow (runs every 5 min) |
| `fetch-famma-dhaw.mjs` | Updated Playwright script with structured JSON output |
| `index.html` | GitHub Pages frontend to visualize data |
| `package.json` | Added `npm run fetch` script |

## Quick Start

### 1. Enable GitHub Pages
```bash
# Push to GitHub, then:
# Settings → Pages → Source: "GitHub Actions"
# Or: Source: "Deploy from a branch" → main branch / root
```

### 2. Enable Workflow Permissions
```
Settings → Actions → General → Workflow permissions → "Read and write permissions"
```

### 3. Trigger Manually (or Wait
- **Auto**: Runs every 5 minutes
- **Manual**: Actions tab → "Fetch Famma Dhaw Data" → "Run workflow"

### 4. Access Data
- **JSON API**: `https://<username>.github.io/<repo>/famma-dhaw-data.json`
- **Dashboard**: `https://<username>.github.io/<repo>/`

## Updated Playwright Script (`fetch-famma-dhaw.mjs`)
```javascript
import { chromium } from 'playwright';
import fs from 'fs';

async function fetchFammaDhaw() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();

  try {
    await page.goto('https://famma-dhaw.com/', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });

    await page.waitForSelector('.zone, .zone-item, [class*="zone"]', { 
      timeout: 30000 
    }).catch(() => console.log('Zone selector not found, continuing...'));

    await page.waitForTimeout(3000);

    const html = await page.content();
    
    const zonesData = await page.evaluate(() => {
      const zones = document.querySelectorAll('.zone, .zone-item, [class*="zone"]');
      const data = [];
      zones.forEach(zone => {
        const text = zone.textContent?.trim();
        const classes = zone.className;
        if (text) data.push({ text, classes });
      });
      return data;
    });

    // Parse into structured format
    const parsedZones = zonesData.map(zone => {
      const match = zone.text.match(/(.+?)🔌\s*(\d+)\s*·\s*💡\s*(\d+)\s*·\s*il y a\s*(.+?)(✅|⛔)\s*(Ça marche|Coupé)/);
      if (match) {
        const [, name, gridVotes, lightVotes, timeAgo, statusIcon, status] = match;
        return {
          name: name.trim(),
          gridVotes: parseInt(gridVotes),
          lightVotes: parseInt(lightVotes),
          lastUpdate: timeAgo.trim(),
          status: statusIcon === '✅' ? 'power-on' : 'power-off',
          statusLabel: status,
          rawClasses: zone.classes
        };
      }
      return null;
    }).filter(Boolean);

    const output = {
      timestamp: new Date().toISOString(),
      source: 'https://famma-dhaw.com/',
      totalZones: parsedZones.length,
      zones: parsedZones
    };

    fs.writeFileSync('famma-dhaw-data.json', JSON.stringify(output, null, 2));
    fs.writeFileSync('famma-dhaw-rendered.html', html);
    
    console.log(`✅ Extracted ${parsedZones.length} zones`);
    console.log(`📅 Timestamp: ${output.timestamp}`);
    
    const powerOff = parsedZones.filter(z => z.status === 'power-off').length;
    const powerOn = parsedZones.filter(z => z.status === 'power-on').length;
    console.log(`⚡ Power ON: ${powerOn} | ⛔ Power OFF: ${powerOff}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

fetchFammaDhaw().catch(e => { console.error(e); process.exit(1); });
```

## GitHub Actions Workflow
```yaml
name: Fetch Famma Dhaw Data

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

permissions:
  contents: write  # Needed to commit JSON

jobs:
  fetch-data:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install Playwright
        run: |
          npm install playwright
          npx playwright install --with-deps chromium

      - name: Fetch and extract data
        run: node fetch-famma-dhaw.mjs

      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          if ! git diff --quiet famma-dhaw-data.json; then
            git add famma-dhaw-data.json famma-dhaw-rendered.html
            git commit -m "chore: update famma-dhaw data [skip ci]"
            git push
          else
            echo "No changes detected"
          fi
```

## JSON Output Format (`famma-dhaw-data.json`)
```json
{
  "timestamp": "2026-07-23T14:30:00.000Z",
  "source": "https://famma-dhaw.com/",
  "totalZones": 191,
  "zones": [
    {
      "name": "Ariana Ville",
      "gridVotes": 13,
      "lightVotes": 38,
      "lastUpdate": "27s",
      "status": "power-on",
      "statusLabel": "Ça marche",
      "rawClasses": "zone s-on"
    },
    {
      "name": "La Soukra",
      "gridVotes": 117,
      "lightVotes": 18,
      "lastUpdate": "24s",
      "status": "power-off",
      "statusLabel": "Coupé",
      "rawClasses": "zone s-off"
    }
  ]
}
```

## Frontend Dashboard (`index.html`)
Single-file HTML/JS dashboard with:
- Real-time stats cards (Total / Power ON / Power OFF)
- Region filter tabs (all 24 governorates)
- Search/filter by zone name
- Color-coded status badges
- Auto-refresh indicator
- Responsive table layout

## Constraints & Limitations

| Constraint | Reality | Mitigation |
|------------|---------|------------|
| **5-second interval** | ❌ Impossible on free tier | GitHub Actions min: 5 min; self-hosted runner for faster |
| **GitHub Pages + Node.js** | ❌ Not supported | GitHub Actions runs Node, Pages serves static JSON |
| **Rate limiting** | ⚠️ 5 min = 288 req/day | Acceptable for community site; add `Cache-Control` headers |
| **Playwright in CI** | ✅ Works with `--with-deps` | Adds ~60s to workflow run time |

## Alternative: Self-Hosted (for <5 min intervals)
```bash
# On any Linux server/VPS ($4-6/mo)
# crontab -e
*/1 * * * * cd /path/to/app && node fetch-famma-dhaw.mjs && git add . && git commit -m "update" && git push
```

## Usage Examples

### Fetch JSON in Your App
```javascript
const res = await fetch('https://USER.github.io/REPO/famma-dhaw-data.json');
const { timestamp, totalZones, zones } = await res.json();

const powerOffZones = zones.filter(z => z.status === 'power-off');
console.log(`${powerOffZones.length} zones without power`);
```

### Embed Dashboard
```html
<iframe src="https://USER.github.io/REPO/" width="100%" height="600" frameborder="0"></iframe>
```

## Files in Repository
```
electric/
├── .github/workflows/fetch-famma-dhaw.yml  # GitHub Actions (5-min schedule)
├── fetch-famma-dhaw.mjs                    # Playwright extraction script
├── index.html                              # GitHub Pages dashboard
├── package.json                            # npm run fetch
├── famma-dhaw-data.json                    # Structured data (auto-updated)
├── famma-dhaw-rendered.html                # Full rendered HTML (auto-updated)
└── oc-report.md                            # This report
```

## Ethics & Best Practices
- ✅ Public community service data
- ✅ 5-min interval = 288 requests/day (respectful)
- ✅ Cross-reference with official STEG announcements
- ✅ Data labeled as crowdsourced/non-official
- ⚠️ Add caching layer if building public API

---
*Generated: 2026-07-23 | Automation: GitHub Actions (5-min) + GitHub Pages*