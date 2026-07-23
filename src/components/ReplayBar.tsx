import { useState, useEffect } from 'react';
import type { LiveZoneState, Lang } from '../types';
import { t } from '../i18n';

interface ReplayBarProps {
  lang: Lang;
  zones: LiveZoneState[];
  onClose: () => void;
  onReplayZones: (zones: LiveZoneState[]) => void;
}

export function ReplayBar({ lang, zones, onClose, onReplayZones }: ReplayBarProps) {
  const now = new Date();
  const defaultDt = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const [dt, setDt] = useState(defaultDt.toISOString().slice(0, 16));
  const [sliderVal, setSliderVal] = useState(60); // 0-120 minutes offset
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const replayTime = new Date(new Date(dt).getTime() + (sliderVal - 60) * 60 * 1000);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setSliderVal((v) => {
        if (v >= 120) { setPlaying(false); return 120; }
        return v + 1;
      });
    }, 1000 / speed * 60);
    return () => clearInterval(interval);
  }, [playing, speed]);

  // Build "replayed" zones by seeded state at replay time
  useEffect(() => {
    const seed = replayTime.getHours() * 60 + replayTime.getMinutes();
    const replayed = zones.map((z) => {
      const zoneSeed = z.slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const combined = (seed + zoneSeed) % 100;
      const isOff = combined < 35;
      return {
        ...z,
        state: isOff ? 'off' as const : 'on' as const,
        on_count: isOff ? Math.floor(combined / 20) : Math.floor(combined / 10),
        off_count: isOff ? Math.floor(combined / 8) : Math.floor(combined / 30),
      };
    });
    onReplayZones(replayed);
  }, [sliderVal, dt]);

  const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : lang === 'fr' ? 'fr-TN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <div className="replay-bar" dir={dir}>
      <span className="replay-badge">
        {t(lang, 'replayBadge')}
      </span>
      <span className="replay-time">{fmt.format(replayTime)}</span>

      <input
        type="datetime-local"
        value={dt}
        onChange={(e) => setDt(e.target.value)}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          padding: '5px 8px',
          fontSize: 12,
          fontFamily: 'inherit',
        }}
      />

      <input
        type="range"
        className="replay-slider"
        min={0}
        max={120}
        value={sliderVal}
        onChange={(e) => setSliderVal(Number(e.target.value))}
        title={`${sliderVal - 60 >= 0 ? '+' : ''}${sliderVal - 60} min`}
      />

      <div className="replay-controls">
        <button className="replay-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? '⏸' : '▶'}
        </button>

        <select
          className="replay-speed-select"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value={1}>1×</option>
          <option value={60}>60×</option>
          <option value={3600}>3600×</option>
        </select>
      </div>

      <button className="replay-close" onClick={onClose} title={t(lang, 'close')}>
        ✕
      </button>
    </div>
  );
}
