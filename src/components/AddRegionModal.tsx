import { useState } from 'react';
import type { Lang } from '../types';
import { t } from '../i18n';
import { addUserRegion } from '../data';

interface AddRegionModalProps {
  lang: Lang;
  onClose: () => void;
  onAdded: (msg: string) => void;
}

export function AddRegionModal({ lang, onClose, onAdded }: AddRegionModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [lat, setLat] = useState<number>(36.8065); // Default to Tunis center
  const [lng, setLng] = useState<number>(10.1815);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [gov, setGov] = useState('Tunis');
  const [radiusM, setRadiusM] = useState<number>(1000);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const GOVERNORATES = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan',
    'Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse',
    'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid',
    'Gabès', 'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn.trim() && !nameAr.trim()) return;

    const slug = 'u-' + (nameEn || nameAr).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);

    addUserRegion({
      slug,
      name_en: nameEn.trim() || nameAr.trim(),
      name_ar: nameAr.trim() || nameEn.trim(),
      name_fr: nameFr.trim() || nameEn.trim(),
      governorate: gov,
      lat,
      lng,
      radius_m: radiusM,
    });

    onAdded(lang === 'ar' ? 'تمت إضافة المنطقة بنجاح!' : 'Region added successfully!');
    onClose();
  };

  return (
    <div className="add-region-overlay" dir={dir}>
      <div className="add-region-modal anim-fade-up">
        <div className="add-region-header">
          <span style={{ fontSize: 16, fontWeight: 800 }}>➕ {lang === 'ar' ? 'إضافة منطقة خاصة' : 'Add Custom Region'}</span>
          <button onClick={onClose} className="close-modal-btn">✕</button>
        </div>

        {step === 1 ? (
          <div className="add-region-body">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {lang === 'ar'
                ? 'الخطوة 1 من 2: حدد موقع المنطقة على الخريطة (خط العرض وخط الطول):'
                : 'Step 1 of 2: Set location coordinates for the custom region:'}
            </div>

            <div className="form-group">
              <label>Latitude (خط العرض):</label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label>Longitude (خط الطول):</label>
              <input
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
              <button className="preset-chip" onClick={() => { setLat(36.8065); setLng(10.1815); setGov('Tunis'); }}>Tunis</button>
              <button className="preset-chip" onClick={() => { setLat(35.8288); setLng(10.6405); setGov('Sousse'); }}>Sousse</button>
              <button className="preset-chip" onClick={() => { setLat(34.7406); setLng(10.7603); setGov('Sfax'); }}>Sfax</button>
              <button className="preset-chip" onClick={() => { setLat(37.2744); setLng(9.8739); setGov('Bizerte'); }}>Bizerte</button>
            </div>

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={onClose}>{t(lang, 'close')}</button>
              <button className="modal-btn primary" onClick={() => setStep(2)}>
                {lang === 'ar' ? 'التالي ←' : 'Next →'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="add-region-body">
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {lang === 'ar'
                ? 'الخطوة 2 من 2: أدخل اسم المنطقة ونصف القطر:'
                : 'Step 2 of 2: Enter region name and circle radius:'}
            </div>

            <div className="form-group">
              <label>Name (English/French) *:</label>
              <input
                type="text"
                required
                placeholder="e.g. El Menzah 9"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>الاسم (بالعربية):</label>
              <input
                type="text"
                placeholder="مثال: المنزه 9"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Governorate (الولاية):</label>
              <select value={gov} onChange={(e) => setGov(e.target.value)}>
                {GOVERNORATES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Circle Radius (نصف القطر):</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {[250, 500, 1000, 2500, 5000].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`preset-chip ${radiusM === r ? 'active' : ''}`}
                    onClick={() => setRadiusM(r)}
                  >
                    {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="modal-btn cancel" onClick={() => setStep(1)}>
                {lang === 'ar' ? '← السابق' : '← Back'}
              </button>
              <button type="submit" className="modal-btn primary">
                {lang === 'ar' ? 'إضافة المنطقة ✅' : 'Submit Region ✅'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
