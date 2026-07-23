// convert-shp.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Converts: shp/tun_admbnda_adm3_ins_20221115.shp  → src/data/tunisia_adm3.ts
//
// Run from the project root:
//   node scripts/convert-shp.mjs
//
// First install the parser if not present:
//   npm install shapefile
// ─────────────────────────────────────────────────────────────────────────────

import shapefile from 'shapefile';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHP = path.resolve(__dirname, '../shp/tun_admbnda_adm3_ins_20221115.shp');
const DBF = path.resolve(__dirname, '../shp/tun_admbnda_adm3_ins_20221115.dbf');
const OUT = path.resolve(__dirname, '../src/data/tunisia_adm3.ts');

// ── Geometry simplification (Douglas-Peucker lite) ───────────────────────────
function distance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

function perpendicularDist(point, lineStart, lineEnd) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  if (dx === 0 && dy === 0) return distance(point, lineStart);
  const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (dx * dx + dy * dy);
  return distance(point, [lineStart[0] + t * dx, lineStart[1] + t * dy]);
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let maxIdx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDist(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist > epsilon) {
    return [
      ...rdp(points.slice(0, maxIdx + 1), epsilon),
      ...rdp(points.slice(maxIdx), epsilon).slice(1),
    ];
  }
  return [points[0], points[points.length - 1]];
}

function simplifyRing(ring, epsilon = 0.002) {
  const simplified = rdp(ring, epsilon);
  // Ensure ring is closed
  if (simplified.length < 4) return ring; // fallback, too small
  const first = simplified[0];
  const last = simplified[simplified.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) simplified.push([...first]);
  return simplified.map(([x, y]) => [
    Math.round(x * 100000) / 100000,
    Math.round(y * 100000) / 100000,
  ]);
}

function simplifyGeometry(geom, epsilon = 0.002) {
  if (!geom) return geom;
  if (geom.type === 'Polygon') {
    return { ...geom, coordinates: geom.coordinates.map(ring => simplifyRing(ring, epsilon)) };
  }
  if (geom.type === 'MultiPolygon') {
    return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(ring => simplifyRing(ring, epsilon))) };
  }
  return geom;
}

// ── Field normalization ───────────────────────────────────────────────────────
function normStr(s) {
  if (!s || typeof s !== 'string') return '';
  return s.trim().replace(/\0/g, '');
}

// ── Main conversion ───────────────────────────────────────────────────────────
async function convert() {
  console.log('Opening shapefile:', SHP);

  const source = await shapefile.open(SHP, DBF, { encoding: 'utf-8' });
  const features = [];
  let id = 1;

  while (true) {
    const result = await source.read();
    if (result.done) break;

    const f = result.value;
    const p = f.properties || {};

    // Inspect all field names on first record
    if (id === 1) {
      console.log('DBF fields:', Object.keys(p));
      console.log('Sample record:', p);
    }

    // Try to map fields — INS shapefile typically has:
    // ADM3_AR, ADM3_FR, ADM3_EN, ADM2_AR, ADM2_FR (delegation), ADM1_AR, ADM1_FR (governorate)
    // Field names may vary — we extract all and map the best match
    const fieldKeys = Object.keys(p);
    const find = (patterns) => {
      for (const pat of patterns) {
        const k = fieldKeys.find(k => k.toLowerCase().includes(pat));
        if (k) return normStr(p[k]);
      }
      return '';
    };

    const name_ar = find(['adm3_ar', 'name_ar', 'ar_name', 'name3_ar', 'adm3ar']);
    const name_fr = find(['adm3_fr', 'name_fr', 'fr_name', 'name3_fr', 'adm3fr']);
    const name_en = find(['adm3_en', 'name_en', 'en_name', 'name3_en', 'adm3en', 'adm3_fr', 'name_fr']); // fallback to FR
    const gov_ar  = find(['adm1_ar', 'gov_ar', 'gouv_ar', 'adm1ar']);
    const gov_fr  = find(['adm1_fr', 'gov_fr', 'gouv_fr', 'adm1fr', 'adm1_en']);
    const del_ar  = find(['adm2_ar', 'del_ar', 'deleg_ar', 'adm2ar']);
    const del_fr  = find(['adm2_fr', 'del_fr', 'deleg_fr', 'adm2fr', 'adm2_en']);
    const pcode   = find(['adm3pcode', 'pcode', 'adm3_pcode', 'adm3code']);

    features.push({
      type: 'Feature',
      id,
      properties: {
        id,
        pcode: normStr(pcode) || String(id),
        name_ar: name_ar || `منطقة ${id}`,
        name_fr: name_fr || `Région ${id}`,
        name_en: name_en || name_fr || `Region ${id}`,
        gov_ar,
        gov_fr,
        del_ar,
        del_fr,
        // Preserve all original fields for reference
        _raw: p,
      },
      geometry: simplifyGeometry(f.geometry, 0.002),
    });

    id++;
  }

  console.log(`✅ Converted ${features.length} ADM3 regions.`);

  // Print field summary from last record for verification
  if (features.length > 0) {
    console.log('\nSample output (first 3):');
    features.slice(0, 3).forEach(f => {
      console.log(` [${f.id}] AR: ${f.properties.name_ar} | FR: ${f.properties.name_fr} | Gov: ${f.properties.gov_fr}`);
    });
  }

  const geojson = { type: 'FeatureCollection', features };

  // Write TypeScript module export (removes _raw to keep file smaller)
  const cleanFeatures = features.map(f => ({
    ...f,
    properties: {
      id: f.properties.id,
      pcode: f.properties.pcode,
      name_ar: f.properties.name_ar,
      name_fr: f.properties.name_fr,
      name_en: f.properties.name_en,
      gov_ar: f.properties.gov_ar,
      gov_fr: f.properties.gov_fr,
      del_ar: f.properties.del_ar,
      del_fr: f.properties.del_fr,
    }
  }));

  const tsContent = `// AUTO-GENERATED by scripts/convert-shp.mjs
// Source: tun_admbnda_adm3_ins_20221115.shp (Tunisia ADM3 — INS 2022)
// Regions: ${features.length} municipalities / imadas
// License: ODbL (OpenStreetMap contributors)
// DO NOT EDIT MANUALLY — re-run: node scripts/convert-shp.mjs

export const TUNISIA_ADM3_GEOJSON: {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: number;
    properties: {
      id: number;
      pcode: string;
      name_ar: string;
      name_fr: string;
      name_en: string;
      gov_ar: string;
      gov_fr: string;
      del_ar: string;
      del_fr: string;
    };
    geometry: GeoJSON.Geometry;
  }>;
} = ${JSON.stringify({ type: 'FeatureCollection', features: cleanFeatures }, null, 0)};
`;

  fs.writeFileSync(OUT, tsContent, 'utf-8');
  console.log(`\n✅ Written to: ${OUT}`);
  console.log(`   File size: ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
}

convert().catch(e => {
  console.error('Conversion failed:', e.message);
  process.exit(1);
});
