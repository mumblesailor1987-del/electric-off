import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import type { LiveZoneState, Lang } from '../types';
import { RegionPopup } from './RegionPopup';
import { createRoot } from 'react-dom/client';
import { t } from '../i18n';
import { TUNISIA_GEOJSON } from '../data/tunisia_geojson';

// State → color
function stateColor(state: LiveZoneState['state']): string {
  if (state === 'on') return '#22c55e';
  if (state === 'off') return '#ef4444';
  if (state === 'contested') return '#f59e0b';
  return '#374151';
}

function stateOpacity(state: LiveZoneState['state']): number {
  if (state === 'no_data') return 0.25;
  return 0.55;
}

interface MapViewProps {
  zones: LiveZoneState[];
  lang: Lang;
  isReplay: boolean;
  estimateMode: boolean;
  isScraped: boolean;
  sourceUrl: string;
  lastScrapedTime: string | null;
  onToast: (msg: string, isError?: boolean) => void;
}

interface TileOption {
  url: string;
  attr: string;
  label: string;
}

const TILES: Record<string, TileOption> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© OpenStreetMap contributors',
    label: 'OSM',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attr: '© OpenStreetMap contributors © CARTO',
    label: 'Light',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: '© Esri',
    label: 'Satellite',
  },
};

export function MapView({
  zones,
  lang,
  isReplay,
  estimateMode,
  isScraped,
  sourceUrl,
  lastScrapedTime,
  onToast,
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const popupRootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const [selectedZone, setSelectedZone] = useState<LiveZoneState | null>(null);
  const [tileKey, setTileKey] = useState<keyof typeof TILES>('osm');
  const [showSourceInfo, setShowSourceInfo] = useState(false);

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map('leaflet-map', {
      center: [34.0, 9.5], // Center of Tunisia
      zoom: 6,
      minZoom: 5,
      maxZoom: 14,
      zoomControl: true,
    });

    const tile = TILES.osm;
    tileLayerRef.current = L.tileLayer(tile.url, { attribution: tile.attr, maxZoom: 19 });
    tileLayerRef.current.addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch tile layer
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const tile = TILES[tileKey];
    tileLayerRef.current = L.tileLayer(tile.url, { attribution: tile.attr, maxZoom: 19 });
    tileLayerRef.current.addTo(map);
  }, [tileKey]);

  // Build GeoJSON Area Delimitations (Polygons for Tunisia regions)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove old layer
    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }

    // Map zone states by slug or name
    const zoneMap = new Map<string, LiveZoneState>();
    zones.forEach((z) => {
      zoneMap.set(z.slug.toLowerCase(), z);
      zoneMap.set(z.governorate.toLowerCase(), z);
      zoneMap.set(z.delegation.toLowerCase(), z);
    });

    // Create GeoJSON layer with area polygon delimitations
    const geoLayer = L.geoJSON(TUNISIA_GEOJSON, {
      style: (feature) => {
        const govName = feature?.properties?.gov?.toLowerCase() || '';
        const matchedZone = zoneMap.get(govName);
        const state = matchedZone ? matchedZone.state : 'no_data';
        const col = stateColor(state);
        const opa = stateOpacity(state);

        return {
          color: col,
          weight: 2,
          opacity: 0.9,
          fillColor: col,
          fillOpacity: opa,
        };
      },
      onEachFeature: (feature, layer) => {
        const govName = feature.properties.gov;
        const matchedZone = zoneMap.get(govName.toLowerCase()) || {
          slug: govName.toLowerCase(),
          governorate: govName,
          delegation: govName,
          name_ar: feature.properties.name_ar || govName,
          name_fr: feature.properties.name_fr || govName,
          name_en: govName,
          lat: 0,
          lng: 0,
          on_count: 0,
          off_count: 0,
          state: 'no_data' as const,
          last_update_ts: null,
          scraped_on: 0,
          scraped_off: 0,
          local_on: 0,
          local_off: 0,
        };

        const titleName =
          lang === 'ar'
            ? matchedZone.name_ar
            : lang === 'fr'
            ? matchedZone.name_fr
            : matchedZone.name_en;

        const stateIcon = matchedZone.state === 'on' ? '💡' : matchedZone.state === 'off' ? '🔌' : '—';
        layer.bindTooltip(
          `<b>${titleName}</b> (${govName})<br/>State: ${stateIcon} ${matchedZone.state.toUpperCase()}<br/><small>Click to view details & report</small>`,
          { permanent: false, className: 'leaflet-tooltip-dark' }
        );

        // Hover & Click events
        layer.on({
          mouseover: (e) => {
            const l = e.target;
            l.setStyle({
              weight: 4,
              color: '#ffffff',
              fillOpacity: 0.8,
            });
            l.bringToFront();
          },
          mouseout: (e) => {
            geoLayer.resetStyle(e.target);
          },
          click: (e) => {
            const bounds = (layer as L.Polygon).getBounds();
            const center = bounds.getCenter();
            const z: LiveZoneState = {
              ...matchedZone,
              lat: center.lat,
              lng: center.lng,
            };
            setSelectedZone(z);
          },
        });
      },
    });

    // Render user-defined regions as Leaflet Circles
    const userCircles: L.Circle[] = [];
    zones
      .filter((z) => z.slug.startsWith('u-') || z.geometry_type === 'circle')
      .forEach((z) => {
        const col = stateColor(z.state);
        const opa = stateOpacity(z.state);
        const circle = L.circle([z.lat || 36.8065, z.lng || 10.1815], {
          radius: z.radius_m || 1000,
          color: col,
          weight: 2,
          fillColor: col,
          fillOpacity: opa,
          dashArray: z.verified ? undefined : '4, 4', // Dashed border if pending verification
        });

        const nameStr = lang === 'ar' ? z.name_ar : lang === 'fr' ? z.name_fr : z.name_en;
        circle.bindTooltip(
          `<b>📍 ${nameStr}</b> (User Region ${z.verified ? '' : '⌛ Pending'})<br/>State: ${z.state.toUpperCase()}`,
          { permanent: false, className: 'leaflet-tooltip-dark' }
        );

        circle.on('click', () => {
          setSelectedZone(z);
        });

        circle.addTo(map);
        userCircles.push(circle);
      });

    geoLayer.addTo(map);
    geojsonLayerRef.current = geoLayer;

    return () => {
      if (geojsonLayerRef.current) {
        map.removeLayer(geojsonLayerRef.current);
      }
      userCircles.forEach((c) => map.removeLayer(c));
    };
  }, [zones, lang, estimateMode]);

  // Handle popup display
  const handleClosePopup = useCallback(() => {
    setSelectedZone(null);
  }, []);

  // Popup via vanilla L.popup
  useEffect(() => {
    if (!mapRef.current || !selectedZone) return;
    const map = mapRef.current;

    let lat = selectedZone.lat || 34.0;
    let lng = selectedZone.lng || 9.5;

    const container = document.createElement('div');
    const popup = L.popup({
      maxWidth: 340,
      className: 'tunisianh-popup',
      closeButton: true,
    })
      .setLatLng([lat, lng])
      .setContent(container)
      .openOn(map);

    popup.on('remove', handleClosePopup);

    if (popupRootRef.current) {
      popupRootRef.current.unmount();
    }
    popupRootRef.current = createRoot(container);
    popupRootRef.current.render(
      <RegionPopup
        zone={selectedZone}
        lang={lang}
        onClose={handleClosePopup}
        onToast={onToast}
      />
    );
  }, [selectedZone, lang, handleClosePopup, onToast]);

  // Locate me
  const handleLocate = () => {
    if (!mapRef.current) return;
    mapRef.current.locate({ setView: true, maxZoom: 8 });
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="map-container">
      <div id="leaflet-map" />

      <div className="map-hud">
        {/* Scraping Status Badge Indicator */}
        <div
          className={`scraping-status-indicator ${isScraped ? 'scraped-live' : 'scraped-mock'}`}
          dir={dir}
          onClick={() => setShowSourceInfo((prev) => !prev)}
          title="Click to view scraping details"
        >
          <span className={`status-pulse-dot ${isScraped ? 'green' : 'amber'}`} />
          <span className="status-label">
            {isScraped ? '📡 SCRAPED LIVE DATA' : '⚠️ DEMO / FALLBACK DATA'}
          </span>
          <span className="status-sub">({isScraped ? 'famma-dhaw.com API' : 'Simulated'})</span>
        </div>

        {/* Detailed Source Modal Dropdown */}
        {showSourceInfo && (
          <div className="scraping-info-card anim-fade-up" dir={dir}>
            <div className="scraping-info-header">
              <strong>Data Fetching Status</strong>
              <button onClick={() => setShowSourceInfo(false)}>✕</button>
            </div>
            <div className="scraping-info-body">
              <div className="info-row">
                <span>Method:</span>
                <strong>{isScraped ? 'REST API Scraping' : 'Local Fallback'}</strong>
              </div>
              <div className="info-row">
                <span>Target:</span>
                <code>famma-dhaw.com / zone_board</code>
              </div>
              <div className="info-row">
                <span>Status:</span>
                <span style={{ color: isScraped ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>
                  {isScraped ? '🟢 Active & Polling (5s)' : '🟡 Fallback Mode Active'}
                </span>
              </div>
              <div className="info-row">
                <span>Regions Mapped:</span>
                <strong>24 Governorates (Area Delimitations)</strong>
              </div>
            </div>
          </div>
        )}

        {/* Tile switcher */}
        <div className="tile-switcher" dir={dir}>
          {(Object.keys(TILES) as Array<keyof typeof TILES>).map((k) => (
            <button
              key={k}
              className={`tile-btn ${tileKey === k ? 'active' : ''}`}
              onClick={() => setTileKey(k)}
            >
              {t(lang, `tile${k.charAt(0).toUpperCase() + k.slice(1)}` as any) || TILES[k].label}
            </button>
          ))}
        </div>

        {/* Locate me */}
        <button className="locate-btn" onClick={handleLocate} dir={dir}>
          📍 {t(lang, 'locateMe')}
        </button>

        {/* Legend */}
        <div className="map-legend" dir={dir}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, color: 'var(--text-primary)' }}>
            Region State
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#22c55e' }} />
            <span>{t(lang, 'on')}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#ef4444' }} />
            <span>{t(lang, 'off')}</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#374151' }} />
            <span>{t(lang, 'no_data')}</span>
          </div>
          {isReplay && (
            <div className="legend-item">
              <span className="legend-dot" style={{ background: '#7c3aed' }} />
              <span>{t(lang, 'replayBadge')}</span>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="map-stats-bar" dir={dir}>
          <div className="map-stat map-stat-on">
            <span className="map-stat-dot" />
            <span>{zones.filter((z) => z.state === 'on').length} {t(lang, 'on')}</span>
          </div>
          <div className="map-stat map-stat-off">
            <span className="map-stat-dot" />
            <span>{zones.filter((z) => z.state === 'off').length} {t(lang, 'off')}</span>
          </div>
          <div className="map-stat map-stat-nodata">
            <span className="map-stat-dot" />
            <span>{zones.filter((z) => z.state === 'no_data').length} {t(lang, 'no_data')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
