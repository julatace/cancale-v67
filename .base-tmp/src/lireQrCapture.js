// ── LIRE LE QR D'UNE CAPTURE D'ÉCRAN, DANS LA PAGE (5 nov.) ───────────────────
// La capture de l'app Mondial Relay qu'il choisit sur un colis (« Ajouter le QR »).
// Comme « Scanner » (src/ScannerColis.jsx) : le `BarcodeDetector` du navigateur
// quand il sait lire un QR, sinon jsQR — ici EMBARQUÉ dans l'app (aucun script
// chargé d'ailleurs) : l'image ne quitte jamais l'appareil, aucune IA, aucun serveur.
// Rend la liste des contenus lus ([] = aucun QR), ou null (image pas ouverte).
// Aucune règle ici : le jugement est src/qrCapture.js (`jugerQrCapture`).

const COTE_MAX = 2000;           // une capture d'iPhone (1179 × 2556) est ramenée à 2000 px de haut
const OCTETS_MAX = 30 * 1024 * 1024;

async function versCanvas(fichier) {
  if (!fichier || (typeof fichier.size === 'number' && (fichier.size <= 0 || fichier.size > OCTETS_MAX))) return null;
  let source = null, liberer = () => {};
  try {
    if (typeof createImageBitmap === 'function') { source = await createImageBitmap(fichier); liberer = () => { try { source.close(); } catch (_) {} }; }
  } catch (_) { source = null; }
  if (!source) {
    const url = URL.createObjectURL(fichier);
    try {
      source = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image')); i.src = url; });
    } catch (_) { URL.revokeObjectURL(url); return null; }
    liberer = () => URL.revokeObjectURL(url);
  }
  const w0 = source.width || source.naturalWidth, h0 = source.height || source.naturalHeight;
  if (!w0 || !h0) { liberer(); return null; }
  const k = Math.min(1, COTE_MAX / Math.max(w0, h0));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(source, 0, 0, cv.width, cv.height);
  liberer();
  return cv;
}

export async function lireQrDansCapture(fichier) {
  const cv = await versCanvas(fichier);
  if (!cv) return null;
  // 1. Le détecteur du navigateur (Chrome Android, Safari macOS…), s'il sait le QR.
  try {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      const BD = window.BarcodeDetector;
      const sait = typeof BD.getSupportedFormats === 'function' ? await BD.getSupportedFormats() : null;
      if (!sait || sait.includes('qr_code')) {
        const r = await new BD({ formats: ['qr_code'] }).detect(cv);
        const vals = (r || []).map((x) => x && x.rawValue).filter((s) => typeof s === 'string' && s.length);
        if (vals.length) return [...new Set(vals)];
      }
    }
  } catch (_) { /* détecteur absent ou refusé : jsQR */ }
  // 2. jsQR, dans la page : la capture entière, puis réduite de moitié (un QR très
  //    grand ou très net se lit parfois mieux plus petit).
  try {
    const { default: jsQR } = await import('jsqr');
    const essai = (c) => { const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); const r = jsQR(d.data, c.width, c.height, { inversionAttempts: 'attemptBoth' }); return r && typeof r.data === 'string' && r.data.length ? r.data : ''; };
    let v = essai(cv);
    if (!v && cv.width > 400) {
      const p = document.createElement('canvas'); p.width = Math.round(cv.width / 2); p.height = Math.round(cv.height / 2);
      p.getContext('2d').drawImage(cv, 0, 0, p.width, p.height); v = essai(p);
    }
    return v ? [v] : [];
  } catch (_) { return null; }
}

// Les bibliothèques de la RECOPIE (aller-retour prouvé, src/qrCapture.js), chargées au geste.
export async function bibliothequesRecopie() {
  const [{ default: qrcode }, { default: jsQR }] = await Promise.all([import('qrcode-generator'), import('jsqr')]);
  return { qrcode, jsQR };
}
