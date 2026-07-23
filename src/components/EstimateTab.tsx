import type { LiveZoneState, Lang } from '../types';
import { t } from '../i18n';
import { getConfidenceLabel } from '../data';

interface EstimateOverlayProps {
  lang: Lang;
  zones: LiveZoneState[];
}

// Estimation: probabilistic state in 1 hour based on current state + hour-of-day
function estimateState(zone: LiveZoneState): { state: 'on' | 'off' | 'no_data'; confidence: number; reasoning: string } {
  const h = new Date().getHours();
  const isPeakHour = h >= 14 && h <= 22;

  if (zone.state === 'no_data') {
    return { state: 'no_data', confidence: 0.3, reasoning: 'insufficient data' };
  }

  let probOff = zone.state === 'off' ? 0.7 : 0.2;
  if (isPeakHour) probOff += 0.15;
  if (zone.off_count > zone.on_count * 2) probOff += 0.1;

  probOff = Math.min(Math.max(probOff, 0.05), 0.95);
  const confidence = Math.abs(probOff - 0.5) * 2 + 0.3;

  return {
    state: probOff > 0.5 ? 'off' : 'on',
    confidence: Math.min(confidence, 1),
    reasoning: isPeakHour ? 'Peak summer hours (14h-22h)' : 'Based on current reports',
  };
}

export function EstimateOverlay({ lang, zones }: EstimateOverlayProps) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const estimatedOffCount = zones.filter((z) => estimateState(z).state === 'off').length;
  const estimatedOnCount = zones.filter((z) => estimateState(z).state === 'on').length;

  return (
    <div className="estimate-overlay anim-slide-in" dir={dir}>
      <div className="estimate-title">🔮 {t(lang, 'estimate')}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {t(lang, 'estimatedState')}
      </div>

      <div className="estimate-legend-item">
        <span className="estimate-legend-dot" style={{ background: '#22c55e' }} />
        <span>{t(lang, 'on')}: <strong style={{ color: 'var(--on-color)' }}>{estimatedOnCount}</strong></span>
      </div>
      <div className="estimate-legend-item">
        <span className="estimate-legend-dot" style={{ background: '#ef4444' }} />
        <span>{t(lang, 'off')}: <strong style={{ color: 'var(--off-color)' }}>{estimatedOffCount}</strong></span>
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        v1-historical-baseline · {new Date().getHours()}h
      </div>
    </div>
  );
}

// EstimateTab - full page
interface EstimateTabProps {
  lang: Lang;
  zones: LiveZoneState[];
}

export function EstimateTab({ lang, zones }: EstimateTabProps) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const estimated = zones.map((z) => ({ zone: z, est: estimateState(z) }));
  const offEst = estimated.filter((e) => e.est.state === 'off');
  const onEst = estimated.filter((e) => e.est.state === 'on');

  const regionName = (z: LiveZoneState) =>
    lang === 'ar' ? z.name_ar : lang === 'fr' ? z.name_fr : z.name_en;

  return (
    <div className="stats-panel" dir={dir}>
      <div className="stats-header">
        <div className="stats-title">🔮 {t(lang, 'estimate')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {t(lang, 'estimatedState')}
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-card-val off">{offEst.length}</div>
          <div className="summary-card-label">🔌 Est. {t(lang, 'off')}</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-val on">{onEst.length}</div>
          <div className="summary-card-label">💡 Est. {t(lang, 'on')}</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-val neutral">
            {Math.round((estimated.reduce((a, e) => a + e.est.confidence, 0) / estimated.length) * 100)}%
          </div>
          <div className="summary-card-label">📊 Avg. {t(lang, 'confidence')}</div>
        </div>
      </div>

      {/* Top predicted-off regions */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div className="chart-card-title">🔌 Predicted OFF — next hour</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: lang === 'ar' ? 'right' : 'left', fontWeight: 600 }}>Region</th>
                <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>Now</th>
                <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>+1h Est.</th>
                <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>{t(lang, 'confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {estimated
                .sort((a, b) => b.est.confidence - a.est.confidence)
                .slice(0, 20)
                .map(({ zone, est }) => (
                  <tr key={zone.slug} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '7px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {regionName(zone)}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{zone.governorate}</div>
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                      <span style={{
                        color: zone.state === 'on' ? 'var(--on-color)' : zone.state === 'off' ? 'var(--off-color)' : 'var(--nodata-color)',
                        fontWeight: 700,
                        fontSize: 11,
                      }}>
                        {t(lang, zone.state === 'no_data' ? 'no_data' : zone.state)}
                      </span>
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                      <span style={{
                        background: est.state === 'on' ? 'var(--on-bg)' : est.state === 'off' ? 'var(--off-bg)' : 'var(--nodata-bg)',
                        color: est.state === 'on' ? 'var(--on-color)' : est.state === 'off' ? 'var(--off-color)' : 'var(--nodata-color)',
                        borderRadius: 10,
                        padding: '2px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                      }}>
                        {t(lang, est.state === 'no_data' ? 'no_data' : est.state)}
                      </span>
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <div style={{
                          width: 40,
                          height: 4,
                          background: 'var(--bg-base)',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${est.confidence * 100}%`,
                            height: '100%',
                            background: est.confidence > 0.7 ? 'var(--on-color)' : est.confidence > 0.5 ? '#f59e0b' : 'var(--off-color)',
                            borderRadius: 2,
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{Math.round(est.confidence * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology note */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px',
        fontSize: 12,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          📐 {t(lang, 'methodology')} — v1-historical-baseline
        </div>
        The algorithm estimates the electricity state in 1 hour using:
        <ul style={{ paddingLeft: 16, marginTop: 6, lineHeight: 2 }}>
          <li><strong>Current state weight</strong>: current OFF → 70% chance stays OFF</li>
          <li><strong>Peak hours bonus</strong>: +15% OFF probability 14h–22h (summer load-shedding peak)</li>
          <li><strong>Vote imbalance</strong>: if off_count {'>'} 2× on_count, +10% OFF</li>
          <li><strong>No ML</strong>: classical statistics only, fully auditable</li>
        </ul>
      </div>
    </div>
  );
}
