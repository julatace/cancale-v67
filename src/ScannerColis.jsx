// ════════════════════════════════════════════════════════════════════════════
//  SCANNER POUR DÉPOSER (3 nov., choix de Julien n° 1) — la feuille caméra.
//  Aucune règle ici : `trouver(brut)` (src/scanColis.js, par le n° de suivi
//  EXACT) dit quel colis ; `onDeposer(colis)` est le geste existant « Déposé »
//  (annulable 5 s, la barre est posée par l'écran). Scans en série : la caméra
//  reste ouverte ; une même lecture ne compte qu'une fois (2,5 s).
//  Lecture : `BarcodeDetector` du navigateur quand il sait le Code 128, sinon
//  ZXing (JavaScript pur, chargé de cdn.jsdelivr.net — autorisé par la CSP,
//  `script-src`), qui lit l'image DANS la page : aucune image n'est envoyée.
//  Le clavier reste toujours là (saisir le n°).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { filtreRepetition } from './scanColis.js';
import './design/scanner.css';

const FORMATS = ['code_128', 'code_39', 'code_93', 'itf', 'ean_13', 'data_matrix', 'qr_code', 'pdf417'];
export const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';

let chargementZx = null;
const chargerZxing = () => {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (chargementZx) return chargementZx;
  chargementZx = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = ZXING_URL; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => (window.ZXing ? ok(window.ZXing) : ko(new Error('absent')));
    s.onerror = () => { chargementZx = null; ko(new Error('chargement')); };
    document.head.appendChild(s);
  });
  return chargementZx;
};

// Un lecteur `{ detect(video) → Promise<[rawValue…]> }`, ou null.
export async function creerLecteur() {
  try {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      const BD = window.BarcodeDetector;
      const sait = typeof BD.getSupportedFormats === 'function' ? await BD.getSupportedFormats() : null;
      if (!sait || sait.includes('code_128')) {
        const d = new BD({ formats: sait ? FORMATS.filter((f) => sait.includes(f)) : FORMATS });
        return { source: 'navigateur', detect: async (v) => ((await d.detect(v)) || []).map((x) => x && x.rawValue).filter(Boolean) };
      }
    }
  } catch (_) { /* détecteur absent ou refusé : ZXing */ }
  try {
    const Z = await chargerZxing();
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.ITF, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.DATA_MATRIX, Z.BarcodeFormat.QR_CODE]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const lecteur = new Z.MultiFormatReader(); lecteur.setHints(hints);
    const cv = document.createElement('canvas');
    return { source: 'zxing', detect: async (v) => {
      const w = v.videoWidth, h = v.videoHeight; if (!w || !h) return [];
      const k = Math.min(1, 1280 / w); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(v, 0, 0, cv.width, cv.height);
      try {
        const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)));
        const r = lecteur.decode(bmp); return r && r.getText ? [r.getText()] : [];
      } catch (_) { return []; } finally { try { lecteur.reset(); } catch (_) {} }
    } };
  } catch (_) { return null; }
}

const vibrer = (motif) => { try { if (navigator.vibrate) navigator.vibrate(motif); } catch (_) {} };

