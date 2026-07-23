import { useState } from 'react';
import type { Lang } from '../types';
import { t } from '../i18n';
import { generateMockHistory } from '../data';

interface StatsTabProps {
  lang: Lang;
  zones: { slug: string; name_ar: string; name_en: string; name_fr: string; governorate: string; on_count: number; off_count: number; state: string }[];
}

const RANGES = ['24h', '7d', '30d', '90d'];

// Simple bar chart using SVG
function BarChart({ data, lang }: { data: { label: string; value: number; color: string }[]; lang: Lang }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barH = 180;
  const barW = Math.max(20, Math.floor(600 / data.length) - 4);
  const visible = data.slice(0, 20);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(600, visible.length * (barW + 4))} height={barH + 40} style={{ display: 'block' }}>
        {visible.map((d, i) => {
          const h = Math.max(2, (d.value / maxVal) * barH);
          const x = i * (barW + 4);
          const y = barH - h;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barW} height={h} fill={d.color} rx={3} opacity={0.85} />
              <text x={x + barW / 2} y={barH + 14} textAnchor="middle" fill="#8892a4" fontSize={9} fontFamily="inherit">
                {d.label.slice(0, 8)}
              </text>
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fill={d.color} fontSize={9} fontFamily="inherit">
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Simple line chart using SVG
function LineChart({ data, lang }: { data: { x: number; y: number }[]; label: string; lang: Lang }) {
  if (!data.length) return null;
  const W = 580;
  const H = 150;
  const maxY = Math.max(...data.map((d) => d.y), 1);
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (d.y / maxY) * H,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fillD = `${pathD} L ${W} ${H} L 0 ${H} Z`;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H + 20} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b9eff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#3b9eff" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#lineGrad)" />
        <path d={pathD} fill="none" stroke="#3b9eff" strokeWidth={2} />
        {pts.filter((_, i) => i % Math.ceil(pts.length / 6) === 0).map((p, i) => (
          <text key={i} x={p.x} y={H + 14} textAnchor="middle" fill="#8892a4" fontSize={9} fontFamily="inherit">
            {data[i * Math.ceil(pts.length / 6)]?.x ?? ''}h
          </text>
        ))}
      </svg>
    </div>
  );
}

