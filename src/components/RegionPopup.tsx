import { useEffect, useRef } from 'react';
import type { LiveZoneState, Lang } from '../types';
import { submitClaim, getCooldownRemaining, getConfidenceLabel, generateMockHistory } from '../data';
import { t } from '../i18n';

interface RegionPopupProps {
  zone: LiveZoneState;
  lang: Lang;
  onClose: () => void;
  onToast: (msg: string, isError?: boolean) => void;
}

function drawSparkline(canvas: HTMLCanvasElement, zone: LiveZoneState) {
  const history = generateMockHistory(zone.slug, 1); // 1 hour
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pts = history.slice(-60).map((h, i) => {
    const x = (i / 59) * W;
    const isOff = h.state === 'off';
    return { x, isOff };
  });

  // Draw bars
  const barW = W / pts.length;
  pts.forEach((p, i) => {
    ctx.fillStyle = p.isOff ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.7)';
    ctx.fillRect(i * barW, p.isOff ? 0 : H / 2, barW - 1, p.isOff ? H / 2 : H / 2);
  });
}

export function RegionPopup({ zone, lang, onClose, onToast }: RegionPopupProps) {
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const cooldownMs = getCooldownRemaining(zone.slug);
  const hasCooldown = cooldownMs > 0;

  useEffect(() => {
    if (sparkRef.current) {
      sparkRef.current.width = sparkRef.current.offsetWidth * window.devicePixelRatio;
      sparkRef.current.height = 40 * window.devicePixelRatio;
      sparkRef.current.style.width = '100%';
      sparkRef.current.style.height = '40px';
      drawSparkline(sparkRef.current, zone);
    }
  }, [zone]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const regionName = lang === 'ar' ? zone.name_ar : lang === 'fr' ? zone.name_fr : zone.name_en;
  const govName = zone.governorate;
  const confidence = getConfidenceLabel(zone.on_count, zone.off_count, lang);

  const handleClaim = async (value: 'on' | 'off') => {
    if (hasCooldown) {
      onToast(t(lang, 'cooldownMsg'), true);
      return;
    }
    await submitClaim(zone.slug, value);
    onToast(t(lang, 'thankYou'));
  };

  const stateColor = zone.state === 'on' ? '#22c55e' : zone.state === 'off' ? '#ef4444' : '#6b7280';
  const stateText = t(lang, zone.state === 'no_data' ? 'no_data' : zone.state);

  return (
    <div className="popup-inner" dir={dir}>
      <div className="popup-header">
        <div>
          <div className="popup-name">{regionName}</div>
          <div className="popup-name-sub">{govName}</div>
        </div>
        <div className={`popup-state-badge ${zone.state}`}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateColor, display: 'inline-block' }} />
          {stateText}
        </div>
      </div>

      <div className="popup-row">
        <span>{t(lang, 'confidence')}</span>
        <strong>{confidence}</strong>
      </div>

      <div className="popup-reports">
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {t(lang, 'reports')}
        </div>
        <div className="popup-report-row">
          <span>💡 {t(lang, 'on')}</span>
          <span className="popup-report-count" style={{ color: 'var(--on-color)' }}>
            {zone.on_count}
            <span className="popup-report-sub"> ({zone.scraped_on} {t(lang, 'scraped')}, {zone.local_on} {t(lang, 'local')})</span>
          </span>
        </div>
        <div className="popup-report-row">
          <span>🔌 {t(lang, 'off')}</span>
          <span className="popup-report-count" style={{ color: 'var(--off-color)' }}>
            {zone.off_count}
            <span className="popup-report-sub"> ({zone.scraped_off} {t(lang, 'scraped')}, {zone.local_off} {t(lang, 'local')})</span>
          </span>
        </div>
      </div>

      <div className="sparkline-wrap">
        <div className="sparkline-label">{t(lang, 'sparkline')}</div>
        <canvas ref={sparkRef} className="sparkline-canvas" />
      </div>

      <div className="claim-btns">
        <button
          className="claim-btn claim-btn-off"
          onClick={() => handleClaim('off')}
          disabled={hasCooldown}
          title={hasCooldown ? t(lang, 'cooldownMsg') : ''}
        >
          {t(lang, 'iHaveNoPower')}
        </button>
        <button
          className="claim-btn claim-btn-on"
          onClick={() => handleClaim('on')}
          disabled={hasCooldown}
          title={hasCooldown ? t(lang, 'cooldownMsg') : ''}
        >
          {t(lang, 'iHavePower')}
        </button>
      </div>

      <div className="popup-links">
        <a className="popup-link" href="#" onClick={(e) => e.preventDefault()}>{t(lang, 'viewHistory')}</a>
        <a className="popup-link" href="#" onClick={(e) => e.preventDefault()}>{t(lang, 'methodology')}</a>
      </div>
    </div>
  );
}