export default function ScannerColis({ trouver, onDeposer, onFermer, attente = null, onAnnuler = null, zIndex = 18000, children = null }) {
  const video = React.useRef(null);
  const [camera, setCamera] = React.useState('demarrage');   // demarrage · active · sans
  const [res, setRes] = React.useState(null);                 // { etat, colis?, n }
  const [saisie, setSaisie] = React.useState('');
  const ref = React.useRef({ trouver, onDeposer }); ref.current.trouver = trouver; ref.current.onDeposer = onDeposer;
  const compte = React.useRef(0);
  const traiter = React.useCallback((brut) => {
    const r = ref.current.trouver(brut) || { etat: 'inconnu' };
    compte.current += 1;
    if (r.etat === 'trouve') { try { ref.current.onDeposer(r.colis); } catch (_) {} vibrer(60); setRes({ etat: 'depose', colis: r.colis, n: compte.current, lu: String(brut) }); }
    else { vibrer([30, 60, 30]); setRes({ etat: r.etat, colis: r.colis || null, n: compte.current, lu: String(brut) }); }
  }, []);
  React.useEffect(() => {
    let vivant = true, flux = null, minuterie = null;
    const nouveau = filtreRepetition(2500);
    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('pas de caméra');
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (!vivant) { flux.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current; if (!v) return;
        v.srcObject = flux; v.setAttribute('playsinline', ''); v.muted = true;
        try { await v.play(); } catch (_) {}
        const lecteur = await creerLecteur();
        if (!vivant) return;
        if (!lecteur) { setCamera('sans'); return; }
        setCamera('active');
        const tour = async () => {
          if (!vivant) return;
          try {
            if (v.readyState >= 2) { const vals = await lecteur.detect(v); for (const x of vals) if (nouveau(x)) traiter(x); }
          } catch (_) {}
          if (vivant) minuterie = setTimeout(tour, 220);
        };
        tour();
      } catch (_) { if (vivant) setCamera('sans'); }
    })();
    return () => { vivant = false; if (minuterie) clearTimeout(minuterie); if (flux) flux.getTracks().forEach((t) => t.stop()); };
  }, [traiter]);
  React.useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onFermer && onFermer(); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [onFermer]);
  const valider = (e) => { e.preventDefault(); const s = saisie.trim(); if (!s) return; traiter(s); setSaisie(''); };
  const c = res && res.colis && !Array.isArray(res.colis) ? res.colis : null;
  const TXT = { depose: 'Déposé', deja: 'Déjà déposé', inconnu: 'Pas trouvé', ambigu: 'Plusieurs colis', vide: 'Pas trouvé' };
  return createPortal(
    <div className="vrm-scan" role="dialog" aria-modal="true" aria-label="Scanner" data-scan-sheet="" data-scan-camera={camera} style={{ zIndex }}>
      {children}
      <div className="vrm-scan-tete">
        <h2>Scanner</h2>
        <button type="button" className="vrm-scan-fermer" data-scan-fermer="" onClick={onFermer} aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div className={'vrm-scan-vue' + (res ? ' is-' + res.etat : '')} key={res ? res.n : 0}>
        <video ref={video} playsInline muted autoPlay aria-hidden="true"/>
        <span className="vrm-scan-viseur" aria-hidden="true"/>
      </div>
      <div className={'vrm-scan-res' + (res && res.etat === 'depose' && attente ? ' a-annuler' : '')} role="status" aria-live="assertive" data-scan-resultat={res ? res.etat : ''} data-scan-cle={c ? String(c.cle) : ''} data-scan-n={res ? res.n : 0}>
        {res ? <>
          <span className={'vrm-scan-etat is-' + res.etat}>{res.etat === 'depose' && !(attente && c && attente.cle === String(c.cle)) ? 'Déposé ✓' : (TXT[res.etat] || 'Pas trouvé')}</span>
          {c ? <span className="vrm-scan-quoi">{c.num ? <b>N°{c.num}</b> : null}<span>{c.titre}</span></span> : <span className="vrm-scan-quoi is-n">{res.lu}</span>}
          {/* « Annuler » (5 s) du dernier « Déposé », DANS la feuille : la barre de l'écran est sous la caméra. */}
          {res.etat === 'depose' && c && attente && attente.cle === String(c.cle) && onAnnuler
            ? <button type="button" className="vrm-scan-annuler" data-depose-annuler={attente.cle} onClick={onAnnuler}>Annuler</button> : null}
        </> : null}
      </div>
      <form className="vrm-scan-saisie" onSubmit={valider}>
        <input data-scan-saisie="" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="N° de suivi" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label="N° de suivi"/>
        <button type="submit" data-scan-ok="" disabled={!saisie.trim()}>OK</button>
      </form>
    </div>,
    document.body
  );
}
