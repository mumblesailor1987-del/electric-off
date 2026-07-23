import type { LiveZoneState, HistorySnapshot, Claim } from './types';

// ─── Famma-dhaw.com Supabase config ──────────────────────────────────────────
const FAMMA_URL = 'https://njfulpklvqezflxiozhn.supabase.co';
const FAMMA_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZnVscGtsdnFlemZseGlvemhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTIwNjg4MDMsImV4cCI6MjAyNzY0NDgwM30.uBHX4D_sYhBSTqHAHiOxrYNBSEfylB0xQ_0dCOPgQVs';

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

// ─── Fetch live zone data from Famma-dhaw ────────────────────────────────────
export async function fetchLiveZones(): Promise<LiveZoneState[]> {
  const res = await fetch(
    `${FAMMA_URL}/rest/v1/zone_board?select=slug,name,gov,off_count,on_count,last_report&order=gov`,
    {
      headers: {
        apikey: FAMMA_ANON_KEY,
        Authorization: `Bearer ${FAMMA_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error('Failed to fetch zone data');
  const raw: Array<{
    slug: string;
    name: string;
    gov: string;
    off_count: number;
    on_count: number;
    last_report: string | null;
  }> = await res.json();

  return raw.map((z) => {
    const on = z.on_count ?? 0;
    const off = z.off_count ?? 0;
    const total = on + off;
    let state: LiveZoneState['state'] = 'no_data';
    if (total > 0) {
      if (Math.abs(on - off) <= 1) state = 'contested';
      else state = off > on ? 'off' : 'on';
    }
    return {
      slug: z.slug,
      governorate: z.gov,
      delegation: z.name,
      name_ar: z.name,
      name_fr: z.name,
      name_en: z.name,
      lat: 0,
      lng: 0,
      on_count: on,
      off_count: off,
      state,
      last_update_ts: z.last_report,
      scraped_on: on,
      scraped_off: off,
      local_on: 0,
      local_off: 0,
    };
  });
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