// Heatmap (7 days × 24 hours)
function HeatmapChart({ lang }: { lang: Lang }) {
  const DAYS = lang === 'ar'
    ? ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
    : lang === 'fr'
    ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Generate pseudo-random data seeded consistently
  const grid = DAYS.map((_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const seed = d * 31 + h * 7;
      const base = h >= 14 && h <= 22 ? 0.5 : 0.15;
      return Math.min(1, base + ((seed * 6364136223846793005n + 1442695040888963407n) % 100n) as unknown as number / 300);
    })
  );

  const cellW = 22;
  const cellH = 20;
  const labelW = 34;
  const W = labelW + 24 * cellW + 40;
  const H = 7 * cellH + 30;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {/* Hour labels */}
        {Array.from({ length: 24 }, (_, h) => (
          h % 4 === 0 && (
            <text key={h} x={labelW + h * cellW + cellW / 2} y={14} textAnchor="middle" fill="#4a5468" fontSize={9} fontFamily="inherit">
              {h}h
            </text>
          )
        ))}

        {grid.map((row, d) =>
          row.map((val, h) => {
            const r = Math.floor(239 * val);
            const g = Math.floor(68 * val + (1 - val) * 34);
            const b = Math.floor(68 * val);
            const alpha = Math.max(0.1, val);
            return (
              <g key={`${d}-${h}`}>
                <rect
                  x={labelW + h * cellW}
                  y={18 + d * cellH}
                  width={cellW - 1}
                  height={cellH - 1}
                  fill={`rgba(${r},${g},${b},${alpha})`}
                  rx={2}
                />
              </g>
            );
          })
        )}

        {/* Day labels */}
        {DAYS.map((day, d) => (
          <text key={day} x={labelW - 2} y={18 + d * cellH + cellH / 2 + 4} textAnchor="end" fill="#8892a4" fontSize={9} fontFamily="inherit">
            {day}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function StatsTab({ lang, zones }: StatsTabProps) {
  const [range, setRange] = useState('7d');
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const regionName = (z: typeof zones[0]) =>
    lang === 'ar' ? z.name_ar : lang === 'fr' ? z.name_fr : z.name_en;

  // Bar chart data: off count per zone (top 20)
  const barData = [...zones]
    .sort((a, b) => b.off_count - a.off_count)
    .slice(0, 20)
    .map((z) => ({
      label: regionName(z),
      value: z.off_count * (range === '7d' ? 60 : range === '30d' ? 300 : range === '90d' ? 900 : 10),
      color: '#ef4444',
    }));

  // Timeline line chart (mock 48 hourly points)
  const lineData = Array.from({ length: 48 }, (_, i) => {
    const seed = i * 13 + 7;
    return {
      x: i,
      y: Math.floor(Math.abs(Math.sin(i / 4 + 1) * 12) + Math.abs(Math.cos(i / 7) * 8) + (seed % 5)),
    };
  });

  // Summary counts
  const totalOn = zones.filter((z) => z.state === 'on').length;
  const totalOff = zones.filter((z) => z.state === 'off').length;
  const totalNoData = zones.filter((z) => z.state === 'no_data').length;

  const exportCsv = () => {
    const rows = [
      ['slug', 'name', 'on_count', 'off_count', 'state'].join(','),
      ...zones.map((z) =>
        [z.slug, regionName(z), z.on_count, z.off_count, z.state].join(',')
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tunisianh-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="stats-panel" dir={dir}>
      <div className="stats-header">
        <div className="stats-title">📊 {t(lang, 'stats')}</div>
        <div className="date-range-btns">
          {RANGES.map((r) => (
            <button
              key={r}
              className={`date-range-btn ${range === r ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <button className="export-btn" onClick={exportCsv}>
          ⬇ {t(lang, 'exportCsv')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-card-val on">{totalOn}</div>
          <div className="summary-card-label">💡 {t(lang, 'on')}</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-val off">{totalOff}</div>
          <div className="summary-card-label">🔌 {t(lang, 'off')}</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-val neutral">{zones.length}</div>
          <div className="summary-card-label">🗺 Total</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-val" style={{ color: '#6b7280' }}>{totalNoData}</div>
          <div className="summary-card-label">— {t(lang, 'no_data')}</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="stats-grid">
        {/* Outage ranking */}
        <div className="chart-card" style={{ gridColumn: 'span 2' }}>
          <div className="chart-card-header">
            <div className="chart-card-title">🔌 {t(lang, 'outageRanking')}</div>
            <button className="export-btn" onClick={exportCsv}>⬇ CSV</button>
          </div>
          <BarChart data={barData} lang={lang} />
        </div>

        {/* Timeline */}
        <div className="chart-card" style={{ gridColumn: 'span 2' }}>
          <div className="chart-card-header">
            <div className="chart-card-title">📈 {t(lang, 'outageTimeline')}</div>
          </div>
          <LineChart data={lineData} label={t(lang, 'regionsOff')} lang={lang} />
        </div>

        {/* Heatmap */}
        <div className="chart-card" style={{ gridColumn: 'span 2' }}>
          <div className="chart-card-header">
            <div className="chart-card-title">🌡 {t(lang, 'heatmap')} — {t(lang, 'pctOff')}</div>
          </div>
          <HeatmapChart lang={lang} />
        </div>

        {/* Top 20 outage regions table */}
        <div className="chart-card" style={{ gridColumn: 'span 2' }}>
          <div className="chart-card-header">
            <div className="chart-card-title">🏆 {t(lang, 'outageRanking')}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: lang === 'ar' ? 'right' : 'left', fontWeight: 600 }}>#</th>
                  <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: lang === 'ar' ? 'right' : 'left', fontWeight: 600 }}>{t(lang, 'delegation')}</th>
                  <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>OFF</th>
                  <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>ON</th>
                  <th style={{ padding: '6px 8px', color: 'var(--text-muted)', textAlign: 'right', fontWeight: 600 }}>State</th>
                </tr>
              </thead>
              <tbody>
                {[...zones]
                  .sort((a, b) => b.off_count - a.off_count)
                  .slice(0, 15)
                  .map((z, i) => (
                    <tr key={z.slug} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ padding: '7px 8px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {regionName(z)}
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{z.governorate}</div>
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--off-color)', fontWeight: 700 }}>{z.off_count}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--on-color)', fontWeight: 700 }}>{z.on_count}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                        <span style={{
                          background: z.state === 'on' ? 'var(--on-bg)' : z.state === 'off' ? 'var(--off-bg)' : 'var(--nodata-bg)',
                          color: z.state === 'on' ? 'var(--on-color)' : z.state === 'off' ? 'var(--off-color)' : 'var(--nodata-color)',
                          borderRadius: 10,
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                        }}>
                          {t(lang, z.state === 'no_data' ? 'no_data' : z.state)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
