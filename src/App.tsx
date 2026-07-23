import { useState, useEffect, useCallback, useRef } from 'react';
import type { LiveZoneState, Lang, Tab } from './types';
import { fetchLiveZones, getLocalClaims, formatTimeAgo } from './data';
import { t } from './i18n';
import { TunisiaAdm3Map } from './components/TunisiaAdm3Map';
import { StatsTab } from './components/StatsTab';
import { ReplayBar } from './components/ReplayBar';
import { EstimateTab } from './components/EstimateTab';

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, isError, onDone }: { msg: string; isError: boolean; onDone: () => void }) {
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2500);
    const t2 = setTimeout(() => onDone(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  return (
    <div className={`toast ${exiting ? 'exit' : ''} ${isError ? 'error' : ''}`}>
      {isError ? '⚠️' : '✅'} {msg}
    </div>
  );
}

// ─── Search box ────────────────────────────────────────────────────────────────
function SearchBox({ zones, lang, onSelect }: {
  zones: LiveZoneState[];
  lang: Lang;
  onSelect: (z: LiveZoneState) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const regionName = (z: LiveZoneState) =>
    lang === 'ar' ? z.name_ar : lang === 'fr' ? z.name_fr : z.name_en;

  const results = query.length >= 1
    ? zones.filter((z) =>
        regionName(z).toLowerCase().includes(query.toLowerCase()) ||
        z.governorate.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  return (
    <div className="header-search">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        placeholder={t(lang, 'search')}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((z) => (
            <div
              key={z.slug}
              className="search-result-item"
              onMouseDown={() => { onSelect(z); setQuery(''); setOpen(false); }}
            >
              <span
                className="search-result-state"
                style={{ background: z.state === 'on' ? '#22c55e' : z.state === 'off' ? '#ef4444' : '#374151' }}
              />
              <span>
                <strong>{regionName(z)}</strong>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{z.governorate}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Claims Feed ───────────────────────────────────────────────────────────────
function ClaimsFeed({ lang, zones }: { lang: Lang; zones: LiveZoneState[] }) {
  const [open, setOpen] = useState(false);
  const claims = getLocalClaims().slice(0, 50);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const regionName = (slug: string) => {
    const z = zones.find((z) => z.slug === slug);
    if (!z) return slug;
    return lang === 'ar' ? z.name_ar : lang === 'fr' ? z.name_fr : z.name_en;
  };

  if (!open) {
    return (
      <button
        style={{
          position: 'fixed',
          bottom: 12,
          right: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '7px 12px',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'inherit',
          zIndex: 800,
        }}
        onClick={() => setOpen(true)}
        dir={dir}
      >
        📋 {t(lang, 'recentClaims')} ({claims.length})
      </button>
    );
  }

  return (
    <div className="claims-feed-panel anim-slide-in" dir={dir}>
      <div className="claims-feed-header">
        <span>{t(lang, 'recentClaims')}</span>
        <button
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>
      <div className="claims-feed-body">
        {claims.length === 0 ? (
          <div style={{ padding: '12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            {t(lang, 'noReports')}
          </div>
        ) : (
          claims.map((c) => (
            <div key={c.id} className="claim-feed-item">
              <span className={`claim-feed-dot ${c.value}`} />
              <div className="claim-feed-info">
                <div className="claim-feed-region">{regionName(c.region_slug)}</div>
                <div className="claim-feed-meta">
                  {c.value === 'on' ? '💡' : '🔌'} · {new Date(c.ts).toLocaleTimeString()} · #{c.device_hash}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────
import { AddRegionModal } from './components/AddRegionModal';
import { getUserRegions } from './data';

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('tunisianh_lang') as Lang | null;
    return saved ?? 'ar';
  });
  const [tab, setTab] = useState<Tab>('map');
  const [zones, setZones] = useState<LiveZoneState[]>([]);
  const [displayZones, setDisplayZones] = useState<LiveZoneState[]>([]);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScraped, setIsScraped] = useState<boolean>(false);
  const [sourceUrl, setSourceUrl] = useState<string>('Initializing...');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState<{ msg: string; isError: boolean; id: number } | null>(null);
  const [isReplay, setIsReplay] = useState(false);
  const [ticker, setTicker] = useState('—');
  const [showAddRegion, setShowAddRegion] = useState(false);

  // Lang change
  const changeLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem('tunisianh_lang', l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  };

  // Apply lang on mount
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, []);

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Combine scraped/official zones with local user-defined regions
  const mergeUserRegions = useCallback((officialZones: LiveZoneState[]) => {
    const userRegs = getUserRegions();
    const mappedUserZones: LiveZoneState[] = userRegs.map((ur) => ({
      slug: ur.slug,
      governorate: ur.governorate || 'Custom',
      delegation: ur.name_en,
      name_ar: ur.name_ar,
      name_fr: ur.name_fr,
      name_en: ur.name_en,
      lat: ur.lat,
      lng: ur.lng,
      on_count: ur.on_count,
      off_count: ur.off_count,
      state: ur.state,
      last_update_ts: ur.created_at,
      scraped_on: 0,
      scraped_off: 0,
      local_on: ur.on_count,
      local_off: ur.off_count,
      geometry_type: 'circle',
      radius_m: ur.radius_m,
      verified: ur.verified,
    }));
    return [...mappedUserZones, ...officialZones];
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    const res = await fetchLiveZones();
    setIsScraped(res.isScraped);
    setSourceUrl(res.sourceUrl);
    setLastFetch(new Date());

    let finalZones = res.zones;
    if (!res.isScraped || res.zones.length === 0) {
      finalZones = MOCK_ZONES;
      setError(res.error || 'Live scrape unavailable, using simulated data');
    } else {
      setError(null);
    }

    const merged = mergeUserRegions(finalZones);
    setZones(merged);
    if (!isReplay) setDisplayZones(merged);
    setLoading(false);
  }, [isReplay, mergeUserRegions]);

  // Poll every 5 seconds
  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, []);

  // Ticker
  useEffect(() => {
    const iv = setInterval(() => {
      if (lastFetch) {
        setTicker(formatTimeAgo(lastFetch.toISOString(), lang));
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [lastFetch, lang]);

  // Update displayZones when not in replay and zones change
  useEffect(() => {
    if (!isReplay) setDisplayZones(zones);
  }, [zones, isReplay]);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError, id: Date.now() });
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'map', label: t(lang, 'live'), icon: '🗺' },
    { key: 'replay', label: t(lang, 'replay'), icon: '⏮' },
    { key: 'stats', label: t(lang, 'stats'), icon: '📊' },
    { key: 'estimate', label: t(lang, 'estimate'), icon: '🔮' },
  ];

  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <div className="offline-banner">{t(lang, 'offlineBanner')}</div>
      )}

      {/* Header */}
      <header className="header" dir={dir}>
        <div className="header-logo">
          <div className="header-logo-icon">⚡</div>
          <span className="header-title">{t(lang, 'appName')}</span>
        </div>

        {!loading && (
          <div className={`header-live-badge ${isScraped ? 'scraped' : 'mock'}`}>
            <span className={`dot ${isScraped ? 'green' : 'amber'}`} />
            {isScraped ? '📡 SCRAPED LIVE' : '⚠️ DEMO MODE'}
          </div>
        )}

        <div className="header-spacer" />

        <SearchBox zones={displayZones} lang={lang} onSelect={(z) => {
          setTab('map');
        }} />

        <button
          className="add-region-header-btn"
          onClick={() => setShowAddRegion(true)}
          title={lang === 'ar' ? 'إضافة منطقة خاصة' : 'Add custom region'}
        >
          ➕ {lang === 'ar' ? 'إضافة منطقة' : 'Add Region'}
        </button>

        {/* Lang switcher */}
        <div className="lang-switcher">
          {(['ar', 'en', 'fr'] as Lang[]).map((l) => (
            <button
              key={l}
              className={`lang-btn ${lang === l ? 'active' : ''}`}
              onClick={() => changeLang(l)}
            >
              {l === 'ar' ? 'ع' : l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Nav tabs */}
      <nav className="nav-tabs" dir={dir}>
        {tabs.map((tab_) => (
          <button
            key={tab_.key}
            className={`nav-tab ${tab === tab_.key ? 'active' : ''}`}
            onClick={() => {
              setTab(tab_.key);
              if (tab_.key === 'replay') setIsReplay(true);
              else if (isReplay) { setIsReplay(false); setDisplayZones(zones); }
            }}
          >
            {tab_.icon} {tab_.label}
          </button>
        ))}

        {/* Last updated ticker */}
        <div className="header-spacer" />
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 8px',
        }}>
          {loading ? (
            <div className="shimmer" style={{ width: 80, height: 12, borderRadius: 6 }} />
          ) : (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isScraped ? '#22c55e' : '#f59e0b', display: 'inline-block' }} />
              {isScraped ? 'Scraped' : 'Simulated'} {ticker}
            </>
          )}
        </div>
      </nav>

      {/* Main */}
      <main className="main-content">
        {/* Map view (always mounted, hidden under other tabs) */}
        <div style={{ position: 'absolute', inset: 0, display: tab === 'map' || tab === 'replay' ? 'block' : 'none' }}>
          {loading && displayZones.length === 0 ? (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: 'var(--text-secondary)',
              fontSize: 14,
            }}>
              <div style={{ fontSize: 40 }}>⚡</div>
              <div>Scraping live Tunisia electricity data...</div>
              <div className="shimmer" style={{ width: 200, height: 8, borderRadius: 4 }} />
            </div>
          ) : (
            <TunisiaAdm3Map
              lang={lang}
              zoneStates={(() => {
                const m = new Map<string, 'on' | 'off' | 'contested' | 'no_data'>();
                (displayZones.length > 0 ? displayZones : MOCK_ZONES).forEach(z => {
                  m.set(z.slug, z.state);
                  m.set(z.governorate.toLowerCase(), z.state);
                  m.set(z.delegation.toLowerCase(), z.state);
                  m.set(z.name_fr.toLowerCase().replace(/\s+/g, '-'), z.state);
                  m.set(z.name_ar, z.state);
                });
                return m;
              })()}
              isScraped={isScraped}
              sourceUrl={sourceUrl}
              lastScrapedTime={lastFetch ? lastFetch.toLocaleTimeString() : null}
              onToast={showToast}
            />
          )}

          {/* Replay bar */}
          {tab === 'replay' && (
            <ReplayBar
              lang={lang}
              zones={zones.length > 0 ? zones : MOCK_ZONES}
              onClose={() => { setTab('map'); setIsReplay(false); setDisplayZones(zones); }}
              onReplayZones={setDisplayZones}
            />
          )}

          {/* Replay badge */}
          {isReplay && (
            <div className="last-update-ticker" style={{ top: 10 }}>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>🕐 {t(lang, 'replayBadge')}</span>
            </div>
          )}
        </div>

        {/* Stats tab */}
        {tab === 'stats' && (
          <StatsTab
            lang={lang}
            zones={(displayZones.length > 0 ? displayZones : MOCK_ZONES).map((z) => ({
              ...z,
              name_ar: z.name_ar,
              name_en: z.name_en,
              name_fr: z.name_fr,
            }))}
          />
        )}

        {/* Estimate tab */}
        {tab === 'estimate' && (
          <EstimateTab
            lang={lang}
            zones={displayZones.length > 0 ? displayZones : MOCK_ZONES}
          />
        )}
      </main>

      {/* Claims feed (always visible on map) */}
      {(tab === 'map' || tab === 'replay') && (
        <ClaimsFeed lang={lang} zones={displayZones.length > 0 ? displayZones : MOCK_ZONES} />
      )}

      {/* Add Region Modal */}
      {showAddRegion && (
        <AddRegionModal
          lang={lang}
          onClose={() => setShowAddRegion(false)}
          onAdded={(msg) => {
            showToast(msg);
            fetchData();
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.id}
          msg={toast.msg}
          isError={toast.isError}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
}

// ─── Mock data (shown if fetch fails) ─────────────────────────────────────────
const GOV_LIST = ['Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Gabès', 'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'];

const GOV_AR: Record<string, string> = {
  'Tunis': 'تونس', 'Ariana': 'أريانة', 'Ben Arous': 'بن عروس', 'Manouba': 'منوبة',
  'Nabeul': 'نابل', 'Zaghouan': 'زغوان', 'Bizerte': 'بنزرت', 'Béja': 'باجة',
  'Jendouba': 'جندوبة', 'Le Kef': 'الكاف', 'Siliana': 'سليانة', 'Sousse': 'سوسة',
  'Monastir': 'المنستير', 'Mahdia': 'المهدية', 'Sfax': 'صفاقس', 'Kairouan': 'القيروان',
  'Kasserine': 'القصرين', 'Sidi Bouzid': 'سيدي بوزيد', 'Gabès': 'قابس',
  'Médenine': 'مدنين', 'Tataouine': 'تطاوين', 'Gafsa': 'قفصة', 'Tozeur': 'توزر', 'Kébili': 'قبلي',
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const MOCK_ZONES: LiveZoneState[] = GOV_LIST.map((gov, i) => {
  const rng = seededRandom(i * 37 + 13);
  const r = rng();
  const state: LiveZoneState['state'] = r < 0.35 ? 'off' : r < 0.6 ? 'on' : r < 0.7 ? 'contested' : 'no_data';
  const on = state === 'on' ? Math.floor(rng() * 20 + 5) : Math.floor(rng() * 4);
  const off = state === 'off' ? Math.floor(rng() * 20 + 5) : Math.floor(rng() * 4);
  return {
    slug: gov.toLowerCase().replace(/ /g, '-'),
    governorate: gov,
    delegation: gov,
    name_ar: GOV_AR[gov] ?? gov,
    name_fr: gov,
    name_en: gov,
    lat: 0,
    lng: 0,
    on_count: on,
    off_count: off,
    state,
    last_update_ts: new Date(Date.now() - Math.floor(rng() * 300) * 1000).toISOString(),
    scraped_on: on,
    scraped_off: off,
    local_on: 0,
    local_off: 0,
  };
});
