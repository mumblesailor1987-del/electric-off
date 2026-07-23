import type { LiveZoneState, HistorySnapshot, Claim } from './types';



// ─── Device ID ────────────────────────────────────────────────────────────────
function getDeviceId(): string {
  let id = localStorage.getItem('tunisianh_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('tunisianh_device_id', id);
  }
  return id;
}

async function hashString(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export interface FetchLiveResult {
  zones: LiveZoneState[];
  isScraped: boolean;
  sourceUrl: string;
  fetchedAt: string;
  error?: string;
}

import scrapedLiveJson from './data/scraped_live.json';

// ─── Fetch live zone data from local scraped dataset ─────────────────────────
export async function fetchLiveZones(): Promise<FetchLiveResult> {
  const nowIso = new Date().toISOString();
  try {
    const rawZones: any[] = Array.isArray(scrapedLiveJson.zones) ? scrapedLiveJson.zones : [];
    if (rawZones.length === 0) throw new Error('Empty local scraped dataset');

    const zones: LiveZoneState[] = rawZones.map((z: any) => {
      const on = z.on_count ?? 0;
      const off = z.off_count ?? 0;
      const total = on + off;
      let state: LiveZoneState['state'] = 'no_data';
      if (total > 0) {
        state = Math.abs(on - off) <= 1 ? 'contested' : off > on ? 'off' : 'on';
      }
      const name = z.name || z.slug || 'Unknown';
      return {
        slug: z.slug,
        governorate: z.gov || name,
        delegation: name,
        name_ar: name,
        name_fr: name,
        name_en: name,
        lat: 0,
        lng: 0,
        on_count: on,
        off_count: off,
        state,
        last_update_ts: z.last_report || nowIso,
        scraped_on: on,
        scraped_off: off,
        local_on: 0,
        local_off: 0,
      };
    });

    return {
      zones,
      isScraped: true,
      sourceUrl: 'scraped_live.json',
      fetchedAt: scrapedLiveJson.scraped_at || nowIso,
    };
  } catch (err: any) {
    console.error('Failed to load local scraped JSON:', err);
    return {
      zones: [],
      isScraped: false,
      sourceUrl: 'Demo / Fallback',
      fetchedAt: nowIso,
      error: err?.message,
    };
  }
}


// ─── User-Defined Regions ─────────────────────────────────────────────────────
export function getUserRegions(): UserRegion[] {
  try {
    return JSON.parse(localStorage.getItem('tunisianh_user_regions') ?? '[]');
  } catch {
    return [];
  }
}

export function addUserRegion(r: Omit<UserRegion, 'id' | 'created_at' | 'verified' | 'state' | 'on_count' | 'off_count'>): UserRegion {
  const userRegions = getUserRegions();
  const newRegion: UserRegion = {
    ...r,
    id: 'u-' + Date.now(),
    created_at: new Date().toISOString(),
    verified: false, // pending maintainer verification
    state: 'no_data',
    on_count: 0,
    off_count: 0,
  };
  userRegions.unshift(newRegion);
  localStorage.setItem('tunisianh_user_regions', JSON.stringify(userRegions));
  return newRegion;
}

// ─── Submit a user claim ──────────────────────────────────────────────────────
export async function submitClaim(regionSlug: string, value: 'on' | 'off'): Promise<void> {
  const deviceId = getDeviceId();
  const deviceHash = await hashString(deviceId);
  // We store locally only (demo mode — no backend configured yet)
  const claims = getLocalClaims();
  claims.unshift({
    id: Date.now(),
    region_slug: regionSlug,
    ts: new Date().toISOString(),
    value,
    device_hash: deviceHash,
  });
  localStorage.setItem('tunisianh_claims', JSON.stringify(claims.slice(0, 200)));
}

export function getLocalClaims(): Claim[] {
  try {
    return JSON.parse(localStorage.getItem('tunisianh_claims') ?? '[]');
  } catch {
    return [];
  }
}

export function getCooldownRemaining(regionSlug: string): number {
  const claims = getLocalClaims();
  const COOLDOWN_MS = 10 * 60 * 1000;
  const recent = claims.find(
    (c) => c.region_slug === regionSlug && Date.now() - new Date(c.ts).getTime() < COOLDOWN_MS
  );
  if (!recent) return 0;
  return COOLDOWN_MS - (Date.now() - new Date(recent.ts).getTime());
}

// ─── Mock historical data for replay / stats ──────────────────────────────────
export function generateMockHistory(regionSlug: string, hoursBack = 24): HistorySnapshot[] {
  const snapshots: HistorySnapshot[] = [];
  const now = Date.now();
  // Seeded pseudo-random to be consistent per slug
  let seed = regionSlug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };
  let isOff = rng() > 0.6;
  for (let i = hoursBack * 60; i >= 0; i--) {
    const ts = new Date(now - i * 60 * 1000).toISOString();
    if (rng() < 0.05) isOff = !isOff;
    const on = isOff ? Math.floor(rng() * 3) : Math.floor(3 + rng() * 15);
    const off = isOff ? Math.floor(5 + rng() * 15) : Math.floor(rng() * 3);
    snapshots.push({ ts, on_count: on, off_count: off, state: isOff ? 'off' : 'on' });
  }
  return snapshots;
}

export function formatTimeAgo(isoTs: string | null, lang: string): string {
  if (!isoTs) return '—';
  const diff = (Date.now() - new Date(isoTs).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}${lang === 'ar' ? ' ث' : lang === 'fr' ? 's' : 's'}`;
  return `${Math.floor(diff / 60)}${lang === 'ar' ? ' د' : lang === 'fr' ? 'min' : 'm'}`;
}

export function getConfidenceLabel(on: number, off: number, lang: string): string {
  const total = on + off;
  if (total === 0) return { ar: 'منخفضة', en: 'Low', fr: 'Faible' }[lang as 'ar' | 'en' | 'fr'] ?? 'Low';
  const ratio = Math.max(on, off) / total;
  if (ratio >= 0.75) return { ar: 'عالية', en: 'High', fr: 'Élevée' }[lang as 'ar' | 'en' | 'fr'] ?? 'High';
  if (ratio >= 0.6) return { ar: 'متوسطة', en: 'Medium', fr: 'Moyenne' }[lang as 'ar' | 'en' | 'fr'] ?? 'Medium';
  return { ar: 'منخفضة', en: 'Low', fr: 'Faible' }[lang as 'ar' | 'en' | 'fr'] ?? 'Low';
}
