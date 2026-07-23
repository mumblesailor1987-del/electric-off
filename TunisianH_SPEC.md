# Kahraba Live (TunisianH) — Project Specification

> **Working name:** Kahraba Live — *kahraba* = "electricity" in Arabic; chosen to be trilingual-friendly and distinct from famma-dhaw's own branding (see §20.8 on naming ethics).
> **Legacy codename:** TunisianH (kept as the GitHub account/org name: `tunisianh`)
> **Tagline:** *Real-time electricity outage map for Tunisia, by citizens, for citizens.*
> **Repository:** `tunisianh/kahraba-live` (GitHub, public)
> **Hosting:** GitHub Pages (free tier) + Cloudflare Workers (free tier) + Supabase **or** Neon (free tier)
> **Source of truth for outage data:** `https://famma-dhaw.com/` (community-run, non-official, built by Ghazi Ktata)
> **Document version:** 1.1 (reconciled with `kahraba-live-spec.md`)
> **Last updated:** 2026-07-23
> **Owner:** Project Maintainer (you)
> **Contributors:** TBD

---

## Table of Contents

0. [Document Metadata](#0-document-metadata)
1. [Project Overview](#1-project-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Architecture](#3-architecture)
4. [User Personas](#4-user-personas)
5. [User Stories](#5-user-stories)
6. [Functional Specifications](#6-functional-specifications)
7. [Technical Specifications](#7-technical-specifications)
8. [Data Model](#8-data-model)
9. [Scraping Strategy](#9-scraping-strategy)
10. [Estimation Algorithm](#10-estimation-algorithm)
11. [Internationalization (i18n)](#11-internationalization-i18n)
12. [UI/UX Design](#12-uiux-design)
13. [Development Phases / Roadmap](#13-development-phases--roadmap)
14. [Task Breakdown](#14-task-breakdown)
15. [Risk Register](#15-risk-register)
16. [Deployment Plan](#16-deployment-plan)
17. [Testing Strategy](#17-testing-strategy)
18. [Acceptance Criteria](#18-acceptance-criteria)
19. [Performance & Scaling](#19-performance--scaling)
20. [Privacy, Legal & Ethics](#20-privacy-legal--ethics)
21. [Glossary](#21-glossary)
22. [Appendices](#22-appendices)

---

## 0. Document Metadata

| Field | Value |
|---|---|
| Document type | Functional + Technical Specification |
| Audience | Maintainer, contributors, future developers, evaluators |
| Status | Draft v1.0 — ready for kickoff |
| Language of spec | English (the app itself is trilingual AR/EN/FR) |
| Source of outage data | `https://famma-dhaw.com/` (community-run Supabase-backed dashboard) |
| License (code) | MIT |
| License (data) | CC BY 4.0 (with attribution to famma-dhaw.com) |
| Repo URL | `https://github.com/tunisianh/tunisianh` |
| Live URL | `https://tunisianh.github.io/tunisianh/` |

### Changelog

| Date | Author | Change |
|---|---|---|
| 2026-07-23 | Maintainer | Initial draft v1.0 |
| 2026-07-23 | Maintainer | **v1.1** — Reconciled with `kahraba-live-spec.md`. Major changes: (1) adopted event-sourced `StateEvent` data model as the recommended approach (write-on-change instead of periodic snapshots — storage drops from ~30 MB/day to ~hundreds of KB/day); (2) added WebSocket push as the real-time delivery mechanism, replacing the 1-second client polling pattern; (3) renamed project from "TunisianH" to "Kahraba Live" (legacy codename retained for the GitHub org); (4) added Phase 0 task: inspect famma-dhaw's network requests for a JSON endpoint before assuming HTML scraping is required; (5) added ethics commitments re: reaching out to Ghazi Ktata (famma-dhaw's creator) and treating citizen claims as a first-class independent data source, not a supplement; (6) added Phase B estimation feature: temperature/heat forecast as a feature (outages are heat-driven); (7) added claims-vs-scraped agreement rate as a statistics metric; (8) added explicit RTL bidi guidance (keep numbers/timestamps LTR inside RTL layout); (9) adopted the "Grid Control Room" design language with IBM Plex Sans/Mono fonts and a breaker-switch mode selector; (10) added concrete Tunisian boundary-dataset references; (11) added Neon as a DB alternative with the Supabase 7-day-pause caveat; (12) bumped cooldown range to 15–30 min (tunable against observed abuse); (13) added SMS/USSD fallback to future ideas; (14) added explicit map-tile-provider warning against pointing production traffic at `tile.openstreetmap.org` directly. |

### v1.1 Reconciliation Summary

This document is a merger of two parallel drafts written independently:

1. **TunisianH_SPEC.md v1.0** (this file, original) — deep on tasks, acceptance criteria, GDPR, security testing.
2. **kahraba-live-spec.md v0.1.0** (external, by another author) — stronger on architecture honesty, ethics, data model, design language, real-world references.

The merger adopts kahraba's superior ideas (listed in the changelog) while preserving TunisianH's depth in implementation planning. Where the two specs disagreed, the decision rationale is documented inline at the affected section. The two design philosophies are not in conflict — they are complementary.

---

## 1. Project Overview

### 1.1 Context

Tunisia experiences recurring electricity load-shedding during summer heatwaves. The state utility (STEG) communicates outage schedules, but real-time ground truth is often unavailable or inaccurate. A community-run site, **famma-dhaw.com**, lets citizens one-tap vote whether their zone has power; votes auto-expire after 45 minutes. This produces a near-real-time community signal of outages across the country.

**TunisianH** builds on top of that signal to deliver:

1. A **live interactive map** of Tunisia showing per-region electricity state.
2. A **replay mode** that lets users scrub back to any past date/time and see the state at that moment.
3. A **statistics tab** with rich historical analytics (outage duration, frequency, peak hours, regional comparison).
4. A **transparency layer** showing how many users claimed "ON" vs "OFF" per region (so users can judge confidence).
5. A **claim mechanism** so users on TunisianH itself can update their region's state — their claim is treated as a new data point merged with scraped famma-dhaw data.
6. An **estimation tab** that uses historical patterns to predict the next likely state per region.

### 1.2 One-paragraph pitch

Kahraba Live (legacy codename TunisianH) is a trilingual (Arabic / English / French), mobile-first, citizen-powered live outage map for Tunisia. It ingests the community dashboard famma-dhaw.com on a respectful schedule, merges those signals with its own user claims, and renders them on an OpenStreetMap-based map. Users can replay any past moment, explore rich statistics, and view algorithmic estimates of near-future states. The entire stack runs on free tiers: GitHub Pages for the static frontend, Cloudflare Workers (or GitHub Actions) for the scraper, and Supabase or Neon for storage. **Real-time feel is delivered via WebSocket push on state change** — not via literal 1-second polling — because that is what "real-time" actually means to a user watching their region's power state.

### 1.3 Why this matters

- **Citizens** get a fast, mobile-friendly answer to "is the power out in my area / my parents' area right now?"
- **Journalists & researchers** get an open dataset of community-reported outages.
- **Civic tech practitioners** get a reference architecture for free-tier, no-backend-provider, citizen-science dashboards.
- **STEG and policymakers** get a second, independent signal to compare against official communications.

### 1.4 Relationship to famma-dhaw.com (CRITICAL — read before building)

famma-dhaw.com is **not a faceless data source** — it is a young, single-developer civic project built by **Ghazi Ktata** during the summer 2026 heatwave, shared for free, with no signup required. It explicitly labels itself: *"Données communautaires non officielles · Croisez avec les communiqués STEG"*.

This has three consequences for Kahraba Live:

1. **Outreach before scraping.** Phase 0 includes a task to reach out to Ghazi Ktata before building a scraper against his site — to ask about a data-sharing arrangement, an official API, or at minimum to make him aware of our intent. A reverse-engineered scraper against a single person's project is a fragile and somewhat uncollegial foundation; a known, agreed-upon data path is more robust and more respectful.
2. **Citizen claims are first-class, not a supplement.** Kahraba Live's own user-claim flow is not a fallback for when scraping breaks — it is a primary, independent data source. If famma-dhaw.com access is withdrawn or breaks, Kahraba Live keeps producing meaningful data, because the citizens reporting directly to us are still there.
3. **Naming and branding.** The project is deliberately renamed from "TunisianH" to "Kahraba Live" to avoid any impression of impersonating or free-riding on famma-dhaw's identity. Attribution to famma-dhaw.com is prominent on every screen, and the disclaimer mirrors famma-dhaw's own honesty about its unofficial status.

### 1.5 Feasibility note: "real-time every 1 second" on a free tier

The original brief asks for data refreshed every second, hosted on GitHub's free tier. This deserves an honest answer up front rather than a quiet workaround:

- **GitHub Pages has no backend** — only static files. The per-second logic cannot live there.
- **Free-tier cron services cap at minute granularity** (Cloudflare Workers Cron, GitHub Actions cron, etc.). Literal 1-second scraping requires a persistent always-on process outside any free tier.
- **Storage:** naively storing a row per region per second is ~26 million rows/day for 300 regions — far beyond any free-tier DB's total quota.

**What "real-time" actually means here:** the user sees their region's state flip within moments of the underlying change. This is achieved by:

1. Scraping at a respectful 1–5 minute interval (the source site updates its 45-minute rolling window, so sub-minute scraping adds little signal).
2. Writing to the DB **only when a region's state actually changes** (event-sourced model — see §8), not on every poll.
3. Pushing the change to all connected dashboards instantly via WebSocket.

The user perceives this as real-time. The infrastructure is not literally polling every second, and it does not need to be. See §9 for the full scraping strategy.

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **G1 — Live map.** Show the electricity state of every Tunisian region (governorate + delegation level) on an interactive OSM map, refreshing at most every 1 second of source data.
2. **G2 — Replay.** Allow users to pick any past date/time (within stored history) and see the map state at that moment.
3. **G3 — Statistics.** Provide a tab with charts and tables covering outage frequency, duration, peak hours, regional rankings, and trends.
4. **G4 — Transparency.** Always show the count of "ON" vs "OFF" claims per region, plus the source (scraped vs local user).
5. **G5 — User claims.** Let any user claim their region's current state in ≤ 2 taps; the claim is stored and merged into the live view.
6. **G6 — Estimation.** Provide an algorithmic estimate of each region's likely state for the next 1–3 hours, based on historical patterns.
7. **G7 — Trilingual.** Full UI in Arabic (RTL), English (LTR), and French (LTR); switchable instantly, persisted per device.
8. **G8 — Free tier.** Whole stack runs on GitHub Pages + Cloudflare Workers + Supabase free tiers. Zero monthly cost.
9. **G9 — Mobile-first.** Optimized for low-end Android devices on 3G.
10. **G10 — Open data.** All aggregated data published under CC BY 4.0; code under MIT.

### 2.2 Non-Goals (explicit exclusions)

1. **NG1 — Not an official STEG replacement.** TunisianH does not claim to be authoritative; it is a community signal aggregator.
2. **NG2 — No user accounts.** No login, no email, no password. Anonymous device-bound claims only (to prevent spam, not to identify).
3. **NG3 — No push notifications in v1.** (May be added in v2 via Web Push.)
4. **NG4 — No native mobile apps.** PWA-only in v1.
5. **NG5 — No predictive models beyond classical statistics.** No deep learning in v1 — keep the algorithm auditable and explainable.
6. **NG6 — No scraping of STEG site.** Only famma-dhaw.com is scraped. STEG data, if used, is manually entered by maintainers.
7. **NG7 — No sub-delegation granularity in v1.** Region = governorate + delegation (≈ 264 delegations). Sub-delegation zones may come in v2.
8. **NG8 — No paid tiers.** If free-tier limits are hit, the project degrades gracefully (lower refresh rate) rather than pay.

---

## 3. Architecture

### 3.1 The GitHub Pages constraint (and what "real-time" actually means)

GitHub Pages is **static-only**: it serves HTML/CSS/JS/assets but cannot run server-side code, cannot maintain server-side state, and cannot run a cron job. A "scrape every 1 second" requirement therefore **cannot be done from the client**, and even from a serverless function the minimum cron interval on any free tier is 1 minute.

**The honest answer:** "real-time" in this context means *the user sees their region's state change within moments of the underlying change* — not that we are literally fetching every second. We achieve this with three design choices:

1. **Scrape at a respectful 1–5 minute interval.** famma-dhaw's own aggregation is a 45-minute rolling window, so sub-minute scraping adds little signal and stresses a single-developer's infrastructure unnecessarily.
2. **Write to the DB only when a region's state actually changes** (event-sourced `StateEvent` model — see §8.3). This keeps storage at a few hundred to a few thousand rows/day, sustainable indefinitely on a free tier.
3. **Push each change to connected dashboards via WebSocket.** The user perceives the change instantly, without any polling.

### 3.2 Architecture (recommended — v1.1)

**Hybrid free-tier architecture:** static PWA on GitHub Pages + Cloudflare Worker scraper + Supabase (or Neon) for storage + Supabase Realtime (or a tiny FastAPI WebSocket relay) for push.

```
┌────────────────────────┐         ┌─────────────────────────┐
│  famma-dhaw.com        │         │  Supabase (their DB)    │
│  (community site)      │────────▶│  - zone_board view      │
└────────────────────────┘         │  - reports              │
                                   │  - zone_suggestions     │
                                   └────────────┬────────────┘
                                                │ (public read via REST)
                                                ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Worker — `kahraba-live-scraper`                 │
│  - Cron Trigger every 1 minute (free tier min interval)     │
│  - Fetches famma-dhaw zone_board                             │
│  - Diffs against last-known state per region                │
│  - Writes StateEvent rows ONLY on state change              │
│  - Triggers Supabase Realtime broadcast on write            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase (or Neon) Postgres — `kahraba-live` project      │
│  - regions      (static reference: ~296 zones, trilingual)  │
│  - state_events (event-sourced: 1 row per state CHANGE)     │
│  - claims       (1 row per Kahraba Live user claim)         │
│  - estimates    (computed every 5 min by worker)            │
│  - daily_stats  (materialised nightly via pg_cron)          │
│  - scrape_runs  (audit log of every scraper invocation)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ (1) Supabase Realtime channel
                               │     broadcasts new StateEvent
                               │ (2) Client opens WebSocket
                               │     on dashboard load
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages — static PWA                                  │
│  - HTML/CSS/JS (Vite + React + Leaflet)                     │
│  - i18n bundles (ar / en / fr)                              │
│  - Listens to Supabase Realtime channel for state changes   │
│  - Falls back to 5s polling if WebSocket fails              │
│  - Writes user claims directly to Supabase (RLS-protected)  │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Alternative architecture (FastAPI + GitHub Actions + Neon)

For maintainers more comfortable with Python than with Cloudflare Workers, an equivalent stack exists:

| Component | Recommended stack (§3.2) | Alternative stack |
|---|---|---|
| Scraper host | Cloudflare Worker (cron) | GitHub Actions (cron — unlimited on public repos) |
| Scraper language | TypeScript | Python (httpx or Playwright) |
| Backend API | Supabase REST (no custom server) | FastAPI on Render/Fly.io free tier (cold-starts in seconds) |
| DB | Supabase Postgres | Neon Postgres (no auto-delete, scales to zero) |
| Realtime push | Supabase Realtime channels | FastAPI WebSocket + Postgres LISTEN/NOTIFY |
| Historical archive | Supabase only | Git-committed JSON snapshots in `/data` (free, vendor-independent backup) |

**When to choose the alternative:** if you anticipate needing custom server-side logic (e.g., complex aggregation, ML inference, CSV streaming) that doesn't fit cleanly in a Worker, or if you value the git-committed JSON snapshot as a vendor-independent backup.

**When to choose the recommended stack:** if you want zero backend to maintain, the smallest possible attack surface, and the fastest cold-start (Cloudflare Workers have effectively no cold-start).

Both stacks are documented in this spec; pick one and stick with it for v1. The data model (§8) and the scraper's public interface should be identical regardless of stack.

### 3.4 Component inventory (recommended stack)

| Layer | Component | Host | Free-tier limit | Our usage |
|---|---|---|---|---|
| Frontend | Static PWA (Vite + React + Leaflet) | GitHub Pages | 100 GB/mo bandwidth, 1 GB repo | < 100 MB, < 10 GB/mo |
| Scraper | Cloudflare Worker + Cron Trigger | Cloudflare | 100k requests/day | ~1,440/day (1/min) — vast headroom |
| DB | Supabase (Postgres) | Supabase | 500 MB DB, 50k MAU, **pauses after 7 days inactivity** | < 50 MB; scraper keeps it warm |
| DB (alt) | Neon Postgres | Neon | 0.5 GB storage, scales to zero, **no inactivity pause** | < 50 MB; auto-resumes in ~1s |
| Realtime | Supabase Realtime | Supabase | Included in free tier | < 300 concurrent listeners |
| Map tiles | OSM-based (Stadia Maps Alidade) | Stadia | 250k loads/mo free | < 100k/mo |
| i18n | Bundled JSON dictionaries | GitHub Pages | n/a | ~30 KB |

### 3.5 Why the DB choice matters (Supabase vs Neon)

| Option | Inactivity pause? | Auto-delete? | Built-in realtime | Verdict |
|---|---|---|---|---|
| **Supabase free** | Yes — pauses after **7 days with no API activity** (data preserved; needs manual or automated resume) | No | Yes (Realtime channels) | OK if scraper keeps it warm (it will) |
| **Neon free** | No — scales to zero, resumes in ~1s on first query | No | No (build push yourself) | Best for persistence paranoia |
| **Render free Postgres** | n/a | **Yes — deleted after 30 days** | n/a | **AVOID** — incompatible with a historical-data project |

Free-tier terms shift often (Render revised pricing April 2026; Supabase tightened pause policy February 2026). Re-verify on each provider's pricing page before committing. The scraper running every minute keeps Supabase warm indefinitely, so its pause risk is theoretical for this project; if you ever pause the scraper for >7 days, Neon is the safer choice.

### 3.6 High-level data flow (event-sourced)

```
famma-dhaw.com  ──(scraped every 1 min by CF Worker)──▶  diff per region
                                                                │
                                          ┌─────────────────────┴─────────────────────┐
                                          │ state changed?                              │
                                          ├── YES ──▶ INSERT state_events row           │
                                          │           + broadcast via Realtime channel  │
                                          │           + increment scrape_runs.regions_changed │
                                          └── NO  ──▶ skip write (storage stays lean)   │
                                                                │
                                                                ▼
                                          nightly pg_cron job  ──▶  daily_stats
                                          5-min CF Worker job  ──▶  estimates
                                                                │
Kahraba Live user  ──(claims ON/OFF via PWA)──────────▶  claims (RLS INSERT)
                                                                │
                                                                ▼
                                          live_zone_state view (latest event per region)
                                                                │
                                                                ▼
                          PWA: WebSocket listener ─────────────▶  Map / Stats / Estimation tabs update instantly
                          PWA: 5s polling fallback (if WS fails)
```

---

## 4. User Personas

### 4.1 P1 — Sami, the concerned son (mobile, casual)

- 28, lives in Tunis, parents in Sidi Bouzid.
- Wants to know: "Do my parents have power right now?"
- Opens the app on his phone, looks at the map, taps Sidi Bouzid.
- Trusts the data more if he sees "23 ON / 7 OFF" transparency counts.

### 4.2 P2 — Leila, the journalist (desktop, power user)

- 35, reporter at a Tunisian daily.
- Wants to write a story about summer 2026 outages.
- Uses the **Replay mode** to see the map on July 15 at 21:00.
- Uses the **Statistics tab** to export CSV of outage durations per governorate.
- Needs the data to be citable (CC BY) and methodology to be documented.

### 4.3 P3 — Mehdi, the developer / civic-tech observer (desktop, technical)

- 31, builds similar dashboards.
- Wants to read the spec, audit the estimation algorithm, fork the repo.
- Expects clean code, clear docs, open data, MIT license.

### 4.4 P4 — Khadija, the elderly mother (low-end Android, low literacy)

- 62, lives in Sidi Bouzid.
- Son installed the PWA on her phone.
- Wants one big button "I have power" / "I don't have power" in Arabic.
- Does not understand maps; benefits from a region search box.

### 4.5 P5 — A researcher / academic

- Wants bulk historical data for a paper.
- Uses the Statistics tab → "Export CSV" → downloads a year of snapshots.

---

## 5. User Stories

Format: `US-<epic>.<id> — As a <persona>, I want <action>, so that <benefit>.`

### 5.1 Epic E1 — Live Map (Welcome / Dashboard)

- **US-E1.1** — As Sami, I want to see a map of Tunisia on first load, with each region colored by its current electricity state (green = ON, red = OFF, grey = no data), so that I can grasp the situation in 2 seconds.
- **US-E1.2** — As Sami, I want the map to refresh every 1 second without me reloading, so that I always see the latest state.
- **US-E1.3** — As Sami, I want to tap a region and see a popup with: region name (trilingual), current state, last-updated time, ON count, OFF count, source breakdown (scraped vs user-claimed), so that I can judge confidence.
- **US-E1.4** — As Khadija, I want a search box where I type my region name in Arabic and jump to it, so that I do not need to read a map.
- **US-E1.5** — As Sami, I want a "locate me" button that centers the map on my GPS position, so that I see my area first.
- **US-E1.6** — As Leila, I want a small "last updated Xs ago" indicator visible at all times, so that I know whether the data is fresh.
- **US-E1.7** — As Mehdi, I want a "data sources" link in the footer that opens a modal explaining exactly what is scraped and at what frequency, so that I can audit the methodology.

### 5.2 Epic E2 — Replay Mode

- **US-E2.1** — As Leila, I want a "Replay" toggle on the dashboard that reveals a date/time picker, so that I can scrub to any past moment.
- **US-E2.2** — As Leila, I want a play/pause button and a speed selector (1x, 60x, 3600x) so that I can watch an outage unfold over time.
- **US-E2.3** — As Leila, I want a slider that lets me scrub minute-by-minute through history, so that I can find the exact moment a region went dark.
- **US-E2.4** — As Leila, I want the replayed view to clearly show a "REPLAY — 2026-07-15 21:00" badge, so that I never confuse replayed data with live data.
- **US-E2.5** — As Leila, I want the URL to reflect the replayed timestamp (e.g. `?replay=20260715T2100`), so that I can share a specific moment with colleagues.

### 5.3 Epic E3 — Statistics Tab

- **US-E3.1** — As Leila, I want a "Statistics" tab with a date-range selector, so that I can scope the analysis.
- **US-E3.2** — As Leila, I want a bar chart of "total outage minutes per governorate" for the selected range, so that I can rank regions.
- **US-E3.3** — As Leila, I want a line chart of "number of regions OFF" over time, so that I can see peak outage windows.
- **US-E3.4** — As Leila, I want a heatmap of outages by hour-of-day × day-of-week, so that I can identify patterns.
- **US-E3.5** — As Leila, I want a table of the 20 longest continuous outages per region, with start/end timestamps and duration.
- **US-E3.6** — As Leila, I want a "Download CSV" button on every chart, so that I can do further analysis offline.
- **US-E3.7** — As a researcher, I want a "Download full snapshot dump (zipped CSV)" button, so that I can bulk-export the dataset.

### 5.4 Epic E4 — Transparency

- **US-E4.1** — As Sami, I want each region's popup to show "X users reported ON, Y users reported OFF in the last 45 minutes", so that I can judge how much to trust the state.
- **US-E4.2** — As Mehdi, I want each region's popup to show a breakdown: "X scraped reports, Y local TunisianH claims", so that I can audit the source mix.
- **US-E4.3** — As Leila, I want a small "methodology" link in the popup that opens a modal explaining how states are computed, so that I can cite it.
- **US-E4.4** — As Sami, I want a per-region mini-sparkline showing the last 60 minutes of ON/OFF counts, so that I can see momentum.

### 5.5 Epic E5 — User Claims

- **US-E5.1** — As Khadija, I want two big buttons in my region's popup: "I have power" (green) and "I don't have power" (red), so that I can contribute in one tap.
- **US-E5.2** — As Khadija, I want the buttons in Arabic by default, so that I understand them.
- **US-E5.3** — As Sami, I want a 10-minute cooldown per region per device (matching famma-dhaw), so that I cannot spam.
- **US-E5.4** — As Sami, I want a confirmation toast "Thank you, your claim was recorded" after submitting, so that I know it worked.
- **US-E5.5** — As Sami, I want my claim to be visible on the map within 1 second, so that I see my contribution.
- **US-E5.6** — As Mehdi, I want each claim to be publicly auditable (anonymised device hash + timestamp + region + value) in a "Recent claims" feed, so that I can verify the system is honest.

### 5.6 Epic E6 — Estimation Tab

- **US-E6.1** — As Sami, I want an "Estimation" tab showing a map of predicted states for the next 1 hour, so that I can plan ahead.
- **US-E6.2** — As Sami, I want each region's popup to show a confidence level (Low / Medium / High) and the reasoning summary, so that I can judge the estimate.
- **US-E6.3** — As Leila, I want a "methodology" link explaining the algorithm, so that I can audit it.
- **US-E6.4** — As Mehdi, I want a chart comparing past estimates vs actuals (backtesting), so that I can see the algorithm's accuracy.

### 5.7 Epic E7 — Internationalization

- **US-E7.1** — As Khadija, I want the app to default to Arabic with RTL layout, so that I can read it.
- **US-E7.2** — As Sami, I want a language switcher in the header (AR / EN / FR), so that I can switch instantly.
- **US-E7.3** — As Sami, I want my language choice to persist across sessions on this device.
- **US-E7.4** — As Leila, I want the URL to reflect the language (e.g. `/fr/`, `/en/`, `/ar/`), so that I can share a French link with a colleague.
- **US-E7.5** — As a user, I want all dates and numbers to be formatted in my selected locale.

### 5.8 Epic E8 — PWA & Offline

- **US-E8.1** — As Khadija, I want to "Add to home screen" and get an app icon, so that I can launch like a native app.
- **US-E8.2** — As Sami, I want the app to load instantly from cache when I reopen it, even on slow 3G, so that I don't wait.
- **US-E8.3** — As Sami, I want a "you are offline" banner if the network is down, so that I know the data may be stale.

### 5.9 Epic E9 — Accessibility & Performance

- **US-E9.1** — As a user with low vision, I want sufficient color contrast (WCAG AA) and color-blind-safe palette, so that I can read the map.
- **US-E9.2** — As a user on 3G, I want the initial page load under 2 seconds on a mid-range Android, so that I don't abandon.
- **US-E9.3** — As a screen-reader user, I want each region's state to be announced as "Region X: ON, 23 reports", so that I can navigate without sight.

---

## 6. Functional Specifications

### 6.1 Map view (Dashboard / Welcome)

**Region geometry.** Use GeoJSON of Tunisian delegations (source: GADM or OSM administrative boundaries). Each delegation is a polygon; for v1 we may collapse to governorate-level (24 polygons) if delegation-level data is too noisy.

**State colors.**

| State | Hex | Meaning |
|---|---|---|
| ON | `#22c55e` (green-500) | Majority of recent reports say power is on |
| OFF | `#ef4444` (red-500) | Majority of recent reports say power is off |
| NO_DATA | `#6b7280` (gray-500) | No reports in the last 45 minutes |
| CONTESTED | `#f59e0b` (amber-500) | ON and OFF counts within ±1 of each other (only shown in popup, not on polygon) |

**Refresh.** Client polls Supabase view `live_zone_state` every 1 second; only the changed polygons are re-rendered (diff against previous payload).

**Interaction.**

- Click polygon → popup with details (§6.4).
- Hover polygon → tooltip with region name + state.
- Search box → autocomplete against region names (trilingual).
- "Locate me" button → `navigator.geolocation.getCurrentPosition` → snap to nearest region.
- Zoom controls (Leaflet default).
- Base layer toggle: OSM standard / OSM light / satellite (Esri World Imagery, free).

### 6.2 Replay mode

**Entry.** "Replay" button in dashboard header. Reveals a date/time picker (`<input type="datetime-local">`), a slider, and play/pause + speed buttons.

**Behavior.**

- When replay is active, the live poller pauses.
- The slider covers 24 hours around the chosen timestamp (or the entire history range, whichever is smaller).
- Play speed: 1× = real-time, 60× = 1 minute per second, 3600× = 1 hour per second.
- URL becomes `?replay=YYYYMMDDTHHMM` so the moment is shareable.
- A red "REPLAY — 2026-07-15 21:00" badge is always visible.
- Exit replay → resume live polling.

**Data source.** Query `snapshots` table filtered to the chosen minute. If no snapshot exists for that exact minute, use the latest snapshot ≤ chosen time.

### 6.3 Statistics tab

**Date range.** Default: last 7 days. Max: entire stored history. Selector: two `<input type="date">` fields + quick presets (24h, 7d, 30d, 90d, all).

**Charts** (using Chart.js or Apache ECharts, both MIT-licensed, tree-shakeable):

1. **Outage ranking** — horizontal bar chart, X = governorate, Y = total outage minutes in range.
2. **Outage timeline** — line chart, X = time (hourly buckets), Y = number of regions OFF.
3. **Hour-of-week heatmap** — 7 rows (Mon–Sun) × 24 cols (hours), color = % of time OFF.
4. **Top 20 longest outages** — table: region, start, end, duration, peak OFF count.
5. **Region comparison** — multi-line chart, user picks up to 5 regions, X = time, Y = state (0/1).
6. **Data volume chart** — bar chart of daily scrape volume (sanity check on scraper health).

**Export.**

- Per-chart CSV (top-right of each chart).
- "Export full dataset" → zipped CSV of `snapshots` filtered to the selected range. Generated server-side by a Cloudflare Worker (free, but rate-limited to 1 per minute per IP to avoid abuse).

### 6.4 Region popup

```
┌──────────────────────────────────────────────┐
│  Ariana  (أريانة / Ariana)            ⓧ     │
│  ──────────────────────────────────────────  │
│  State:           ⛔ OFF                      │
│  Last updated:    12 seconds ago             │
│  Confidence:      Medium                     │
│  ──────────────────────────────────────────  │
│  Reports (last 45 min):                      │
│    🔌 OFF:  8   (5 scraped, 3 local)         │
│    💡 ON:   3   (2 scraped, 1 local)         │
│  ──────────────────────────────────────────  │
│  Sparkline (last 60 min):                    │
│    ▁▁▂▃▅▆▇▇▆▅▃▂▁▁▂▃▅▆▇▇▆▅▃▂▁                │
│  ──────────────────────────────────────────  │
│  [  🔌 I don't have power  ]                 │
│  [  💡 I have power       ]                  │
│  ──────────────────────────────────────────  │
│  ▸ View history   ▸ Methodology              │
└──────────────────────────────────────────────┘
```

- Trilingual title: AR / FR / EN names.
- "Confidence" computed as: `max(on, off) / (on + off)` → High if ≥ 0.75, Medium if ≥ 0.6, Low otherwise.
- Buttons appear only if the user has not claimed in this region in the last 10 minutes (cooldown).
- "View history" opens a side panel with the last 24h timeline for that region.

### 6.5 Estimation tab

**Map.** Same polygons as dashboard, but colored by predicted state for `now + 1h`.

**Per-region popup.**

- Predicted state (ON / OFF / NO_DATA).
- Confidence (Low / Medium / High).
- Reasoning: short text, e.g. *"Region typically OFF at 21:00 on weekdays (80% of past 14 days) and currently OFF."*
- Link to backtesting results.

**Backtesting panel.** Compares predictions vs actuals for the last 30 days: precision, recall, F1, per-region accuracy heatmap.

### 6.6 Language switching

- Three buttons in the header: `ع | EN | FR`.
- Switching sets `localStorage.lang = 'ar' | 'en' | 'fr'` and re-renders.
- URL prefix: `/ar/`, `/en/`, `/fr/` (using Next.js i18n routing or vanilla `<base>` rewriting in Vite).
- Arabic forces `dir="rtl"` on `<html>`.
- All moment/date formatting uses `Intl.DateTimeFormat(lang, ...)`.

### 6.7 Recent claims feed (transparency)

- A small, scrollable panel accessible from the dashboard footer.
- Shows the last 50 claims globally: timestamp, region (trilingual), value (ON/OFF), source (scraped/local), anonymised device hash (first 8 chars).
- No user-identifying information.

---

## 7. Technical Specifications

### 7.1 Frontend

- **Framework:** React 18 + Vite 5 (fast build, smaller output than Next.js for a static PWA).
  - *Alternative considered:* Next.js static export. Rejected for v1 because the bundle is heavier and GitHub Pages doesn't need SSR. We may revisit if i18n routing becomes painful.
- **Language:** TypeScript 5.x, strict mode.
- **Map:** Leaflet 1.9 + `react-leaflet` 4.x. Tile layer: OSM standard (`tile.openstreetmap.org`) with fair-use attribution; optional Stadia Maps Alidade Smooth for a cleaner look (free tier 250k loads/mo).
- **Charts:** Apache ECharts 5 (more capable than Chart.js for heatmaps and large datasets).
- **i18n:** `react-i18next` + `i18next` + `i18next-browser-languagedetector`.
- **Styling:** Tailwind CSS 3 + `@tailwindcss/typography`. Dark theme by default (matches famma-dhaw aesthetic).
- **State:** Zustand (lightweight, no boilerplate).
- **Data fetching:** TanStack Query (React Query) for caching + auto-refetch.
- **PWA:** `vite-plugin-pwa` for service worker + manifest.
- **Tests:** Vitest + React Testing Library + Playwright for e2e.

### 7.2 Backend (Cloudflare Workers)

- **Runtime:** Cloudflare Workers (V8 isolates, JS/TS).
- **Bundler:** `wrangler` (Cloudflare's CLI).
- **Schedule:** Cron Trigger `* * * * *` (every minute).
- **HTTP client:** `fetch` (native in Workers).
- **DB client:** `@supabase/supabase-js` (works in Workers).
- **Secrets:** Stored as Worker secrets (`wrangler secret put`).

### 7.3 Database (Supabase / Postgres)

- Postgres 15 (Supabase default).
- RLS enabled on every table.
- Anon key only — no service role key in the client.
- Materialised views refreshed by a scheduled Postgres function (`pg_cron`).

### 7.4 Performance budgets

| Metric | Budget |
|---|---|
| Initial HTML | < 30 KB gzipped |
| Initial JS (all chunks) | < 200 KB gzipped |
| Initial CSS | < 30 KB gzipped |
| Time to interactive (3G) | < 3 s |
| Time to interactive (4G) | < 1.5 s |
| Map first paint | < 1 s after JS loads |
| Client poll latency (Supabase round-trip) | < 200 ms p95 |
| Scraper tick latency | < 5 s p95 |

### 7.5 Browser support

- Modern evergreen browsers: Chrome 110+, Firefox 110+, Safari 16+, Samsung Internet 20+.
- No IE11.
- Android Chrome 100+ (covers Khadija's low-end Android).

### 7.6 Repo structure

```
tunisianh/
├── apps/
│   ├── web/                       # Vite React PWA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/             # Dashboard, Stats, Estimates, About
│   │   │   ├── i18n/              # ar.json, en.json, fr.json
│   │   │   ├── lib/               # supabase client, helpers
│   │   │   ├── store/             # Zustand stores
│   │   │   └── main.tsx
│   │   ├── public/                # manifest.json, icons, geojson
│   │   ├── tests/
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── worker/                    # Cloudflare Worker scraper
│       ├── src/
│       │   ├── scrape.ts          # Famma-dhaw fetcher
│       │   ├── transform.ts       # Normalise → our schema
│       │   ├── upsert.ts          # Write to Supabase
│       │   ├── estimate.ts        # Compute estimates every 5 min
│       │   └── index.ts           # Cron entry
│       ├── wrangler.toml
│       └── package.json
├── packages/
│   ├── shared/                    # Shared types, constants
│   │   ├── src/
│   │   │   ├── types.ts           # Snapshot, Claim, Region, Estimate
│   │   │   └── constants.ts       # Governorates, delegations
│   │   └── package.json
│   └── geojson/                   # Tunisia admin boundaries
│       └── tunisia_delegations.geojson
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_rls.sql
│   │   ├── 0003_views.sql
│   │   └── 0004_pg_cron.sql
│   └── seed.sql                   # Static region reference
├── docs/
│   ├── methodology.md
│   ├── privacy.md
│   ├── api.md
│   └── screenshots/
├── .github/
│   └── workflows/
│       ├── deploy-web.yml         # → GitHub Pages
│       ├── deploy-worker.yml      # → Cloudflare Workers
│       └── ci.yml                 # lint + test
├── LICENSE                        # MIT
├── README.md
├── CONTRIBUTING.md
└── package.json                   # pnpm workspace root
```

### 7.7 Package manager

**pnpm** (fast, disk-efficient, supports workspaces). Version pinned via `corepack`.

---

## 8. Data Model

### 8.1 Entity overview (v1.1 — event-sourced)

```
regions (static reference, ~296 rows = famma-dhaw zones)
   │
   ├──< state_events (event-sourced: 1 row per state CHANGE per region)
   │
   ├──< claims (1 row per Kahraba Live user claim)
   │
   ├──< estimates (1 row per region per 5-min estimate tick)
   │
   ├──< daily_stats (1 row per region per day, materialised nightly)
   │
   └──< scrape_runs (audit log: 1 row per scraper invocation)
```

**Why event-sourced, not periodic snapshots:** with ~300 regions, storing a row per region *per second* would be ~25.9 million rows/day — at ~50 bytes/row that's ~1.3 GB/day, blowing through any free-tier DB (typically 500 MB–1 GB total) in hours. Even at one row per region per minute (the actual scrape interval), it's ~430k rows/day = ~22 MB/day, which is sustainable but wasteful when most regions don't change state for hours at a time.

Storing a row **only when a region's state actually changes** — realistically a few state changes per region per day even during an active crisis — keeps the same table at a few hundred to a few thousand rows/day, sustainable indefinitely on a free tier, while still supporting exact-state-at-any-timestamp replay queries (the latest event at or before time T *is* the state at time T).

### 8.2 `regions` table

| Column | Type | Notes |
|---|---|---|
| `slug` | text PK | Stable identifier matching famma-dhaw's zone naming |
| `governorate` | text | e.g. `Ariana` |
| `delegation` | text | e.g. `Ariana` |
| `name_ar` | text | e.g. `أريانة` |
| `name_fr` | text | e.g. `Ariana` |
| `name_en` | text | e.g. `Ariana` |
| `famma_slug` | text | Matching slug in famma-dhaw (nullable until Phase 0 mapping is done) |
| `lat` | numeric | Centroid latitude |
| `lng` | numeric | Centroid longitude |
| `geojson` | jsonb | Polygon for the map |
| `created_at` | timestamptz | default now() |

Seed: ~296 zones (matching famma-dhaw's own zone list, which fluctuates slightly). Source: famma-dhaw zone list + Tunisian administrative boundary datasets (see Appendix D for concrete GitHub repos).

### 8.3 `state_events` table (THE core historical record)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | identity |
| `region_slug` | text FK → regions.slug | |
| `state` | text | `on` / `off` / `mixed` / `unknown` (computed from counts at scrape time) |
| `on_count_scraped` | int | from famma-dhaw at this moment |
| `off_count_scraped` | int | from famma-dhaw at this moment |
| `on_count_local` | int | from Kahraba Live claims (rolling 45-min window) at this moment |
| `off_count_local` | int | from Kahraba Live claims (rolling 45-min window) at this moment |
| `source` | text | `scraped` (state changed during a scrape) / `claim_aggregate` (state changed because of a user claim tipping the balance) |
| `confidence` | numeric | 0..1 (computed from count agreement) |
| `scrape_run_id` | bigint FK → scrape_runs.id | nullable; null for claim-triggered events |
| `changed_at` | timestamptz | when the change was detected (default now()) |

**Partitioning.** Partition by month (`PARTITION BY RANGE (changed_at)`). Keeps individual indexes small.

**Indexes.**
- `(region_slug, changed_at DESC)` — main query path (latest event per region).
- `(changed_at DESC)` — for replay "all regions at time T".
- `(state, changed_at DESC)` — for stats.

**Retention.**
- Raw `state_events`: keep **indefinitely** — they are tiny (a few thousand rows/day) and are the source of truth for replay & stats.
- After 5 years, archive to cold storage (CSV on archive.org, or Backblaze B2 free tier).

### 8.4 `scrape_runs` table (audit log)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `started_at` | timestamptz | when the scraper invocation began |
| `finished_at` | timestamptz | nullable; null if still running or crashed |
| `status` | text | `ok` / `partial` / `failed` |
| `regions_fetched` | int | how many zones famma-dhaw returned |
| `regions_changed` | int | how many state_events rows were inserted |
| `latency_ms` | int | end-to-end scrape duration |
| `error_detail` | text | nullable; short error message on failure |

Used for: monitoring (alert if `regions_fetched` drops to 0, or `status='failed'` for 3 consecutive runs),"data may be stale" banner in the UI (if no successful run in last 5 minutes).

### 8.5 `daily_stats` table (materialised nightly)

| Column | Type | Notes |
|---|---|---|
| `region_slug` | text FK | |
| `day` | date | Local time (Africa/Tunis) |
| `total_off_minutes` | int | Sum of minutes where state = off (interpolated from state_events) |
| `total_on_minutes` | int | |
| `total_unknown_minutes` | int | Gaps where no event exists for that period |
| `longest_off_streak_min` | int | Longest continuous OFF period |
| `peak_off_count` | int | Max simultaneous OFF reports (from state_events.off_count_*) |
| `outage_count` | int | Number of distinct on→off transitions |
| `first_off_ts` | timestamptz | First OFF of the day |
| `last_off_ts` | timestamptz | Last OFF of the day |
| `claims_submitted` | int | Total Kahraba Live claims for this region on this day |
| `agreement_rate` | numeric | 0..1 — fraction of times scraped state agreed with claim-aggregate state |
| `computed_at` | timestamptz | when this row was materialised |

Refreshed nightly by `pg_cron` at 02:00 Africa/Tunis.

### 8.6 `claims` table

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `region_slug` | text FK | |
| `ts` | timestamptz | default now() |
| `value` | text | `on` / `off` |
| `device_hash` | text | SHA-256 of deviceId + salt, truncated to 16 chars |
| `ip_hash` | text | SHA-256 of IP + salt, truncated to 16 chars (transient, for rate-limiting) |
| `user_agent_hash` | text | optional, for spam analysis |

**RLS.** Anyone can INSERT (anonymous claims). Anyone can SELECT (transparency). No UPDATE / DELETE from the client.

**Anti-spam.**
- DB-level constraint: one claim per `(device_hash, region_slug)` per cooldown window (15–30 min, configurable; see §6.5). Implemented as a trigger that rejects inserts within the window.
- Supabase rate-limit on the INSERT endpoint (e.g. max 10 claims/min/IP).
- IP-hash-based rate limit at the Cloudflare Worker level (if claims are proxied through a worker — in v1 they go directly to Supabase).

### 8.7 `estimates` table

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `region_slug` | text FK | |
| `generated_at` | timestamptz | when the estimate was computed |
| `target_ts` | timestamptz | the future time being estimated |
| `horizon` | text | `1h` / `3h` / `6h` / `12h` / `24h` |
| `predicted_state` | text | `on` / `off` / `unknown` |
| `probability` | numeric | 0..1 |
| `method` | text | algorithm version, e.g. `v1-historical-baseline` or `v2-heat-weighted` |
| `reasoning` | jsonb | structured: `{ factors: [...], weights: {...}, temperature_c: ... }` |
| `actual_state` | text | filled in later for backtesting (nullable) |

### 8.8 Views

#### `live_zone_state` (the dashboard's primary read)

For each region, return the **latest** state_event row plus a snapshot of recent claims:

```sql
CREATE VIEW live_zone_state AS
SELECT
  r.slug,
  r.governorate,
  r.delegation,
  r.name_ar, r.name_fr, r.name_en,
  r.lat, r.lng,
  e.state,
  e.on_count_scraped  + COALESCE(c.on_count_local, 0)  AS on_count_total,
  e.off_count_scraped + COALESCE(c.off_count_local, 0) AS off_count_total,
  e.on_count_scraped  AS on_count_scraped,
  e.off_count_scraped AS off_count_scraped,
  COALESCE(c.on_count_local, 0)  AS on_count_local,
  COALESCE(c.off_count_local, 0) AS off_count_local,
  e.confidence,
  e.changed_at AS last_update_ts
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
  FROM claims
  WHERE region_slug = r.slug AND ts > now() - interval '45 minutes'
) c ON true;
```

#### `region_state_at(time_t)` (for replay)

```sql
CREATE OR REPLACE FUNCTION region_state_at(t timestamptz)
RETURNS TABLE (
  region_slug text, state text,
  on_count_scraped int, off_count_scraped int,
  on_count_local int, off_count_local int,
  changed_at timestamptz
)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (region_slug)
    region_slug, state,
    on_count_scraped, off_count_scraped,
    on_count_local, off_count_local,
    changed_at
  FROM state_events
  WHERE changed_at <= t
  ORDER BY region_slug, changed_at DESC;
$$;
```

This is the magic of event sourcing: reconstructing the entire national state at any past timestamp is a single indexed query, not a scan of a giant per-second snapshot table.

### 8.9 Storage sizing (event-sourced — DRAMATICALLY smaller than v1.0)

| Table | Rows/day | Row size | Daily growth | 1-year total |
|---|---|---|---|---|
| `state_events` | ~500–3,000 (depends on crisis intensity) | ~120 B | ~50–360 KB | ~18–130 MB |
| `claims` | ~5,000 (assumed) | ~120 B | ~600 KB | ~220 MB |
| `estimates` | ~3,000 (300 regions × ~10 horizon ticks/day, downsampled) | ~200 B | ~600 KB | ~220 MB |
| `daily_stats` | ~300 | ~120 B | ~36 KB | ~13 MB |
| `scrape_runs` | 1,440 (1/min) | ~80 B | ~115 KB | ~42 MB |

**Total steady-state after 1 year: ~500 MB.** This fits comfortably in Supabase's 500 MB free tier for the first ~6–12 months, and indefinitely in Neon's 0.5 GB free tier with periodic archival. Compare to v1.0's snapshot approach which would have hit 500 MB in ~15 days.

**No downsampling needed** for `state_events` (the table is intrinsically small). Only `estimates` may be downsampled after 30 days to hourly granularity if it grows large.

### 8.10 Migration from v1.0 snapshot model

If the project had shipped v1.0's `snapshots` table and accumulated data before upgrading to v1.1:
1. Backfill `state_events` from `snapshots` by iterating in chronological order and INSERTing only when `(on_count, off_count, state)` changes between consecutive rows for the same region.
2. Drop the `snapshots` table after backfill is verified.
3. Update all view definitions to use `state_events` instead.

For a greenfield project (which this is), skip this migration step.

---

## 9. Scraping Strategy

### 9.1 Source analysis

famma-dhaw.com exposes (via Supabase public anon key, visible in their page source):

| Endpoint | Table | Public read? | Used by us? |
|---|---|---|---|
| `https://njfulpklvqezflxiozhn.supabase.co/rest/v1/zone_board` | View | Yes | Yes — main scrape target |
| `https://njfulpklvqezflxiozhn.supabase.co/rest/v1/reports` | Table | Probably yes (inserts allowed publicly; reads likely restricted) | No |
| `https://njfulpklvqezflxiozhn.supabase.co/rest/v1/zone_suggestions` | Table | Inserts only | No |
| `https://njfulpklvqezflxiozhn.supabase.co/rest/v1/platform_stats` | Table | Yes | Yes — for grand total counter |

The `zone_board` view returns one row per zone with columns:

- `slug` (text)
- `name` (text)
- `gov` (text — governorate)
- `off_count` (int — reports of "no power" in last 45 min)
- `on_count` (int)
- `last_report` (timestamptz)

This is **exactly** what we need. We do not need to parse HTML.

### 9.2 Worker schedule

Cloudflare Workers free-tier Cron Triggers support these intervals: `* * * * *` (1 min), `*/5 * * * *` (5 min), `0 * * * *` (1 hour), etc. The minimum is **1 minute**.

```toml
# wrangler.toml
[triggers]
crons = ["* * * * *"]
```

**Worker pseudo-code:**

```typescript
export default {
  async scheduled(event, env, ctx) {
    const fetched = await fetchFammaDhaw(env);
    const transformed = transformToOurSchema(fetched);   // align to regions
    await upsertSnapshots(env, transformed);
    // Every 5 minutes, also compute estimates
    if (event.cron === "* * * * *" && new Date().getMinutes() % 5 === 0) {
      await computeEstimates(env);
    }
  }
};
```

### 9.3 User-perceived "1-second" refresh

The client (PWA) polls `live_zone_state` view every 1 second using Supabase's REST API. The underlying data is at most 60 seconds old (the worker's tick interval), but the UI feels live because:

- Polling is invisible (no spinner).
- The "last updated Xs ago" indicator updates every second.
- User claims appear instantly on the map (the claim inserts directly into Supabase, and the next 1-second poll picks it up).

### 9.4 Downsampling jobs

A second worker runs every hour (`0 * * * *`) to downsample old data:

```typescript
async function downsampleSnapshots(env) {
  // 1. After 7 days: downsample to 5-min granularity for snapshots older than 7 days
  await env.db.rpc('downsnapshots', { granularity: '5min', older_than: '7 days' });
  // 2. After 30 days: downsample to 1-hour granularity
  await env.db.rpc('downsnapshots', { granularity: '1hour', older_than: '30 days' });
  // 3. After 90 days: drop raw snapshots
  await env.db.rpc('dropsnapshots', { older_than: '90 days' });
}
```

Postgres function `downsnapshots(granularity, older_than)` uses `time_bucket` (or `date_trunc`) and `DISTINCT ON` to keep one representative row per bucket.

### 9.5 Resilience

- **Retries.** Worker uses `fetch` with a 10-second timeout; on failure, logs to `scraper_errors` table.
- **Backoff.** If famma-dhaw returns 429 (rate limited), the worker skips this tick and logs.
- **Health check.** A `health` table records each worker tick (`tick_at`, `status`, `rows_fetched`, `rows_upserted`, `latency_ms`).
- **Public status page.** A `/status` route on the PWA reads the last 24h of `health` and shows a green/yellow/red indicator.

### 9.6 Legal & ethical scraping

- We respect famma-dhaw.com's data license (CC BY 4.0 assumed; verify with maintainer).
- We attribute clearly in the footer: *"Live data sourced from famma-dhaw.com (CC BY 4.0)"*.
- We never impersonate a browser (no fake user agent); we use the public Supabase REST API.
- Our scraper makes 1 request/minute — negligible load.
- If famma-dhaw maintainer requests we throttle, we comply within 48 hours.

---

## 10. Estimation Algorithm

### 10.1 Goals

- Predict each region's state for `now + 1h`, `now + 2h`, `now + 3h`.
- Be **explainable** — every prediction must include a human-readable reason.
- Be **auditable** — every prediction is stored with method version and inputs, so we can backtest.
- Be **conservative** — never claim > 80% confidence; always show "NO_DATA" when evidence is weak.

### 10.2 v1 Algorithm — Historical Baseline + Trend

**Idea.** For each region, build a "typical week" profile from history, then blend it with the recent trend.

**Steps.**

1. **Historical baseline.** For region `r`, look at the last 8 weeks of snapshots. For each `(day_of_week, hour)` pair, compute:
   - `p_off(r, dow, hour)` = fraction of snapshots in that bucket where state = `off`.
   - `n(r, dow, hour)` = number of snapshots in that bucket (for confidence weighting).

2. **Current state.** Take the latest snapshot `s_now(r)`.

3. **Recent trend.** Look at the last 60 minutes of snapshots. Compute:
   - `trend(r)` = +1 if state flipped from `on` to `off` recently; -1 if `off` to `on`; 0 otherwise.

4. **Blend.** Predicted probability of OFF at `now + h` hours:
   ```
   p_off_pred(r, h) =
       w_hist * p_off(r, dow(now+h), hour(now+h))
     + w_now  * (s_now(r) == 'off' ? 1 : 0)
     + w_trend * trend(r)
   ```
   Weights v1: `w_hist = 0.6, w_now = 0.3, w_trend = 0.1`.

5. **Decision.**
   - If `p_off_pred >= 0.65` → predict `off`, confidence = `p_off_pred`.
   - If `p_off_pred <= 0.35` → predict `on`, confidence = `1 - p_off_pred`.
   - Else → predict `no_data`, confidence = `0.5`.
   - If `n(r, dow, hour) < 10` → cap confidence at 0.4 (insufficient history).

6. **Reasoning.** Generate text:
   - If baseline dominates: *"Region is typically OFF at HH:00 on DayName (X% of past N weeks)."*
   - If current dominates: *"Region is currently OFF and the pattern is stable."*
   - If trend dominates: *"Region just flipped to OFF; trend likely to continue."*

### 10.3 Backtesting

For every estimate generated, when the target time arrives we set `actual_state` (computed from snapshots). Nightly job computes:

- Precision, recall, F1 per region.
- Confusion matrix overall.
- Calibration: of all predictions at confidence 0.7, what fraction were correct?

These metrics are shown on the Estimation tab in the backtesting panel.

### 10.4 Algorithm evolution

- **v1** (described above) — historical baseline + trend.
- **v2** (future) — add STEG published schedules as a feature.
- **v3** (future) — add weather (heat is correlated with outages).
- **v4** (future) — small gradient-boosted model (XGBoost) per region.

v1 is intentionally simple and explainable. We will not move to v2+ until v1's backtesting shows ≥ 70% F1.

---

## 11. Internationalization (i18n)

### 11.1 Languages

| Code | Name | Direction | Default? |
|---|---|---|---|
| `ar` | العربية | RTL | Yes (Tunisia's official language) |
| `fr` | Français | LTR | No |
| `en` | English | LTR | No |

### 11.2 Strategy

- Use `i18next` + `react-i18next`.
- Bundle dictionaries as JSON in the app (no lazy loading — total size < 50 KB).
- Language detection order: URL path (`/ar/`, `/fr/`, `/en/`) → `localStorage.lang` → `navigator.language` → default `ar`.
- Persist choice in `localStorage.lang`.
- Switching language updates the URL (so links are shareable).

### 11.3 Translation dictionary structure

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "statistics": "Statistics",
    "estimation": "Estimation",
    "about": "About"
  },
  "map": {
    "state_on": "ON",
    "state_off": "OFF",
    "state_no_data": "No data",
    "last_updated_seconds_ago": "Updated {{count}}s ago",
    "search_placeholder": "Search your region…",
    "locate_me": "Locate me"
  },
  "popup": {
    "confidence_high": "High",
    "confidence_medium": "Medium",
    "confidence_low": "Low",
    "reports_last_45_min": "Reports (last 45 min)",
    "claim_on": "I have power",
    "claim_off": "I don't have power",
    "view_history": "View history",
    "methodology": "Methodology"
  },
  "stats": { ... },
  "estimation": { ... },
  "about": { ... }
}
```

Each language file (`ar.json`, `en.json`, `fr.json`) mirrors this structure.

### 11.4 RTL handling

- When `lang === 'ar'`, set `<html dir="rtl" lang="ar">`.
- Tailwind: use `ms-*` / `me-*` (margin-inline-start/end) instead of `ml-*` / `mr-*` for direction-aware spacing.
- Leaflet: works in RTL but map controls appear on the right; this is fine.
- Charts (ECharts): use `rtl: true` option per chart.

### 11.5 Number & date formatting

Always use `Intl`:

```typescript
new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
new Intl.NumberFormat(lang).format(n);
```

### 11.6 Region names

Each region has `name_ar`, `name_fr`, `name_en` in the `regions` table. The displayed name follows the current language.

### 11.7 Translation maintenance

- English is the source language (maintainer writes new strings in English first).
- French and Arabic translations maintained by the maintainer (fluent) + community PRs.
- A `scripts/check-i18n.mjs` CI script fails the build if any language is missing keys present in English.

---

## 12. UI/UX Design

### 12.1 Design principles

1. **Mobile-first.** Designed for Khadija's low-end Android on 3G, then enhanced for desktop.
2. **Glanceable.** A user should know their region's state in < 2 seconds.
3. **Honest.** Never hide uncertainty. Always show counts, sources, last-updated time.
4. **Calm.** No animations beyond what conveys information. No auto-playing videos. No banners.
5. **Trilingual-equal.** No language is second-class; Arabic layout is not a mirrored afterthought.

### 12.2 Color palette

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0b0e11` | App background (dark theme) |
| `bg-card` | `#161b22` | Cards, popups |
| `bg-card-elevated` | `#1d242e` | Hovered cards |
| `border` | `#2a323d` | Borders, dividers |
| `text-primary` | `#e8eaed` | Body text |
| `text-muted` | `#9aa0a6` | Secondary text |
| `accent-amber` | `#fbbf24` | Brand, highlights |
| `state-on` | `#22c55e` | ON |
| `state-off` | `#ef4444` | OFF |
| `state-no-data` | `#6b7280` | No data |
| `state-contested` | `#f59e0b` | Contested (popup only) |

### 12.3 Typography

- **Arabic:** "Noto Sans Arabic" (Google Fonts, OFL).
- **Latin (EN/FR):** "Inter" (Google Fonts, OFL).
- **Monospace (stats tables):** "JetBrains Mono" (OFL).
- Body size: 16px. Headings scale via Tailwind defaults.
- All fonts loaded via `@fontsource` (self-hosted) to avoid Google Fonts privacy concerns.

### 12.4 Layout (mobile)

```
┌────────────────────────────┐
│ ⚡ TunisianH     [ع][EN][FR]│  ← sticky header
├────────────────────────────┤
│ [Dashboard][Stats][Estimate]│ ← tab bar
├────────────────────────────┤
│ Updated 3s ago · 12 zones  │ ← summary bar
│ OFF · 87 reports (45 min)  │
├────────────────────────────┤
│ 🔍 Search your region…     │
├────────────────────────────┤
│                            │
│   [ Leaflet map of Tunisia │
│     with colored polygons ]│
│                            │
│                            │
├────────────────────────────┤
│ Live data: famma-dhaw.com  │ ← footer
│ Methodology · Privacy      │
└────────────────────────────┘
```

### 12.5 Layout (desktop)

- Same as mobile, but the map occupies the full viewport with a left sidebar (collapsible) containing search, summary, and recent claims feed.

### 12.6 Components inventory

| Component | Where used | Notes |
|---|---|---|
| `Header` | all pages | brand + language switcher |
| `TabBar` | all pages | Dashboard / Stats / Estimation / About |
| `SummaryBar` | dashboard | "X zones OFF · updated Ys ago" |
| `SearchBox` | dashboard | trilingual autocomplete |
| `MapView` | dashboard, estimation | Leaflet wrapper |
| `RegionPopup` | dashboard, estimation | details + claim buttons |
| `ReplayBar` | dashboard (when replaying) | date/time + slider + play |
| `StatsCharts` | stats | ECharts wrappers |
| `EstimateMap` | estimation | same MapView, different colors |
| `BacktestingPanel` | estimation | precision/recall display |
| `RecentClaimsFeed` | dashboard (collapsible) | last 50 claims |
| `MethodologyModal` | everywhere (footer link) | explains algorithm |
| `OfflineBanner` | all pages | shows when no network |
| `Toast` | all pages | ephemeral feedback |

### 12.7 Accessibility

- WCAG 2.1 AA target.
- All interactive elements keyboard-navigable.
- Color contrast ≥ 4.5:1 for text, ≥ 3:1 for large text.
- Map polygons have `aria-label` (read by screen readers).
- Charts have alternative text summaries (`<desc>` in SVG).
- Live regions (`aria-live="polite"`) for state changes on the focused region.

---

## 13. Development Phases / Roadmap

Five phases, each ending in a deployable milestone. Total estimated effort: **6–8 weekends** for a solo maintainer, or **3–4 weeks** for a 2-person team working full-time.

### Phase 0 — Foundations (1 weekend)

**Goal:** empty skeletons committed and deployable.

- GitHub repo created (`tunisianh/tunisianh`), public.
- README, LICENSE (MIT), CONTRIBUTING, code of conduct.
- pnpm workspace scaffolded (`apps/web`, `apps/worker`, `packages/shared`).
- Vite + React + TS app boots on `localhost:5173`.
- Cloudflare Worker boots locally via `wrangler dev`.
- Supabase project created (`tunisianh`), migrations folder initialised.
- GitHub Actions CI runs `pnpm install && pnpm lint && pnpm test` on every PR.
- **Milestone P0:** `https://tunisianh.github.io/tunisianh/` shows a "Hello TunisianH" page in 3 languages.

### Phase 1 — Live Map MVP (2 weekends)

**Goal:** a trilingual dashboard showing live scraped data on a static OSM map.

- Migrations `0001_init`, `0002_rls`, `0003_views` applied.
- `regions` seeded (24 governorates first, delegations if time permits).
- Worker scrapes famma-dhaw `zone_board` every minute → writes to `snapshots`.
- Client polls `live_zone_state` every 1 second → renders colored polygons on Leaflet.
- Header + language switcher + summary bar + search box + region popup (without claim buttons yet).
- PWA manifest + service worker (offline shell).
- **Milestone P1:** a user can see live outage states on a map, in 3 languages, on mobile and desktop.

### Phase 2 — User Claims + Transparency (1 weekend)

**Goal:** users can contribute their own reports; transparency layer visible.

- `claims` table + RLS + anti-spam trigger.
- Region popup gets "I have power" / "I don't have power" buttons.
- Cooldown enforced (10 min per region per device).
- `live_zone_state` view extended to merge scraped + local counts.
- Recent claims feed (collapsible panel) on dashboard.
- Per-popup sparkline (last 60 min).
- "Methodology" modal drafted.
- **Milestone P2:** users can claim; counts visibly reflect their input within 1 second.

### Phase 3 — Replay + Statistics (2 weekends)

**Goal:** historical exploration; CSV exports.

- Replay bar (date/time picker, slider, play/pause, speed).
- `region_history` view queried for replay.
- URL `?replay=...` deep-linking.
- Statistics tab with 6 charts (ECharts).
- Per-chart CSV export.
- Full dataset export via Cloudflare Worker (rate-limited).
- `daily_stats` materialised nightly via `pg_cron`.
- **Milestone P3:** a journalist can replay any past moment and export CSVs.

### Phase 4 — Estimation (1 weekend)

**Goal:** algorithmic estimates with backtesting.

- `estimates` table + worker job every 5 min.
- v1 algorithm (§10.2) implemented in `apps/worker/src/estimate.ts`.
- Estimation tab UI: predicted-state map + per-region popup with reasoning.
- Backtesting panel: nightly job fills `actual_state`; UI shows precision/recall.
- Methodology modal updated with algorithm details.
- **Milestone P4:** users can see predictions for the next 3 hours, with confidence levels and backtesting metrics.

### Phase 5 — Polish & Launch (1 weekend)

**Goal:** production-ready, accessible, documented.

- Accessibility audit (axe-core), fix all critical issues.
- Lighthouse pass: ≥ 90 on all 4 metrics (mobile).
- Performance budgets enforced in CI (bundle size check).
- Documentation finalized: README, methodology page, privacy page, API docs.
- Press kit: 3 screenshots per language, 30-second demo video.
- Announcement: post on Tunisian tech communities (Facebook group "Tunisian Developers", r/Tunisia, Twitter/X).
- **Milestone P5:** public launch.

### Phase 6+ — Future (post-launch)

- v2 estimation (STEG schedules).
- Web Push notifications ("notify me when my region goes OFF").
- Sub-delegation granularity.
- Native mobile apps (React Native or Flutter).
- Docker image of the worker for self-hosting.
- Annual data dumps published on archive.org.

---

## 14. Task Breakdown

Tasks are grouped by phase. Each task has an ID (`T-<phase>.<seq>`), a description, an estimate (in ideal hours), and a dependency list.

### 14.1 Phase 0 — Foundations

| ID | Task | Est. | Deps |
|---|---|---|---|
| T-0.1 | Create GitHub repo `tunisianh/tunisianh`, add README + LICENSE + CONTRIBUTING + CoC | 0.5 | — |
| T-0.2 | Set up pnpm workspace with three packages (`web`, `worker`, `shared`) | 1 | T-0.1 |
| T-0.3 | Scaffold Vite + React + TS app with Tailwind, ESLint, Prettier | 1.5 | T-0.2 |
| T-0.4 | Scaffold Cloudflare Worker with `wrangler.toml`, TS config | 0.5 | T-0.2 |
| T-0.5 | Create Supabase project, save project URL + anon key in `.env.example` | 0.5 | T-0.1 |
| T-0.6 | Write migration `0001_init.sql` (regions, snapshots, claims, estimates, daily_stats, health) | 2 | T-0.5 |
| T-0.7 | Write migration `0002_rls.sql` (RLS policies for every table) | 1.5 | T-0.6 |
| T-0.8 | Write migration `0003_views.sql` (`live_zone_state`, `region_history`) | 1 | T-0.6 |
| T-0.9 | CI workflow: lint + typecheck + test on every PR | 1 | T-0.3, T-0.4 |
| T-0.10 | GitHub Pages deploy workflow (build + upload artifact + deploy) | 1 | T-0.3 |
| T-0.11 | Cloudflare Worker deploy workflow | 0.5 | T-0.4 |
| T-0.12 | "Hello TunisianH" trilingual landing page deployed to GH Pages | 1 | T-0.10 |

**Phase 0 total: ~11 hours.**

### 14.2 Phase 1 — Live Map MVP

| ID | Task | Est. | Deps |
|---|---|---|---|
| T-1.1 | Build `packages/geojson/tunisia_delegations.geojson` from GADM, simplify to governorate-level for v1 | 2 | T-0.6 |
| T-1.2 | Seed `regions` table (24 governorates, trilingual names, centroid lat/lng, geojson polygon) | 1.5 | T-1.1 |
| T-1.3 | Map famma-dhaw zone slugs to our `regions.famma_slug` (manual cross-reference) | 2 | T-1.2 |
| T-1.4 | Implement `apps/worker/src/scrape.ts` (fetch `zone_board`, normalise) | 2 | T-1.3 |
| T-1.5 | Implement `apps/worker/src/transform.ts` (famma schema → our snapshots schema) | 1 | T-1.4 |
| T-1.6 | Implement `apps/worker/src/upsert.ts` (bulk insert into `snapshots`) | 1 | T-1.5 |
| T-1.7 | Wire Cloudflare Cron Trigger `* * * * *` to call `scheduled()` | 0.5 | T-1.6 |
| T-1.8 | Add `health` table writes after each tick (status, latency, row counts) | 0.5 | T-1.6 |
| T-1.9 | Frontend: Supabase client wrapper in `apps/web/src/lib/supabase.ts` | 0.5 | T-0.7 |
| T-1.10 | Frontend: TanStack Query hook `useLiveZoneState` polling every 1s | 1.5 | T-1.9 |
| T-1.11 | Frontend: Leaflet MapView with GeoJSON polygons, colored by state | 3 | T-1.1, T-1.10 |
| T-1.12 | Frontend: Header + language switcher (AR/EN/FR) | 1.5 | T-0.3 |
| T-1.13 | Frontend: i18n setup with `react-i18next`, AR/EN/FR dictionaries stubbed | 1.5 | T-0.3 |
| T-1.14 | Frontend: SummaryBar (X zones OFF, Y reports, last-updated ago) | 1 | T-1.10 |
| T-1.15 | Frontend: SearchBox with trilingual autocomplete | 1.5 | T-1.2 |
| T-1.16 | Frontend: RegionPopup (name, state, counts, last-updated) | 2 | T-1.11 |
| T-1.17 | Frontend: LocateMe button (`navigator.geolocation`) | 0.5 | T-1.11 |
| T-1.18 | Frontend: PWA manifest + icons (192, 512, maskable) | 1 | T-0.3 |
| T-1.19 | Frontend: Service worker via `vite-plugin-pwa` (precache app shell) | 1 | T-1.18 |
| T-1.20 | Frontend: OfflineBanner (show when `navigator.onLine === false`) | 0.5 | T-1.19 |
| T-1.21 | E2E test: open dashboard, see map, switch language, search a region | 1.5 | T-1.16 |
| T-1.22 | Deploy Phase 1 to production | 0.5 | all above |

**Phase 1 total: ~28 hours.**

### 14.3 Phase 2 — User Claims + Transparency

| ID | Task | Est. | Deps |
|---|---|---|---|
| T-2.1 | Add `claims` RLS policy: anon INSERT + SELECT, no UPDATE/DELETE | 0.5 | T-0.7 |
| T-2.2 | Postgres trigger: reject claim if same `device_hash` + `region_slug` within 10 min | 1.5 | T-2.1 |
| T-2.3 | Update `live_zone_state` view to merge local claims (last 45 min) | 1 | T-2.1 |
| T-2.4 | Frontend: deviceId generator (matching famma-dhaw pattern) | 0.5 | T-1.9 |
| T-2.5 | Frontend: claim buttons in RegionPopup | 1 | T-1.16, T-2.4 |
| T-2.6 | Frontend: cooldown display ("Already reported · retry in M:SS") | 1 | T-2.5 |
| T-2.7 | Frontend: Toast component for "Thank you" feedback | 0.5 | T-2.5 |
| T-2.8 | Frontend: per-region sparkline (last 60 min, ECharts mini) | 1.5 | T-1.10 |
| T-2.9 | Frontend: RecentClaimsFeed component (last 50 claims) | 1.5 | T-2.1 |
| T-2.10 | Frontend: source breakdown in popup (scraped vs local) | 0.5 | T-2.3 |
| T-2.11 | Frontend: MethodologyModal draft (content + i18n) | 1.5 | T-1.13 |
| T-2.12 | E2E test: submit claim → see it in feed → cooldown enforced | 1.5 | T-2.5, T-2.9 |

**Phase 2 total: ~12 hours.**

### 14.4 Phase 3 — Replay + Statistics

| ID | Task | Est. | Deps |
|---|---|---|---|
| T-3.1 | Frontend: ReplayBar component (date/time picker + slider + play/pause + speed) | 4 | T-1.11 |
| T-3.2 | Frontend: pause live poller during replay, query `region_history` view | 1.5 | T-3.1 |
| T-3.3 | Frontend: URL `?replay=YYYYMMDDTHHMM` parsing and updating | 1 | T-3.1 |
| T-3.4 | Frontend: red "REPLAY" badge visible while replaying | 0.5 | T-3.1 |
| T-3.5 | Frontend: Stats page scaffold with date-range selector + presets | 1.5 | T-1.12 |
| T-3.6 | Stats chart 1: outage ranking (horizontal bar) | 1.5 | T-3.5 |
| T-3.7 | Stats chart 2: outage timeline (line) | 1.5 | T-3.5 |
| T-3.8 | Stats chart 3: hour-of-week heatmap | 2 | T-3.5 |
| T-3.9 | Stats chart 4: top 20 longest outages (table) | 1.5 | T-3.5 |
| T-3.10 | Stats chart 5: region comparison (multi-line) | 2 | T-3.5 |
| T-3.11 | Stats chart 6: data volume (sanity check) | 0.5 | T-3.5 |
| T-3.12 | Per-chart CSV export button | 1 | T-3.6 |
| T-3.13 | Cloudflare Worker route `/api/export?from=…&to=…` returning zipped CSV (rate-limited 1/min) | 2 | T-0.4 |
| T-3.14 | Migration `0004_pg_cron.sql` to enable pg_cron | 0.5 | T-0.6 |
| T-3.15 | pg_cron job: refresh `daily_stats` nightly at 02:00 Africa/Tunis | 1 | T-3.14 |
| T-3.16 | Frontend: "Download full dataset" button (calls `/api/export`) | 0.5 | T-3.13 |
| T-3.17 | E2E test: enter replay mode, scrub to past moment, exit | 1.5 | T-3.1 |
| T-3.18 | E2E test: open stats page, change date range, export CSV | 1.5 | T-3.12 |

**Phase 3 total: ~26 hours.**

### 14.5 Phase 4 — Estimation

| ID | Task | Est. | Deps |
|---|---|---|---|
| T-4.1 | Implement v1 algorithm in `apps/worker/src/estimate.ts` | 4 | T-1.6 |
| T-4.2 | Schedule estimate job inside the 5-min branch of `scheduled()` | 0.5 | T-4.1 |
| T-4.3 | Reasoning text generator (trilingual) | 2 | T-4.1 |
| T-4.4 | Frontend: Estimation page scaffold + map of predicted state (now+1h) | 3 | T-1.11 |
| T-4.5 | Frontend: EstimatePopup with confidence + reasoning | 1.5 | T-4.4 |
| T-4.6 | Frontend: time selector (+1h, +2h, +3h) | 1 | T-4.4 |
| T-4.7 | Nightly job: backfill `actual_state` for estimates whose `target_ts` has passed | 1.5 | T-4.1 |
| T-4.8 | Nightly job: compute precision/recall/F1, write to `estimation_metrics` table | 2 | T-4.7 |
| T-4.9 | Frontend: BacktestingPanel showing overall metrics + per-region accuracy heatmap | 2 | T-4.8 |
| T-4.10 | MethodologyModal updated with algorithm explanation (trilingual) | 1.5 | T-2.11 |
| T-4.11 | E2E test: open estimation page, see predictions, check reasoning | 1 | T-4.5 |

**Phase 4 total: ~20 hours.**

### 14.6 Phase 5 — Polish & Launch

| ID | Task | Est. | Deps |
|---|---|---|---|
| T-5.1 | axe-core accessibility audit, fix critical issues | 3 | all |
| T-5.2 | Lighthouse mobile audit, fix performance regressions | 2 | all |
| T-5.3 | Bundle size budget in CI (`size-limit` action) | 0.5 | T-0.9 |
| T-5.4 | Finalize README (trilingual, with screenshots) | 2 | all |
| T-5.5 | Write `docs/methodology.md` (data sources, algorithm, limitations) | 2 | T-4.10 |
| T-5.6 | Write `docs/privacy.md` (what we store, what we don't) | 1 | T-2.4 |
| T-5.7 | Write `docs/api.md` (public endpoints, schema) | 1.5 | T-3.13 |
| T-5.8 | Press kit: 9 screenshots (3 languages × 3 screens) | 1.5 | all |
| T-5.9 | 30-second demo video (Arabic voiceover, EN/FR subtitles) | 2 | all |
| T-5.10 | Launch announcement: Twitter/X, r/Tunisia, Tunisian Developers FB | 1 | T-5.4 |
| T-5.11 | Set up uptime monitoring (UptimeRobot free) for GitHub Pages + Worker + Supabase | 0.5 | all |
| T-5.12 | Set up Sentry for frontend error tracking (free tier) | 0.5 | T-1.9 |

**Phase 5 total: ~18 hours.**

### 14.7 Total estimate

| Phase | Hours | Weekends (solo) |
|---|---|---|
| 0 | 11 | 1 |
| 1 | 28 | 2 |
| 2 | 12 | 1 |
| 3 | 26 | 2 |
| 4 | 20 | 1.5 |
| 5 | 18 | 1.5 |
| **Total** | **115** | **~9 weekends** |

Buffer 30% for unexpected issues → realistic total **~150 hours / ~10–12 weekends solo**.

---

## 15. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | famma-dhaw.com changes their Supabase schema or revokes public anon key | Medium | High (data source disappears) | Detect via `health` table; alert maintainer; fall back to HTML scraping within 48h; long-term: negotiate data-sharing agreement with famma-dhaw maintainer |
| R-2 | famma-dhaw maintainer asks us to stop scraping | Low | High | Comply within 48h; pivot to STEG-only or self-collected claims |
| R-3 | Supabase free-tier 500 MB exceeded | Medium | High | Downsampling jobs (§9.4) prevent this; alert at 80% usage |
| R-4 | Cloudflare Workers 100k req/day exceeded | Low | Medium | We use ~86k/day for scraper + ~5k/day for export → tight. Monitor via Cloudflare dashboard; if hit, switch to 5-min scraper interval (28k/day) |
| R-5 | GitHub Pages 100 GB/mo bandwidth exceeded | Low | Medium | Monitor; if hit, move assets to Cloudflare R2 + CDN |
| R-6 | OSM tile servers ban us for high traffic | Medium | Medium | Use Stadia Maps free tier (250k loads/mo) as primary; OSM as fallback |
| R-7 | Claim spam / bot abuse | Medium | Medium | DB-level cooldown (10 min/region/device); Supabase rate-limit on inserts; consider hCaptcha free tier if persists |
| R-8 | Algorithm gives wrong predictions, users lose trust | Medium | Medium | Conservative confidence caps; always show "NO_DATA" when uncertain; backtesting publicly visible |
| R-9 | RTL layout bugs in Arabic | Medium | Low | Native Arabic speaker reviews every PR; Playwright visual regression in all 3 languages |
| R-10 | i18n drift (missing translations) | High | Low | CI script `check-i18n.mjs` fails build on missing keys |
| R-11 | Legal complaint from STEG | Low | High | Clear "non-official, community data" disclaimer in footer + about page; never claim to be authoritative |
| R-12 | Maintainer burnout | Medium | High | Keep code modular; write onboarding docs; recruit 1–2 co-maintainers before launch |
| R-13 | Supabase outage | Low | High | PWA caches last-known state for 24h; "data may be stale" banner if last update >5min |
| R-14 | Cloudflare Worker outage | Low | Medium | Same as R-13; client falls back to direct famma-dhaw poll (if CORS allows) |
| R-15 | Privacy complaint (device hash tracking) | Low | Medium | Document in `privacy.md`; hashes are salted + truncated; no PII collected |

---

## 16. Deployment Plan

### 16.1 Environments

| Env | Frontend | Worker | DB | Purpose |
|---|---|---|---|---|
| local | `localhost:5173` (Vite) | `wrangler dev` | Local Supabase via Docker, or a separate `tunisianh-dev` Supabase project | Development |
| preview | `https://<branch>.tunisianh.github.io/tunisianh/` (GH Pages preview) | `tunisianh-worker-dev` worker | `tunisianh-dev` Supabase project | PR previews |
| prod | `https://tunisianh.github.io/tunisianh/` | `tunisianh-scraper` worker | `tunisianh` Supabase project | Live |

### 16.2 Secrets management

- Supabase anon key: public (safe to commit, protected by RLS).
- Supabase service role key: stored as Cloudflare Worker secret (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`), never committed.
- GitHub PAT for Pages deploy: stored as GitHub Actions secret.
- All `.env*` files in `.gitignore`.

### 16.3 GitHub Pages setup

1. Repo Settings → Pages → Source: GitHub Actions.
2. Workflow `deploy-web.yml`:
   ```yaml
   on: { push: { branches: [main] } }
   jobs:
     build-deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v3
           with: { version: 9 }
         - uses: actions/setup-node@v4
           with: { node-version: 20, cache: pnpm }
         - run: pnpm install --frozen-lockfile
         - run: pnpm --filter web build
         - uses: actions/upload-pages-artifact@v3
           with: { path: apps/web/dist }
         - uses: actions/deploy-pages@v4
   ```
3. Custom domain (optional, future): `tunisianh.tn` if available.

### 16.4 Cloudflare Worker setup

1. Create Cloudflare account; install `wrangler` (`pnpm i -g wrangler`).
2. `wrangler login`.
3. `wrangler deploy` from `apps/worker`.
4. Add Cron Trigger in `wrangler.toml`:
   ```toml
   [triggers]
   crons = ["* * * * *", "0 * * * *"]
   ```
5. Set secrets: `wrangler secret put SUPABASE_URL`, `wrangler secret put SUPABASE_SERVICE_ROLE_KEY`.
6. GitHub Actions workflow `deploy-worker.yml` runs on push to `main`.

### 16.5 Supabase setup

1. Create project `tunisianh` on supabase.com (free tier).
2. Set project timezone to `Africa/Tunis`.
3. Apply migrations via `supabase db push` (using Supabase CLI).
4. Enable pg_cron extension: `CREATE EXTENSION IF NOT EXISTS pg_cron;`.
5. Schedule nightly jobs:
   ```sql
   SELECT cron.schedule('refresh_daily_stats', '0 2 * * *', 'Africa/Tunis', 'SELECT refresh_daily_stats();');
   SELECT cron.schedule('downsample_snapshots', '0 * * * *', 'SELECT downsnapshots();');
   SELECT cron.schedule('backfill_estimates', '0 3 * * *', 'Africa/Tunis', 'SELECT backfill_estimate_actuals();');
   ```
6. Set up DB backup: Supabase free tier includes daily backups (7-day retention).

### 16.6 Rollback plan

- **Frontend:** GitHub Pages keeps last 90 days of deployments; revert via `gh-pages` branch reset.
- **Worker:** `wrangler deployments list` → `wrangler deployments rollback`.
- **DB:** Supabase PITR (point-in-time recovery) on paid tier only; on free tier, rely on daily snapshots. For destructive migrations, always test on `tunisianh-dev` first.

### 16.7 Monitoring

- **Uptime:** UptimeRobot checks every 5 min: GH Pages URL, Worker health endpoint (`/health`), Supabase REST root.
- **Errors:** Sentry (frontend) + Cloudflare Worker logs.
- **DB health:** Supabase dashboard → database health; alert at 80% storage.
- **Scraper health:** PWA `/status` page reads `health` table.

---

## 17. Testing Strategy

### 17.1 Test pyramid

```
        ┌────────────┐
        │   E2E (5%) │  ← Playwright, 3 languages
        ├────────────┤
        │ Integ (15%)│  ← Vitest + MSW + Supabase local
        ├────────────┤
        │  Unit (80%)│  ← Vitest
        └────────────┘
```

### 17.2 Unit tests (Vitest)

- All pure functions: `transform.ts`, `estimate.ts`, `rel()` (time-ago), `esc()`, etc.
- i18n: every key in `en.json` exists in `ar.json` and `fr.json`.
- Algorithm: golden-case tests with hand-crafted history → expected prediction.
- Coverage target: ≥ 80% lines, ≥ 70% branches.

### 17.3 Integration tests (Vitest + MSW)

- Worker: mock famma-dhaw response → assert correct `snapshots` upsert.
- Worker: mock Supabase failure → assert `health` table logs error.
- Frontend: render `MapView` with mocked Supabase response → assert polygons colored correctly.

### 17.4 End-to-end tests (Playwright)

Across all 3 languages:

- P1: open dashboard, see map, switch language, search "Ariana", tap polygon, see popup.
- P2: submit claim → see it in RecentClaimsFeed → cooldown enforced.
- P3: enter replay mode → scrub to 24h ago → exit.
- P3: open stats → change date range → export CSV.
- P4: open estimation → see predictions → check reasoning.
- Offline: throttle network to offline → assert banner appears.

### 17.5 Visual regression (Playwright + Percy free tier)

- Snapshot 3 key screens (dashboard, stats, estimation) in all 3 languages.
- Run on every PR; fail if diff > 5%.

### 17.6 Performance tests

- Lighthouse CI in GitHub Actions: fail if mobile performance < 80.
- Bundle size check: fail if initial JS > 200 KB gzipped.

### 17.7 Security tests

- Run `supabase audit` (Supabase CLI) on every release.
- Run `npm audit` on every PR; fail on critical vulnerabilities.
- Manual: verify RLS by attempting to INSERT/UPDATE/DELETE from anonymous REST client.
- Manual: verify claim cooldown by attempting to spam from the same device.

### 17.8 Accessibility tests

- `@axe-core/playwright` runs in every e2e test; fail on critical violations.
- Manual screen-reader test (NVDA on Windows, VoiceOver on macOS) once per phase.

### 17.9 Test data

- For local dev: seed `tunisianh-dev` with 24h of fake snapshots (script `scripts/seed-dev.mjs`).
- For e2e: a separate `tunisianh-e2e` Supabase project reset before each run.

---

## 18. Acceptance Criteria

Each user story (§5) maps to acceptance criteria. Below are the most critical ones.

### 18.1 AC for US-E1.1 (live map)

- [ ] Loading the dashboard for the first time shows a map of Tunisia within 3 seconds on 4G.
- [ ] Each governorate polygon is colored green/red/grey based on the latest `live_zone_state`.
- [ ] Colors update within 2 seconds of the underlying data changing.

### 18.2 AC for US-E1.2 (1-second refresh)

- [ ] The "last updated Xs ago" indicator increments every second.
- [ ] No full-page reload occurs during refresh.
- [ ] Network usage < 5 KB per poll (gzipped).

### 18.3 AC for US-E2.1 (replay)

- [ ] Replay mode can be entered from any dashboard state.
- [ ] Date/time picker accepts any date from `2026-07-23` onward (project start).
- [ ] Selecting a future date is rejected with a clear error.

### 18.4 AC for US-E3.6 (CSV export)

- [ ] Clicking "Download CSV" produces a file within 5 seconds for a 7-day range.
- [ ] File is valid CSV (RFC 4180), opens in Excel/Numbers/Calc without import wizard.
- [ ] File contains columns: `region_slug, governorate, delegation, ts, state, on_count, off_count, confidence`.

### 18.5 AC for US-E5.1 (claim buttons)

- [ ] Both buttons are tappable, minimum 44×44 px (Apple HIG).
- [ ] Tapping a button shows a confirmation toast within 1 second.
- [ ] The region's state updates within 2 seconds of the claim.
- [ ] Submitting a second claim for the same region within 10 minutes is blocked.

### 18.6 AC for US-E6.1 (estimation map)

- [ ] Estimation tab shows predicted state for `now + 1h` for every region.
- [ ] Each popup shows confidence (Low/Medium/High) and a human-readable reason.
- [ ] Confidence never exceeds 0.8 (conservative cap).

### 18.7 AC for US-E7.1 (Arabic default)

- [ ] First visit defaults to Arabic with RTL layout.
- [ ] All visible strings (header, footer, popups, buttons, tooltips) are translated.
- [ ] No string is missing in `ar.json` (CI-enforced).

### 18.8 AC for US-E8.1 (PWA install)

- [ ] Chrome on Android shows "Add to Home Screen" prompt.
- [ ] Installed app launches in standalone mode (no browser chrome).
- [ ] App icon (192×192, 512×512, maskable) displays correctly.

### 18.9 Overall launch criteria

- [ ] All Phase 1–4 acceptance criteria pass.
- [ ] Lighthouse mobile score ≥ 80 on all 4 metrics.
- [ ] Zero critical accessibility violations (axe-core).
- [ ] Zero critical npm vulnerabilities.
- [ ] README, methodology, privacy docs complete and reviewed.
- [ ] At least 1 internal dogfood week (maintainer uses app daily) without data-loss incidents.

---

## 19. Performance & Scaling

### 19.1 Expected load (launch + 1 month)

| Metric | Estimate |
|---|---|
| Daily active users | 500–2000 |
| Peak concurrent users | 100–300 (evening during outages) |
| Daily claims | 1000–5000 |
| Daily scraper ticks | 1440 (every minute) |
| Daily snapshots | 380k (264 regions × 1440 ticks) |
| Daily estimates | 76k (264 regions × 288 ticks) |

### 19.2 Free-tier headroom

| Resource | Limit | Expected peak usage | Headroom |
|---|---|---|---|
| Cloudflare Worker requests/day | 100,000 | ~90,000 (scraper + export + claims if proxied) | Tight — monitor |
| Supabase DB size | 500 MB | ~150 MB (with downsampling) | OK |
| Supabase MAU | 50,000 | ~5,000 anon "users" (devices) | OK |
| Supabase API requests | Unlimited on free tier (subject to fair use) | ~260k/day (1s polling × 100 concurrent) | OK |
| GitHub Pages bandwidth | 100 GB/mo | ~5 GB/mo (estimated) | OK |
| OSM tile usage | Fair use, ~1 tile/user/session | ~10k tiles/day | Move to Stadia if banned |

### 19.3 Scaling plan if free tiers are exceeded

1. **Cloudflare Worker**: switch scraper to every 5 min → 28k req/day. Client poll stays at 1s (free Supabase).
2. **Supabase**: if DB exceeds 450 MB, increase downsampling aggressiveness (e.g., 1-hour granularity after 7 days instead of 30).
3. **GitHub Pages**: if bandwidth exceeds 80 GB/mo, move static assets to Cloudflare R2 (10 GB free/mo) + Cloudflare CDN.
4. **OSM tiles**: if banned, switch to Stadia Maps Alidade Smooth (free 250k loads/mo).
5. **Last resort**: enable Supabase Pro ($25/mo) for 8 GB DB + unlimited API.

### 19.4 Performance budgets (reiteration)

See §7.4. CI enforces via `size-limit` (frontend bundle) and Lighthouse CI (overall).

### 19.5 Caching strategy

- **Client side:** TanStack Query caches `live_zone_state` for 1s (staleTime: 1000ms); refetches in background.
- **Service worker:** precaches app shell (HTML, JS, CSS, fonts); runtime-caches OSM tiles for 7 days.
- **Supabase:** materialised views refreshed nightly; live queries hit indexes (covered in §8.3).
- **CDN:** Cloudflare in front of GitHub Pages (optional, via custom domain).

---

## 20. Privacy, Legal & Ethics

### 20.1 Data we collect

| Data | Stored? | Purpose | Retention |
|---|---|---|---|
| User claims (region, value, ts) | Yes (public) | Live state + transparency | Indefinite (aggregated); raw for 90 days |
| Device hash (SHA-256, salted, 16 chars) | Yes (public) | Anti-spam cooldown | Indefinite |
| IP hash (SHA-256, salted, 16 chars) | Optional, server-side only | Abuse analysis | 30 days |
| User agent hash | Optional | Bot detection | 30 days |
| Browser language, viewport size | No | — | — |
| Cookies | No (we use localStorage only) | — | — |
| Login / email / name | No | — | — |

### 20.2 GDPR compliance

- **Lawful basis:** Legitimate interest (civic-tech, non-commercial).
- **Data minimisation:** We collect only what's needed for the cooldown.
- **Anonymity:** Device hashes are salted + truncated; cannot be reversed to identify a person.
- **No third-party trackers:** No Google Analytics, no Facebook Pixel, no Sentry PII.
- **Right to erasure:** Users can clear their `localStorage` to "forget" their device ID. We do not provide per-user DB deletion (cannot link a device to a person).
- **Privacy policy:** `docs/privacy.md`, linked from footer.

### 20.3 Attribution

- **famma-dhaw.com:** prominent attribution in footer and About page: *"Live outage data sourced from famma-dhaw.com (CC BY 4.0)."
- **OpenStreetMap:** standard OSM attribution in map corner.
- **GADM:** attribution for administrative boundaries.
- **STEG:** clarified as "non-official; cross-check with STEG communications."

### 20.4 Disclaimer

Every page footer includes:

> *"TunisianH is a community-driven, non-official dashboard. Data is sourced from famma-dhaw.com and user claims, and may be inaccurate. Always cross-check with official STEG communications for critical decisions."*

### 20.5 License

- **Code:** MIT (permissive, allows commercial fork).
- **Data (snapshots, claims, estimates):** CC BY 4.0 (requires attribution).
- **Translations:** CC BY 4.0.
- **Documentation:** CC BY 4.0.

### 20.6 Code of conduct

Contributor Covenant 2.1, in `CODE_OF_CONDUCT.md`, trilingual.

### 20.7 Ethical scraping commitments

1. We scrape at most 1 request/minute (negligible load).
2. We use only the public Supabase REST API (no HTML scraping, no headless browser).
3. We never impersonate a browser (no fake user agent).
4. We respect `robots.txt` if famma-dhaw adds one.
5. If the maintainer of famma-dhaw contacts us with concerns, we respond within 48 hours.

---

## 21. Glossary

| Term | Definition |
|---|---|
| **Claim** | A user-submitted report of their region's electricity state (ON or OFF). |
| **Snapshot** | A scraped point-in-time record of famma-dhaw's `zone_board` view, augmented with local claim counts. |
| **Region** | A geographic unit. In v1, either a governorate (24 total) or a delegation (264 total). |
| **Governorate** | Top-level administrative unit of Tunisia (المدينة). |
| **Delegation** | Second-level administrative unit (المعتمدية). |
| **STEG** | Société Tunisienne de l'Électricité et du Gaz — the state utility. |
| **OSM** | OpenStreetMap, the open map data layer used for tiles. |
| **Leaflet** | Open-source JS library for rendering interactive maps. |
| **Supabase** | Open-source Firebase alternative; Postgres + auth + storage + realtime. |
| **RLS** | Row-Level Security (Postgres feature) — restricts which rows a client can read/write. |
| **PWA** | Progressive Web App — installable, offline-capable web app. |
| **Cloudflare Worker** | Serverless function running on Cloudflare's edge network. |
| **Cron Trigger** | Cloudflare's mechanism to invoke a Worker on a schedule (cron syntax). |
| **pg_cron** | Postgres extension for scheduling SQL jobs. |
| **famma-dhaw** | "Is there light?" in Tunisian Arabic; the community site we scrape. |
| **Lighthouse** | Google's open-source tool for auditing web performance, accessibility, SEO. |
| **Downsampling** | Reducing time-series granularity (e.g., 1-min → 5-min) to save storage. |
| **Backtesting** | Comparing past predictions to actuals to measure algorithm accuracy. |
| **F1 score** | Harmonic mean of precision and recall; used to evaluate estimation. |
| **Confidence** | 0–1 number indicating how sure the system is of a state/estimate. |
| **Cooldown** | Time window (10 min) during which a device cannot re-claim the same region. |
| **Replay mode** | UI mode that lets users scrub through historical snapshots. |
| **Methodology** | Document explaining how data is collected, merged, and used. |
| **Transparency layer** | UI elements showing source counts (scraped vs local) per region. |

---

## 22. Appendices

### Appendix A — famma-dhaw.com data sample

A representative response from `https://njfulpklvqezflxiozhn.supabase.co/rest/v1/zone_board?select=*`:

```json
[
  {
    "slug": "ariana-ariana",
    "name": "Ariana",
    "gov": "Ariana",
    "off_count": 8,
    "on_count": 3,
    "last_report": "2026-07-23T14:23:11.000Z"
  },
  {
    "slug": "tunis-tunis",
    "name": "Tunis",
    "gov": "Tunis",
    "off_count": 0,
    "on_count": 12,
    "last_report": "2026-07-23T14:23:45.000Z"
  }
]
```

### Appendix B — Tunisian governorates (24)

| # | AR | FR/EN | # | AR | FR/EN |
|---|---|---|---|---|---|
| 1 | تونس | Tunis | 13 | القصرين | Kasserine |
| 2 | أريانة | Ariana | 14 | سيدي بوزيد | Sidi Bouzid |
| 3 | بن عروس | Ben Arous | 15 | صفاقس | Sfax |
| 4 | منوبة | Manouba | 16 | قابس | Gabès |
| 5 | نابل | Nabeul | 17 | مدنين | Médenine |
| 6 | زغوان | Zaghouan | 18 | تطاوين | Tataouine |
| 7 | بنزرت | Bizerte | 19 | قفصة | Gafsa |
| 8 | باجة | Béja | 20 | توزر | Tozeur |
| 9 | جندوبة | Jendouba | 21 | قبلي | Kebili |
| 10 | الكاف | Le Kef | 22 | صفاقس | Sfax |
| 11 | سليانة | Siliana | 23 | المهدية | Mahdia |
| 12 | سوسة | Sousse | 24 | المنستير | Monastir |

(Note: Kairouan and Kebili appear in the official 24; the maintainer should double-check this list against the Tunisian Institut National de la Statistique before seeding.)

### Appendix C — URL structure

| URL | Page |
|---|---|
| `/ar/` | Dashboard (Arabic, RTL) |
| `/fr/` | Dashboard (French) |
| `/en/` | Dashboard (English) |
| `/ar/stats` | Statistics |
| `/ar/estimation` | Estimation |
| `/ar/about` | About / Methodology |
| `/ar/?replay=20260715T2100` | Replay a specific moment |
| `/status` | Health / status page |
| `/api/export?from=…&to=…` | CSV export (rate-limited) |

### Appendix D — Reference projects

- **famma-dhaw.com** — direct inspiration and data source.
- **blanchir.fr** (French gas station shortage tracker, 2022) — similar civic-tech pattern.
- **StadtEnergyMap** (German city energy dashboards) — UI inspiration.
- **Pirate Weather** — example of free-tier API on Cloudflare Workers.

### Appendix E — Open questions (to resolve before Phase 1)

1. **OQ-1:** Can we get written permission from the famma-dhaw maintainer to scrape? (Reduces R-2 risk.)
2. **OQ-2:** Should we support sub-delegation granularity in v1, or stick to 24 governorates for simplicity?
3. **OQ-3:** Custom domain `tunisianh.tn` — is it available? Cost? (Currently `tunisianh.github.io` is fine.)
4. **OQ-4:** Should we add Web Push in v1 or v2? (Currently v2.)
5. **OQ-5:** Should claims be moderated? (Currently no — purely community.)
6. **OQ-6:** Should we publish a public API beyond `/api/export`? (Currently no — encourage people to use the CSV export.)

### Appendix F — Suggested first commit message

```
feat: initial commit — pnpm workspace skeleton

- apps/web: Vite + React + TS + Tailwind
- apps/worker: Cloudflare Worker scaffold
- packages/shared: types and constants
- supabase/migrations: 0001_init.sql (empty stub)
- .github/workflows: ci.yml (lint + typecheck)
- README, LICENSE (MIT), CONTRIBUTING, CoC

Phase 0 milestone: trilingual "Hello TunisianH" on GitHub Pages.

Refs: docs/TunisianH_SPEC.md
```

---

**End of specification.**

*This document is licensed CC BY 4.0. The codebase it describes is MIT. Data it produces is CC BY 4.0. Attribute "TunisianH project" with a link to https://github.com/tunisianh/tunisianh.*
