import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import type { LiveZoneState, Lang } from '../types';
import { RegionPopup } from './RegionPopup';
import { createRoot } from 'react-dom/client';
import { t } from '../i18n';

// State → color
function stateColor(state: LiveZoneState['state']): string {
  if (state === 'on') return '#22c55e';
  if (state === 'off') return '#ef4444';
  if (state === 'contested') return '#f59e0b';
  return '#374151';
}

function stateOpacity(state: LiveZoneState['state']): number {
  if (state === 'no_data') return 0.3;
  return 0.75;
}

interface MapViewProps {
  zones: LiveZoneState[];
  lang: Lang;
  isReplay: boolean;
  estimateMode: boolean;
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

export function MapView({ zones, lang, isReplay, estimateMode, onToast }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const geojsonLayerRef = useRef<L.GeoJSON | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const popupRootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const [selectedZone, setSelectedZone] = useState<LiveZoneState | null>(null);
  const [tileKey, setTileKey] = useState<keyof typeof TILES>('osm');

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map('leaflet-map', {
      center: [33.8869, 9.5375], // Tunisia center
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

  // Build a simple circle-marker layer since we don't have GeoJSON polygons yet
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove old layer
    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }

    if (zones.length === 0) return;

    // Filter zones that have lat/lng (from famma-dhaw data they may not)
    // We'll use Tunisia governorate approximate centroids for display
    const govCentroids: Record<string, [number, number]> = {
      'Tunis': [36.8065, 10.1815],
      'Ariana': [36.8625, 10.1956],
      'Ben Arous': [36.7533, 10.2282],
      'Manouba': [36.8100, 10.0975],
      'Nabeul': [36.4513, 10.7357],
      'Zaghouan': [36.4020, 10.1423],
      'Bizerte': [37.2744, 9.8739],
      'Béja': [36.7256, 9.1817],
      'Jendouba': [36.5011, 8.7803],
      'Le Kef': [36.1826, 8.7149],
      'Siliana': [36.0849, 9.3708],
      'Sousse': [35.8288, 10.6405],
      'Monastir': [35.7643, 10.8113],
      'Mahdia': [35.5047, 11.0622],
      'Sfax': [34.7406, 10.7603],
      'Kairouan': [35.6712, 10.1005],
      'Kasserine': [35.1675, 8.8366],
      'Sidi Bouzid': [35.0382, 9.4840],
      'Gabès': [33.8814, 10.0982],
      'Médenine': [33.3549, 10.5055],
      'Tataouine': [32.9211, 10.4507],
      'Gafsa': [34.4250, 8.7842],
      'Tozeur': [33.9197, 8.1335],
      'Kébili': [33.7049, 8.9689],
    };

    const markers: L.CircleMarker[] = [];

    zones.forEach((zone) => {
      // Try to find centroid for this zone's governorate
      let lat = zone.lat;
      let lng = zone.lng;

      if (!lat || !lng) {
        // Match governorate name
        const govKey = Object.keys(govCentroids).find(
          (k) =>
            zone.governorate?.toLowerCase().includes(k.toLowerCase()) ||
            k.toLowerCase().includes(zone.governorate?.toLowerCase())
        );
        if (govKey) {
          const [gLat, gLng] = govCentroids[govKey];
          // Add small jitter per delegation to avoid perfect overlap
          const seed = zone.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
          lat = gLat + ((seed % 17) - 8) * 0.015;
          lng = gLng + ((seed % 13) - 6) * 0.015;
        } else {
          // Place in Tunisia center with jitter
          const seed = zone.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
          lat = 33.8869 + ((seed % 20) - 10) * 0.15;
          lng = 9.5375 + ((seed % 20) - 10) * 0.15;
        }
      }

      const col = stateColor(zone.state);
      const opa = stateOpacity(zone.state);

      const marker = L.circleMarker([lat, lng], {
        radius: zone.off_count + zone.on_count > 10 ? 14 : 10,
        color: col,
        fillColor: col,
        fillOpacity: opa,
        weight: 2,
        opacity: 0.9,
      });

      const tooltip = lang === 'ar' ? zone.name_ar : lang === 'fr' ? zone.name_fr : zone.name_en;
      marker.bindTooltip(`<b>${tooltip}</b> — ${zone.state === 'on' ? '💡' : zone.state === 'off' ? '🔌' : '—'}`, {
        permanent: false,
        className: 'leaflet-tooltip-dark',
      });

      marker.on('click', () => {
        setSelectedZone(zone);
      });

      marker.addTo(map);
      markers.push(marker);
    });

    return () => {
      markers.forEach((m) => map.removeLayer(m));
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

    let lat = selectedZone.lat;
    let lng = selectedZone.lng;
    if (!lat || !lng) {
      lat = 33.8869;
      lng = 9.5375;
    }

    const container = document.createElement('div');
    const popup = L.popup({
      maxWidth: 320,
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
    mapRef.current.locate({ setView: true, maxZoom: 10 });
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="map-container">
      <div id="leaflet-map" />

      <div className="map-hud">
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
