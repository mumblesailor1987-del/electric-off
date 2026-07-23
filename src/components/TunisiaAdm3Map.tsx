import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import type { Lang } from '../types';
import { t } from '../i18n';
import { createRoot } from 'react-dom/client';

// ─── Name overrides stored locally ────────────────────────────────────────────
const STORAGE_KEY = 'tunisianh_region_names';

export interface RegionNameOverride {
  id: number;
  pcode: string;
  name_ar: string;
  name_fr: string;
  name_en: string;
}

export function getRegionNameOverrides(): Record<number, RegionNameOverride> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch { return {}; }
}

export function saveRegionNameOverride(override: RegionNameOverride) {
  const all = getRegionNameOverrides();
  all[override.id] = override;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('region-names-changed'));
}

// ─── Name Edit Popup ─────────────────────────────────────────────────────────
function NameEditPopup({ feature, lang, onSave, onClose }: {
  feature: {
    id: number; pcode: string;
    name_ar: string; name_fr: string; name_en: string;
    gov_ar: string; gov_fr: string; del_ar: string; del_fr: string;
  };
  lang: Lang;
  onSave: () => void;
  onClose: () => void;
}) {
  const [nameAr, setNameAr] = useState(feature.name_ar);
  const [nameFr, setNameFr] = useState(feature.name_fr);
  const [nameEn, setNameEn] = useState(feature.name_en);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveRegionNameOverride({
      id: feature.id,
      pcode: feature.pcode,
      name_ar: nameAr.trim() || feature.name_ar,
      name_fr: nameFr.trim() || feature.name_fr,
      name_en: nameEn.trim() || feature.name_en,
    });
    onSave();
    onClose();
  };

  return (
    <div className="name-edit-popup" dir={dir}>
      <div className="name-edit-header">
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>
            ✏️ {lang === 'ar' ? 'تحرير اسم المنطقة' : 'Edit Region Name'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {feature.pcode} · {feature.gov_fr || feature.gov_ar}
          </div>
          {feature.del_fr && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Délégation: {feature.del_fr}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="name-edit-form">
        <div className="name-edit-field">
          <label>🇸🇦 اسم بالعربية</label>
          <input
            type="text"
            value={nameAr}
            onChange={e => setNameAr(e.target.value)}
            dir="rtl"
            placeholder="الاسم بالعربية"
          />
        </div>

        <div className="name-edit-field">
          <label>🇫🇷 Nom (Français)</label>
          <input
            type="text"
            value={nameFr}
            onChange={e => setNameFr(e.target.value)}
            placeholder="Nom en français"
          />
        </div>

        <div className="name-edit-field">
          <label>🇬🇧 Name (English)</label>
          <input
            type="text"
            value={nameEn}
            onChange={e => setNameEn(e.target.value)}
            placeholder="Name in English"
          />
        </div>

        <div className="name-edit-actions">
          <button type="button" className="name-edit-cancel" onClick={onClose}>
            {t(lang, 'close')}
          </button>
          <button type="submit" className="name-edit-save">
            💾 {lang === 'ar' ? 'حفظ' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Electricity state colors ─────────────────────────────────────────────────
type ZoneState = 'on' | 'off' | 'contested' | 'no_data';

function stateColor(s: ZoneState): string {
  if (s === 'on') return '#22c55e';
  if (s === 'off') return '#ef4444';
  if (s === 'contested') return '#f59e0b';
  return '#374151';
}

// ─── Zone lookup ──────────────────────────────────────────────────────────────
function findZoneState(pcode: string | undefined, name_ar: string | undefined, name_fr: string | undefined, zoneMap: Map<string, ZoneState>): ZoneState {
  if (!zoneMap) return 'no_data';
  const keys = [
    (pcode || '').toLowerCase(),
    (name_fr || '').toLowerCase().replace(/\s+/g, '-'),
    (name_ar || '').toLowerCase(),
  ].filter(Boolean);

  for (const k of keys) {
    if (zoneMap.has(k)) return zoneMap.get(k)!;
  }
  return 'no_data';
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface TunisiaAdm3MapProps {
  lang: Lang;
  zoneStates: Map<string, ZoneState>; // key: pcode/name → state
  isScraped: boolean;
  sourceUrl: string;
  lastScrapedTime: string | null;
  onToast: (msg: string, isError?: boolean) => void;
}

// ─── Main Map Component ───────────────────────────────────────────────────────
export function TunisiaAdm3Map({
  lang,
  zoneStates,
  isScraped,
  sourceUrl,
  lastScrapedTime,
  onToast,
}: TunisiaAdm3MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const popupRootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const [nameOverrides, setNameOverrides] = useState<Record<number, RegionNameOverride>>(getRegionNameOverrides);
  const [geojson, setGeojson] = useState<any>(null);
  const [tileKey, setTileKey] = useState<'osm' | 'light' | 'satellite'>('light');
  const [showScrapeInfo, setShowScrapeInfo] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const TILES = {
    osm: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
    light: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap © CARTO' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  };

  // Listen for name changes from other components
  useEffect(() => {
    const handler = () => setNameOverrides(getRegionNameOverrides());
    window.addEventListener('region-names-changed', handler);
    return () => window.removeEventListener('region-names-changed', handler);
  }, []);

  // Load GeoJSON dynamically (from converted file or fallback)
  useEffect(() => {
    let cancelled = false;
    import('../data/tunisia_adm3.ts')
      .then(m => {
        if (cancelled) return;
        if (m.TUNISIA_ADM3_GEOJSON && m.TUNISIA_ADM3_GEOJSON.features && m.TUNISIA_ADM3_GEOJSON.features.length > 0) {
          setGeojson(m.TUNISIA_ADM3_GEOJSON);
          setLoadError(null);
        } else {
          // Stub is empty — fallback to 24 governorates
          import('../data/tunisia_geojson')
            .then(m2 => {
              if (!cancelled) {
                setGeojson(m2.TUNISIA_GEOJSON);
                setLoadError('ADM3 shapefile ready. Run "npm run convert-shp" in terminal to load detailed municipal boundaries.');
              }
            });
        }
      })
      .catch(() => {
        // Fallback: load the bundled governorate polygons
        import('../data/tunisia_geojson')
          .then(m => {
            if (!cancelled) {
              setGeojson(m.TUNISIA_GEOJSON);
              setLoadError('ADM3 data not yet converted. Run: npm run convert-shp in terminal.');
            }
          })
          .catch(() => setLoadError('No geographic data available.'));
      });
    return () => { cancelled = true; };
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map('leaflet-map', {
      center: [33.8, 9.4],
      zoom: 6,
      minZoom: 5,
      maxZoom: 16,
    });
    tileLayerRef.current = L.tileLayer(TILES.light.url, { attribution: TILES.light.attr, maxZoom: 19 });
    tileLayerRef.current.addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Switch tiles
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    const t = TILES[tileKey];
    tileLayerRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 });
    tileLayerRef.current.addTo(mapRef.current);
  }, [tileKey]);

  // Render GeoJSON polygons
  useEffect(() => {
    if (!mapRef.current || !geojson) return;
    const map = mapRef.current;

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
    }

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const p = feature?.properties;
        const override = nameOverrides[p?.id];
        const name_ar = override?.name_ar || p?.name_ar || '';
        const name_fr = override?.name_fr || p?.name_fr || '';
        const pcode = p?.pcode || '';
        const state = findZoneState(pcode, name_ar, name_fr, zoneStates);
        const col = stateColor(state);
        const isNoData = state === 'no_data';

        return {
          color: col,
          weight: 1.2,
          opacity: 0.9,
          fillColor: col,
          fillOpacity: isNoData ? 0.1 : 0.45,
        };
      },

      onEachFeature: (feature, featureLayer) => {
        const p = feature?.properties || {};
        const featId = p.id ?? Math.random();
        const override = nameOverrides[featId];

        const getDisplayName = () => {
          const ov = getRegionNameOverrides()[featId];
          if (lang === 'ar') return ov?.name_ar || p.name_ar || p.name_fr || p.gov_ar || 'منطقة';
          if (lang === 'fr') return ov?.name_fr || p.name_fr || p.name_en || p.gov_fr || 'Région';
          return ov?.name_en || p.name_en || p.name_fr || p.name_ar || 'Region';
        };

        const state = findZoneState(p.pcode, p.name_ar, p.name_fr, zoneStates);
        const stateIcon = state === 'on' ? '💡' : state === 'off' ? '🔌' : state === 'contested' ? '⚡' : '—';
        const pcodeDisplay = p.pcode ? `<br/><span style="color:#888;font-size:10px">${p.pcode}</span>` : '';

        featureLayer.bindTooltip(
          `<b>${getDisplayName()}</b>${pcodeDisplay}<br/>${stateIcon} ${state.toUpperCase()}<br/><em style="font-size:10px;color:#aaa">Click to view / edit name</em>`,
          { permanent: false, className: 'leaflet-tooltip-dark', sticky: true }
        );

        featureLayer.on({
          mouseover: (e) => {
            e.target.setStyle({ weight: 3, color: '#fff', fillOpacity: 0.7 });
            e.target.bringToFront();
          },
          mouseout: (e) => layer.resetStyle(e.target),
          click: (e) => {
            const bounds = (featureLayer as L.Polygon).getBounds();
            const center = bounds.getCenter();

            const container = document.createElement('div');
            const popup = L.popup({
              maxWidth: 320,
              minWidth: 280,
              className: 'tunisianh-popup',
              closeButton: true,
            })
              .setLatLng(center)
              .setContent(container)
              .openOn(map);

            if (popupRootRef.current) popupRootRef.current.unmount();
            popupRootRef.current = createRoot(container);

            const ov = getRegionNameOverrides()[featId];
            const enriched = {
              id: featId,
              pcode: p.pcode || String(featId),
              name_ar: ov?.name_ar || p.name_ar || p.gov_ar || '',
              name_fr: ov?.name_fr || p.name_fr || p.gov_fr || '',
              name_en: ov?.name_en || p.name_en || p.name_fr || '',
              gov_ar: p.gov_ar || '',
              gov_fr: p.gov_fr || '',
              del_ar: p.del_ar || '',
              del_fr: p.del_fr || '',
            };

            const handleSave = () => {
              setNameOverrides(getRegionNameOverrides());
              layer.resetStyle(featureLayer);
              onToast(lang === 'ar' ? 'تم حفظ الاسم! ✅' : 'Name saved! ✅');
            };

            popupRootRef.current.render(
              <NameEditPopup
                feature={enriched}
                lang={lang}
                onSave={handleSave}
                onClose={() => map.closePopup()}
              />
            );
          },
        });
      },
    });

    layer.addTo(map);
    geoLayerRef.current = layer;

    return () => {
      if (geoLayerRef.current) map.removeLayer(geoLayerRef.current);
    };
  }, [geojson, zoneStates, nameOverrides, lang]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const onCount = zoneStates ? Array.from(zoneStates.values()).filter(v => v === 'on').length : 0;
  const offCount = zoneStates ? Array.from(zoneStates.values()).filter(v => v === 'off').length : 0;

  return (
    <div className="map-container">
      <div id="leaflet-map" />

      <div className="map-hud">
        {/* Scraping status pill */}
        <div
          className={`scraping-status-indicator ${isScraped ? 'scraped-live' : 'scraped-mock'}`}
          dir={dir}
          onClick={() => setShowScrapeInfo(p => !p)}
        >
          <span className={`status-pulse-dot ${isScraped ? 'green' : 'amber'}`} />
          <span className="status-label">
            {isScraped ? '📡 SCRAPED LIVE' : '⚠️ DEMO DATA'}
          </span>
          <span className="status-sub">({isScraped ? 'famma-dhaw.com' : 'Simulated'})</span>
        </div>

        {showScrapeInfo && (
          <div className="scraping-info-card anim-fade-up" dir={dir}>
            <div className="scraping-info-header">
              <strong>Data Fetching Status</strong>
              <button onClick={() => setShowScrapeInfo(false)}>✕</button>
            </div>
            <div className="scraping-info-body">
              <div className="info-row"><span>Method:</span><strong>{isScraped ? 'REST API (famma-dhaw)' : 'Local Fallback'}</strong></div>
              <div className="info-row"><span>Endpoint:</span><code>zone_board</code></div>
              <div className="info-row"><span>Poll:</span><strong>Every 5s</strong></div>
              {lastScrapedTime && <div className="info-row"><span>Last scraped:</span><strong>{lastScrapedTime}</strong></div>}
              <div className="info-row"><span>Status:</span><span style={{ color: isScraped ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{isScraped ? '🟢 Active' : '🟡 Fallback'}</span></div>
            </div>
            {loadError && (
              <div style={{ marginTop: 8, fontSize: 10, color: '#f59e0b', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                ⚠️ {loadError}
              </div>
            )}
          </div>
        )}

        {/* ADM3 load error */}
        {loadError && !showScrapeInfo && (
          <div style={{
            position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 8, padding: '6px 14px', fontSize: 11, color: '#f59e0b',
            zIndex: 920, whiteSpace: 'nowrap', maxWidth: '90vw',
          }}>
            ⚠️ {loadError}
          </div>
        )}

        {/* Tile switcher */}
        <div className="tile-switcher" dir={dir}>
          {(['osm', 'light', 'satellite'] as const).map(k => (
            <button
              key={k}
              className={`tile-btn ${tileKey === k ? 'active' : ''}`}
              onClick={() => setTileKey(k)}
            >
              {k === 'osm' ? 'OSM' : k === 'light' ? 'Light' : 'Sat'}
            </button>
          ))}
        </div>

        {/* Locate me */}
        <button className="locate-btn" dir={dir} onClick={() => mapRef.current?.locate({ setView: true, maxZoom: 10 })}>
          📍 {t(lang, 'locateMe')}
        </button>

        {/* Edit hint */}
        <div style={{
          position: 'absolute', bottom: 56, right: 12, background: 'rgba(18,21,31,0.85)',
          backdropFilter: 'blur(10px)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '6px 12px', fontSize: 10, color: 'var(--text-secondary)', zIndex: 900,
        }}>
          ✏️ Click any region to edit / assign its name
        </div>

        {/* Legend */}
        <div className="map-legend" dir={dir}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4 }}>State</div>
          {[['#22c55e', 'on'], ['#ef4444', 'off'], ['#f59e0b', 'contested'], ['#374151', 'no_data']].map(([col, s]) => (
            <div key={s} className="legend-item">
              <span className="legend-dot" style={{ background: col }} />
              <span style={{ fontSize: 11 }}>{t(lang, s as any) || s}</span>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="map-stats-bar" dir={dir}>
          <div className="map-stat map-stat-on">
            <span className="map-stat-dot" />
            <span>{onCount} {t(lang, 'on')}</span>
          </div>
          <div className="map-stat map-stat-off">
            <span className="map-stat-dot" />
            <span>{offCount} {t(lang, 'off')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
