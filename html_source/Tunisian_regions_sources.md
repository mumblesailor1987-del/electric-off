# Tunisian Regions — Boundary Data Sources & User-Defined Region Feature

> **Companion document to:** `TunisianH_SPEC.md` (the Kahraba Live project spec).
> **Purpose:** (1) Catalog every reliable source for Tunisian administrative boundary data (governorates, delegations, municipalities) with granularity, license, and language coverage; (2) specify the user-defined-region feature, where users add a region by position only (no polygon), rendered as a circle on the map.
> **Last updated:** 2026-07-23
> **License:** CC BY 4.0

---

## Table of Contents

1. [Tunisian Administrative Hierarchy](#1-tunisian-administrative-hierarchy)
2. [Boundary Data Sources](#2-boundary-data-sources)
3. [Comparison Matrix](#3-comparison-matrix)
4. [Recommended Source Mix](#4-recommended-source-mix)
5. [Region Name Matching Strategy](#5-region-name-matching-strategy)
6. [User-Defined Regions Feature](#6-user-defined-regions-feature)
7. [Integration with Existing Data Model](#7-integration-with-existing-data-model)
8. [Implementation Tasks](#8-implementation-tasks)
9. [Appendix: Quick-Start Code Snippets](#9-appendix-quick-start-code-snippets)

---

## 1. Tunisian Administrative Hierarchy

Tunisia's official territorial division (per Institut National de la Statistique, INS):

| Level | Arabic | French | English | Count | Avg area |
|---|---|---|---|---|---|
| 1 | ولاية | Wilaya / Gouvernorat | Governorate | **24** | ~6,400 km² |
| 2 | معتمدية | Délégation | Delegation | **264** | ~580 km² |
| 3 | بلدية | Municipalité | Municipality | **350+** (varies by reform) | ~50 km² |
| 4 | عمادة | Imada | Imada (sector) | **2,073** | ~75 km² |
| 5 | حي / منطقة | Quartier / Zone | Neighborhood / Zone | varies | varies |

**For Kahraba Live v1:** governorates (24) + delegations (264) = **288 official zones**. famma-dhaw.com tracks ~296–298 zones, slightly more than 264 — the extra ones are likely sub-delegation neighborhoods (e.g., "Tunis — El Menzah", "Sfax — Sakkiet Ezzit"). The user-defined-region feature (§6) is exactly how we handle these "extra" zones without needing polygon data for each.

---

## 2. Boundary Data Sources

Each source below is documented with: URL, license, format, granularity, language coverage, last verified, and quality notes.

### 2.1 `jmgclark/tunisia_shapefiles` (GitHub)

| Field | Value |
|---|---|
| URL | https://github.com/jmgclark/tunisia_shapefiles |
| License | Public domain (CC0) — author declares it |
| Format | Shapefile (.shp), GeoJSON (converted), TopoJSON |
| Granularity | Governorates + delegations + municipalities |
| Languages | Arabic + English name fields |
| Last verified | 2026-07-23 |
| Quality | High — derived from official Tunisian government sources |
| Notes | The most commonly cited open-source Tunisia boundary dataset. Includes attribute tables with names in multiple scripts. Convert with `ogr2ogr` if needed. |

**Files of interest:**
- `tn_gov.shp` — 24 governorates
- `tn_delegations.shp` — 264 delegations
- `tn_municipalities.shp` — 350+ municipalities

### 2.2 `mtimet/tnacmaps` (GitHub)

| Field | Value |
|---|---|
| URL | https://github.com/mtimet/tnacmaps |
| License | MIT |
| Format | GeoJSON + TopoJSON (ready for web use) |
| Granularity | Governorates + delegations + circonscriptions (electoral districts) |
| Languages | Arabic + French + English name fields |
| Last verified | 2026-07-23 |
| Quality | High — optimized for web map rendering (simplified geometry) |
| Notes | **Best for direct web use** because the geometry is already simplified (smaller file size). Less precise than jmgclark but ~5–10x smaller payload. |

### 2.3 `OussamaNairi/List-of-Tunisian-Governorates-and-Delegations-and-Municipality` (GitHub)

| Field | Value |
|---|---|
| URL | https://github.com/OussamaNairi/List-of-Tunisian-Governorates-and-Delegations-and-Municipality |
| License | MIT |
| Format | CSV + JSON (no geometry) |
| Granularity | Governorates + delegations + municipalities |
| Languages | Arabic + French + English name fields, with phone area codes and postal codes |
| Last verified | 2026-07-23 |
| Quality | High for attribute data (names, codes); contains no polygon boundaries |
| Notes | **Use this for the trilingual name table** (`name_ar`, `name_fr`, `name_en`) and for joining boundary datasets that lack Arabic names. |

### 2.4 Humanitarian Data Exchange (HDX) — geoBoundaries Tunisia

| Field | Value |
|---|---|
| URL | https://data.humdata.org/dataset/geoboundaries-admin-boundaries-for-tunisia |
| License | Creative Commons Attribution 4.0 (CC BY 4.0) |
| Format | GeoJSON, Shapefile, KML, SVG |
| Granularity | ADM0 (country) / ADM1 (governorates) / ADM2 (delegations) / ADM3 (municipalities, where available) |
| Languages | Latin script + Arabic where available |
| Last verified | 2026-07-23 |
| Quality | Very high — academic-grade (University of Minnesota / run-jump-skip-press project) |
| Notes | **Best for ADM1 (governorate) precision**. ADM2/ADM3 coverage is comprehensive but attribute fields are less rich than jmgclark. Use as a cross-check, not as primary. |

### 2.5 GADM v4.1

| Field | Value |
|---|---|
| URL | https://gadm.org/maps/country/TUN.html |
| License | Non-commercial use only (free for academic, personal, non-profit; **commercial use requires permission**) |
| Format | Shapefile, GeoJSON, KMZ |
| Granularity | ADM1 (governorates) / ADM2 (delegations) / ADM3 (sectors) |
| Languages | English + French (limited Arabic) |
| Last verified | 2026-07-23 |
| Quality | Very high — globally recognized |
| Notes | License is restrictive for a project that may eventually be commercialized or forked. **Prefer CC0/MIT sources** if available. Use only as a fallback reference. |

### 2.6 Natural Earth (Admin 1 — States / Provinces)

| Field | Value |
|---|---|
| URL | https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/ |
| License | Public domain (CC0) |
| Format | Shapefile, GeoJSON |
| Granularity | ADM1 only (24 governorates) — no delegations |
| Languages | Latin script only (no Arabic) |
| Last verified | 2026-07-23 |
| Quality | Medium — geometry is heavily simplified (designed for 1:10m scale world maps) |
| Notes | Useful only as a tiny fallback for the 24 governorates. Do not rely on for any sub-governorate work. |

### 2.7 OpenStreetMap (via Overpass API)

| Field | Value |
|---|---|
| URL | https://overpass-turbo.eu/ (or direct API: `https://overpass-api.de/api/interpreter`) |
| License | ODbL (Open Database License) — requires attribution, derivative DBs must also be ODbL |
| Format | JSON (via Overpass QL), GeoJSON (via osmtogeojson converter) |
| Granularity | Whatever OSM mappers have tagged: governorates (`admin_level=4`), delegations (`admin_level=6`), municipalities (`admin_level=7`), imadas (`admin_level=8`) |
| Languages | `name`, `name:ar`, `name:fr`, `name:en` tags — coverage varies |
| Last verified | 2026-07-23 |
| Quality | Variable — Tunisia's OSM coverage is decent at governorate level, spotty at delegation level |
| Notes | Best for **always-up-to-date** data. Useful for verifying that no delegation has been added/renamed since the static datasets were last refreshed. See Appendix §9 for the Overpass query. |

### 2.8 geoBoundaries.com (University of Minnesota)

| Field | Value |
|---|---|
| URL | https://www.geoboundaries.org/api.html |
| License | CC BY 4.0 |
| Format | GeoJSON via REST API (`GET https://www.geoboundaries.org/api/current/gbOpen/TUN/ADM1/`) |
| Granularity | ADM1 / ADM2 / ADM3 |
| Languages | Multi-script where available |
| Last verified | 2026-07-23 |
| Quality | High, with versioned releases |
| Notes | Same source as HDX §2.4 but with a clean API. Best for **programmatic fetching**. |

### 2.9 IGN Tunisia (official mapping agency)

| Field | Value |
|---|---|
| URL | http://www.ign.nat.tn/ (intermittently available) |
| License | Restricted — official government data, licensing unclear without contacting them |
| Format | Shapefile, DWG |
| Granularity | Full hierarchy |
| Languages | Arabic + French |
| Last verified | 2026-07-23 |
| Quality | Highest possible (official source) |
| Notes | Website often down; data not directly downloadable; typically requires formal request. **Not usable for an open-source project without explicit licensing.** Listed for completeness. |

### 2.10 INS Tunisia (Institut National de la Statistique)

| Field | Value |
|---|---|
| URL | http://www.ins.tn/ |
| License | Public information (codebook usage unclear) |
| Format | PDF + Excel (no geometry, only codes and names) |
| Granularity | Full hierarchy (governorates, delegations, imadas) |
| Languages | Arabic + French |
| Last verified | 2026-07-23 |
| Quality | Authoritative for **codes and names** (no polygons) |
| Notes | Use as the **canonical authority for naming**. When a delegation appears in OSM or GADM under a slightly different spelling, defer to INS. The official codebook (last published 2014, with periodic updates) is the reference for matching famma-dhaw zone names against boundary datasets. |

### 2.11 OpenStreetMap Nominatim (geocoding fallback)

| Field | Value |
|---|---|
| URL | https://nominatim.openstreetmap.org/ |
| License | ODbL (usage policy: max 1 req/sec, must include valid HTTP referer) |
| Format | JSON |
| Use | Geocode a region name (typed by the user) to a lat/lng center point — useful for the user-defined-region feature (§6) when the user knows the name but not the coordinates. |

---

## 3. Comparison Matrix

| Source | License | ADM1 | ADM2 | ADM3 | AR names | FR names | EN names | Web-ready | Update freq |
|---|---|---|---|---|---|---|---|---|---|
| jmgclark | CC0 | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ (shapefile) | Rarely |
| mtimet/tnacmaps | MIT | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ (TopoJSON) | Rarely |
| OussamaNairi | MIT | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (CSV/JSON, no geom) | Rarely |
| HDX geoBoundaries | CC BY 4.0 | ✅ | ✅ | ✅ | ⚠️ partial | ✅ | ❌ | ✅ | Annual |
| GADM v4.1 | NC-only | ✅ | ✅ | ✅ | ⚠️ partial | ✅ | ✅ | ❌ | Annual |
| Natural Earth | CC0 | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ (tiny) | Annual |
| OSM (Overpass) | ODbL | ✅ | ⚠️ spotty | ⚠️ spotty | ✅ | ✅ | ⚠️ partial | ✅ (via converter) | Continuous |
| geoBoundaries API | CC BY 4.0 | ✅ | ✅ | ✅ | ⚠️ partial | ✅ | ❌ | ✅ (REST API) | Annual |
| IGN Tunisia | Restricted | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | N/A |
| INS Tunisia | Public info | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ (codes only) | Periodic |

Legend: ✅ = supported · ⚠️ = partial/spotty · ❌ = not supported.

---

## 4. Recommended Source Mix

For the Kahraba Live project, use a **layered approach**:

### 4.1 Primary boundary geometry (v1.1 spec decision)

**Source:** `mtimet/tnacmaps` — TopoJSON files for governorates (24) + delegations (264).

**Why:**
- MIT license (project-friendly).
- Trilingual name fields (AR/FR/EN) already included.
- TopoJSON format = ~70% smaller than equivalent GeoJSON (critical for mobile).
- Web-optimized simplification (preserves visual accuracy at zoom levels 6–10 used for Tunisia).

### 4.2 Fallback / cross-check geometry

**Source:** `HDX geoBoundaries` (via the geoBoundaries REST API).

**Why:**
- Independent academic source, CC BY 4.0.
- Use it to detect when mtimet's dataset is missing a polygon (e.g., a newly created delegation).
- Run a quarterly diff job: if a region exists in HDX but not in mtimet, log it for manual review.

### 4.3 Name authority (for famma-dhaw slug mapping)

**Source:** `OussamaNairi` CSV + `INS codebook` as the arbitration authority.

**Why:**
- OussamaNairi provides the trilingual name table for all 264 delegations in a clean machine-readable form.
- INS codebook is the official government naming — when in doubt, INS wins.

### 4.4 Live-update detection

**Source:** `OpenStreetMap Overpass API` (queried monthly).

**Why:**
- Detect new delegations or boundary changes faster than annual static datasets.
- A monthly cron job fetches all `admin_level=4` and `admin_level=6` relations for Tunisia and diffs against our `regions` table. New entries → maintainer review.

### 4.5 Geocoding for user-defined regions

**Source:** `OpenStreetMap Nominatim` (with strict rate-limit respect).

**Why:** Free, no API key, global coverage. See §6.4 for usage.

---

## 5. Region Name Matching Strategy

When seeding the `regions` table from these sources and matching famma-dhaw's zone list:

### 5.1 Step-by-step matching

```
For each famma_slug in famma-dhaw zone list:
  1. Normalize: lowercase, strip accents, strip whitespace, normalize Arabic diacritics
  2. Try exact match on regions.slug (slugified) → if hit, set famma_slug
  3. Try exact match on regions.name_fr → if hit, set famma_slug
  4. Try exact match on regions.name_en → if hit, set famma_slug
  5. Try exact match on regions.name_ar → if hit, set famma_slug
  6. Fuzzy match (Levenshtein distance ≤ 2) on any of the three names → review queue
  7. No match → mark for user-defined-region treatment (§6)
```

### 5.2 Normalization helpers

```typescript
// /home/z/my-project/.../packages/shared/src/normalize.ts

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip Latin diacritics
    .replace(/[\u064B-\u0652\u0670]/g, '') // strip Arabic diacritics
    .replace(/[\s\-_']+/g, '')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  // standard implementation
}

export function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

### 5.3 Review queue UI

The maintainer dashboard (Phase 5) should show unmatched famma slugs so the maintainer can manually map them to existing regions or promote them to user-defined regions.

---

## 6. User-Defined Regions Feature

### 6.1 Motivation

The original brief is that the map should cover "the whole country (Tunisia)". But:

1. famma-dhaw tracks ~296 zones, which is more than the 264 official delegations. The extras are sub-delegation neighborhoods that have no boundary polygon in any public dataset.
2. Tunisian administrative boundaries change (new delegations were created in 2016 reform; more may come).
3. Some users may want to track an unbounded "custom area" (a workplace, a parent's village, a school) that is not an official administrative unit.

The user-defined-region feature lets any user add such a region **by providing only a name and a position (lat/lng)**. The region is rendered on the map as a **circle** (since no polygon is available), and otherwise behaves like any other region — it can be claimed, scraped (if mapped to a famma-dhaw slug), replayed, and estimated.

### 6.2 Data model

A new table `user_regions` sits alongside `regions`:

```sql
CREATE TABLE user_regions (
  id            bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  slug          text UNIQUE NOT NULL,           -- e.g. 'user-tunis-elmenzah-9-1718'
  name_ar       text,
  name_fr       text,
  name_en       text NOT NULL,                  -- at least one name is required
  governorate   text,                           -- optional parent governorate for grouping
  lat           numeric NOT NULL,               -- center latitude (WGS84)
  lng           numeric NOT NULL,               -- center longitude (WGS84)
  radius_m      integer NOT NULL DEFAULT 1000,  -- circle radius in meters (default 1 km)
  famma_slug    text,                           -- optional: if this maps to a famma zone
  created_by    text NOT NULL,                  -- device_hash of creator (for moderation)
  created_at    timestamptz NOT NULL DEFAULT now(),
  verified      boolean NOT NULL DEFAULT false, -- maintainer-verified
  verification_note text,
  claim_count   integer NOT NULL DEFAULT 0,     -- auto-incremented on each claim
  is_public     boolean NOT NULL DEFAULT true   -- false = only visible to creator
);

CREATE INDEX idx_user_regions_geom ON user_regions USING GIST (
  -- for spatial queries (find-by-bbox, find-by-distance)
  ST_MakePoint(lng, lat)
);
CREATE INDEX idx_user_regions_verified ON user_regions (verified, claim_count DESC);
```

**RLS:**
- Anyone can `SELECT` public, verified user_regions.
- Anyone can `INSERT` (creating a new region).
- Only the creator (matched by `device_hash`) can `UPDATE`/`DELETE` their own region, and only within 24h of creation.
- Maintainer role (service role key only) can `UPDATE` (verify, hide) any region.

### 6.3 UI flow

**Entry point:** "+ Add region" button, visible in the dashboard header (next to the search box).

**Step 1 — Choose location:**

```
┌──────────────────────────────────────────┐
│  Add a region                             │
├──────────────────────────────────────────┤
│                                           │
│  📍 Click on the map to set the center,   │
│     or search for a place name:           │
│                                           │
│  🔍 [ El Menzah 9                  ]      │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │                                     │  │
│  │     [ mini map with crosshair ]     │  │
│  │                                     │  │
│  │       click to position             │  │
│  │                                     │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Selected: 36.8700° N, 10.1900° E          │
│                                           │
│                          [ Cancel ] [Next] │
└──────────────────────────────────────────┘
```

The mini-map supports both:
- Click to drop a pin (uses Leaflet's `click` event).
- Type a name → Nominatim geocode (§6.4) → pan + zoom the map, drop a pin.

**Step 2 — Name + radius:**

```
┌──────────────────────────────────────────┐
│  Add a region — Step 2 of 2               │
├──────────────────────────────────────────┤
│                                           │
│  Name (English) *  [ El Menzah 9        ] │
│  Name (Arabic)     [ المنزه 9           ] │
│  Name (French)     [ El Menzah 9        ] │
│                                           │
│  Parent governorate (optional):           │
│     [ Tunis                         ▾]    │
│                                           │
│  Circle radius:                            │
│     ◯───●────────────  1 km                │
│     [ 250 m ] [ 500 m ] [ 1 km ] [ 5 km ] │
│                                           │
│  Preview:                                  │
│  ┌─────────────────────────────────────┐  │
│  │   [ mini map showing circle ]       │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  ⚠ This region will be visible to all     │
│    users. A maintainer will review it.    │
│                                           │
│                [ Back ] [ Submit region ]  │
└──────────────────────────────────────────┘
```

**Step 3 — Confirmation:**

Toast: "✅ Region 'El Menzah 9' added. It will appear on the map for everyone after maintainer review (usually within 24h)."

The new region appears immediately on the creator's own map with a "pending verification" badge, so they can start claiming its state right away.

### 6.4 Nominatim geocoding (optional helper)

To support the search box in step 1, call Nominatim with:

```typescript
// /home/z/my-project/.../apps/web/src/lib/geocode.ts

import { useState, useCallback } from 'react';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export function useNominatimSearch() {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (query.length < 3) return;
    setLoading(true);
    try {
      const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&countrycodes=tn&format=json&limit=5`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'ar,fr;q=0.8,en;q=0.5' }
      });
      const data = await res.json();
      setResults(data.map(d => ({
        displayName: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        type: d.type,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, search, loading };
}
```

**Rate limiting:** Nominatim usage policy requires max 1 request per second per IP. Implement client-side debouncing (min 1.2s between requests) and cache results in `localStorage` for the session.

**Fallback:** if Nominatim is unreachable, the user can still click the mini-map to set the position manually — the search box is a convenience, not a requirement.

### 6.5 Map rendering

User-defined regions are rendered as **Leaflet circles**, distinct from polygon regions:

```typescript
// /home/z/my-project/.../apps/web/src/components/MapView.tsx (excerpt)

function renderRegion(region: Region | UserRegion) {
  if ('geojson' in region && region.geojson) {
    // Official region: render as polygon
    return (
      <GeoJSON
        key={region.slug}
        data={region.geojson}
        style={{ color: stateColor(region.state), weight: 1, fillOpacity: 0.4 }}
      />
    );
  }
  // User-defined region: render as circle
  return (
    <Circle
      key={region.slug}
      center={[region.lat, region.lng]}
      radius={region.radius_m}
      pathOptions={{
        color: stateColor(region.state),
        weight: 2,
        fillOpacity: 0.35,
        dashArray: region.verified ? undefined : '4 4',  // dashed if pending
      }}
      eventHandlers={{ click: () => openPopup(region.slug) }}
    >
      <Tooltip>{region.name} {region.verified ? '' : '(pending)'}</Tooltip>
    </Circle>
  );
}
```

**Visual distinction:**
- Verified user regions: solid border (same as polygons), so users can't visually tell them apart from official ones.
- Pending user regions: dashed border + "(pending)" tooltip.
- Both get the same colored fill based on state (green/red/grey).

### 6.6 Claim cooldown for user regions

Same rule as official regions: 15–30 minutes per device per region (see §6.5 of main spec).

### 6.7 Promotion to official

A nightly job checks all user-defined regions:

```sql
-- Promote user regions with > 50 unique-device claims in the last 30 days
INSERT INTO regions (slug, governorate, delegation, name_ar, name_fr, name_en, lat, lng, geojson)
SELECT
  'promoted-' || slug,
  COALESCE(governorate, 'Custom'),
  name_en,
  name_ar, name_fr, name_en,
  lat, lng,
  -- approximate polygon: a circle converted to GeoJSON
  ST_AsGeoJSON(ST_Buffer(ST_MakePoint(lng, lat)::geography, radius_m))::jsonb
FROM user_regions
WHERE claim_count > 50
  AND verified = true
  AND id NOT IN (SELECT promoted_from_user_region_id FROM regions);
```

Once promoted, the region exists in both tables (with `regions.promoted_from_user_region_id` pointing back) until the maintainer manually deletes the user-region row. State events from before promotion are migrated to the new official region.

### 6.8 Moderation

**Automatic signals:**
- If a user region is created within 200 m of an existing official region's centroid, flag for review (likely a duplicate).
- If the same `device_hash` creates > 5 regions in 24h, throttle new region creation (rate-limit at 5/day/device).
- If the name contains slurs or spam keywords (small allowlist approach), reject immediately.

**Manual review:**
- Maintainer dashboard shows a queue of unverified user regions.
- One-click actions: "Verify", "Hide", "Rename" (with reason), "Promote to official".
- Notifications to maintainer via email (Supabase function) when queue length > 10.

**Appeals:**
- A hidden region's creator sees a "your region was hidden, reason: X, click to appeal" message. Appeals go to the maintainer queue.

### 6.9 Privacy

- The `created_by` field (device hash) is **never exposed** to other users — only to the maintainer dashboard.
- Even the creator does not see "regions I created" beyond their own session; if they clear `localStorage`, the link is lost.

---

## 7. Integration with Existing Data Model

### 7.1 Unified view: `live_zone_state_all`

```sql
CREATE VIEW live_zone_state_all AS
SELECT
  r.slug, r.governorate, r.delegation,
  r.name_ar, r.name_fr, r.name_en,
  r.lat, r.lng,
  r.geojson AS geometry,
  'polygon' AS geometry_type,
  e.state, e.confidence, e.changed_at,
  COALESCE(e.on_count_scraped, 0)  + COALESCE(c.on_count_local, 0)  AS on_count,
  COALESCE(e.off_count_scraped, 0) + COALESCE(c.off_count_local, 0) AS off_count
FROM regions r
LEFT JOIN LATERAL (
  SELECT * FROM state_events
  WHERE region_slug = r.slug
  ORDER BY changed_at DESC LIMIT 1
) e ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE value='on')  AS on_count_local,
    COUNT(*) FILTER (WHERE value='off') AS off_count_local
  FROM claims WHERE region_slug = r.slug AND ts > now() - interval '45 minutes'
) c ON true

UNION ALL

SELECT
  'u-' || u.slug, COALESCE(u.governorate, 'Custom'), u.name_en,
  u.name_ar, u.name_fr, u.name_en,
  u.lat, u.lng,
  NULL::jsonb AS geometry,
  'circle' AS geometry_type,
  e.state, e.confidence, e.changed_at,
  COALESCE(e.on_count_scraped, 0)  + COALESCE(c.on_count_local, 0)  AS on_count,
  COALESCE(e.off_count_scraped, 0) + COALESCE(c.off_count_local, 0) AS off_count
FROM user_regions u
LEFT JOIN LATERAL (
  SELECT * FROM state_events
  WHERE region_slug = 'u-' || u.slug
  ORDER BY changed_at DESC LIMIT 1
) e ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE value='on')  AS on_count_local,
    COUNT(*) FILTER (WHERE value='off') AS off_count_local
  FROM claims WHERE region_slug = 'u-' || u.slug AND ts > now() - interval '45 minutes'
) c ON true
WHERE u.is_public = true AND (u.verified = true OR u.created_by = current_setting('app.device_hash', true));
```

The convention: **user-region slugs are prefixed with `u-`** so they never collide with official region slugs in the `state_events` and `claims` tables (which both key on `region_slug`).

### 7.2 State events and claims work unchanged

The `state_events` and `claims` tables already reference `region_slug` as a free-text field. As long as user regions use the `u-` prefix convention, the existing event-sourced model and RLS policies apply unchanged.

### 7.3 Realtime subscriptions

The frontend subscribes to Supabase Realtime changes on `state_events`:

```typescript
supabase
  .channel('state-changes')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'state_events' },
    payload => updateMap(payload.new)
  )
  .subscribe();
```

This catches both official and user-region state changes uniformly, because both write to the same `state_events` table.

---

## 8. Implementation Tasks

| ID | Task | Est. (h) | Phase |
|---|---|---|---|
| T-R1 | Download `mtimet/tnacmaps` TopoJSON, convert to GeoJSON, store under `packages/geojson/` | 1 | Phase 0 |
| T-R2 | Download `OussamaNairi` CSV, build `regions.csv` seed file with trilingual names + centroid lat/lng + delegation/governorate mapping | 1 | Phase 0 |
| T-R3 | Write migration `0005_user_regions.sql` to create `user_regions` table with RLS | 1 | Phase 2 |
| T-R4 | Implement name-matching script `scripts/match-famma-zones.ts` (uses Levenshtein, writes `famma_slug` to `regions` and creates unmatched as user_regions) | 3 | Phase 1 |
| T-R5 | Frontend: "Add region" modal (steps 1 + 2), with mini-map and circle preview | 4 | Phase 2 |
| T-R6 | Frontend: integrate Nominatim search (debounced, cached) | 1.5 | Phase 2 |
| T-R7 | Frontend: render user regions as Leaflet circles with state-based colors | 1.5 | Phase 2 |
| T-R8 | Update `live_zone_state` view → `live_zone_state_all` (UNION of regions + user_regions) | 1 | Phase 2 |
| T-R9 | Update MapView component to consume `live_zone_state_all` and switch between polygon/circle rendering | 1 | Phase 2 |
| T-R10 | Maintainer dashboard: queue of unverified user regions with verify/hide/rename/promote actions | 3 | Phase 5 |
| T-R11 | Nightly job: auto-promote user regions with > 50 claims to official | 1.5 | Phase 5 |
| T-R12 | Monthly job: query OSM Overpass for new `admin_level=6` delegations, log diffs vs `regions` table | 2 | Phase 5 |
| T-R13 | Documentation: `docs/regions-and-boundaries.md` explaining sources, licensing, matching algorithm | 1.5 | Phase 5 |

**Total: ~22 hours** of additional work for the user-defined-region feature, layered onto the existing spec.

---

## 9. Appendix: Quick-Start Code Snippets

### 9.1 Download and convert mtimet/tnacmaps

```bash
# /home/z/my-project/scripts/fetch-geojson.sh
mkdir -p packages/geojson
cd packages/geojson

# Clone mtimet/tnacmaps
git clone --depth 1 https://github.com/mtimet/tnacmaps.git tmp-tnacmaps

# Copy TopoJSON files
cp tmp-tnacmaps/data/governorates.topojson tunisia_governorates.topojson
cp tmp-tnacmaps/data/delegations.topojson tunisia_delegations.topojson

# Convert TopoJSON → GeoJSON for Leaflet (Leaflet-TopoJSON plugin is also fine, but GeoJSON is native)
node -e "
const topo = require('./tunisia_governorates.topojson');
const { feature } = require('topojson-client');
const geo = feature(topo, topo.objects.governorates);
require('fs').writeFileSync('./tunisia_governorates.geojson', JSON.stringify(geo));
"

# Cleanup
rm -rf tmp-tnacmaps
```

### 9.2 Overpass QL query for Tunisian delegations

```overpass
[out:json][timeout:60];
area["ISO3166-1"="TN"]->.tn;
(
  relation["admin_level"="6"]["boundary"="administrative"](area.tn);
);
out body;
>;
out skel qt;
```

Paste at https://overpass-turbo.eu/ → click "Run" → "Export" → "GeoJSON".

### 9.3 Leaflet circle vs polygon rendering

```typescript
// /home/z/my-project/.../apps/web/src/components/RegionLayer.tsx

import { GeoJSON, Circle, Tooltip } from 'react-leaflet';
import type { LiveZoneState } from '@kahraba/shared';

export function RegionLayer({ regions }: { regions: LiveZoneState[] }) {
  return (
    <>
      {regions.map(r => {
        const color = STATE_COLORS[r.state] ?? STATE_COLORS.no_data;
        if (r.geometry_type === 'polygon' && r.geometry) {
          return (
            <GeoJSON
              key={r.slug}
              data={r.geometry}
              pathOptions={{ color, weight: 1, fillOpacity: 0.4 }}
              eventHandlers={{ click: () => window.dispatchEvent(new CustomEvent('region:select', { detail: r.slug })) }}
            >
              <Tooltip sticky>{r.name}</Tooltip>
            </GeoJSON>
          );
        }
        // circle (user-defined region)
        return (
          <Circle
            key={r.slug}
            center={[r.lat, r.lng]}
            radius={r.radius_m ?? 1000}
            pathOptions={{ color, weight: 2, fillOpacity: 0.35, dashArray: r.verified ? undefined : '4 4' }}
            eventHandlers={{ click: () => window.dispatchEvent(new CustomEvent('region:select', { detail: r.slug })) }}
          >
            <Tooltip sticky>
              {r.name} {r.verified ? '' : '(pending)'}
            </Tooltip>
          </Circle>
        );
      })}
    </>
  );
}
```

### 9.4 Seed regions table from CSV

```sql
-- /home/z/my-project/supabase/migrations/0006_seed_regions.sql

-- Assumes regions.csv was loaded into a staging table via \copy
INSERT INTO regions (slug, governorate, delegation, name_ar, name_fr, name_en, lat, lng, geojson)
SELECT
  slug,
  governorate,
  delegation,
  name_ar,
  name_fr,
  name_en,
  lat,
  lng,
  -- join with the GeoJSON properties to get the polygon
  (SELECT geom FROM tunisia_delegations_geojson g
   WHERE g.properties.name_fr = regions_staging.name_fr
      OR g.properties.name_ar = regions_staging.name_ar
   LIMIT 1)
FROM regions_staging
ON CONFLICT (slug) DO NOTHING;
```

### 9.5 License attribution text (for the footer)

```
Map data © OpenStreetMap contributors (ODbL).
Tunisian boundaries © mtimet/tnacmaps (MIT).
Trilingual region names © OussamaNairi (MIT).
Live outage data © famma-dhaw.com (CC BY 4.0).
```

---

**End of document.**

*This document is licensed CC BY 4.0. Attribute "Kahraba Live / TunisianH project" with a link to https://github.com/tunisianh/kahraba-live.*
