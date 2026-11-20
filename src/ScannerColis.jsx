// ════════════════════════════════════════════════════════════════════════════
//  SCANNER (3 nov., choix de Julien n° 1 ; 9 nov., lot V : « la paire qu'il doit
//  y avoir dedans », et la même chose pour les ACHATS au point relais).
//  Aucune règle ici : `trouver(brut)` (src/scanColis.js, par le n° de suivi ou le
//  code de retrait EXACT) dit quel colis ; la feuille MONTRE la paire attendue
//  (photo, N°, titre, taille, compte, acheteur/vendeur) et RIEN n'est écrit sans
//  SON toucher : `onConfirmer(colis)` est le geste existant (« Colis fait »
//  différé 5 s avec « Annuler » ; « J'ai retiré » pour un achat). Aucun colis, ou
//  deux ⇒ dit, aucun bouton. Scans en série : la caméra reste ouverte, une même
//  lecture ne compte qu'une fois (2,5 s), la liste « Scannés » garde la série.
//  Lecture : `BarcodeDetector` du navigateur quand il sait le Code 128, sinon
//  ZXing (JavaScript pur, chargé de cdn.jsdelivr.net — autorisé par la CSP,
//  `script-src`), qui lit l'image DANS la page : aucune image n'est envoyée.
//  Le clavier reste toujours là (saisir le n°) ; sans caméra, il prend la main.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { motsVendeur } from './profilVendeur.js';
import { createPortal } from 'react-dom';
import { filtreRepetition } from './scanColis.js';
import { venteDuColis } from './photoCarton.js';
import { BoutonPhotoCarton } from './PhotoCarton.jsx';
import './design/scanner.css';

// (17 nov.) Les formats IMPRIMÉS sur les étiquettes (+ EAN-13 : la boîte, « pas un n° de suivi », dit) : chaque format en plus coûte.
const FORMATS = ['code_128', 'data_matrix', 'qr_code', 'ean_13', 'code_39', 'itf'];
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

// (15 nov.) Les zones lues à tour de rôle par ZXing : le centre (là où l'on vise), puis l'image entière.
// (17 nov., lot scan-instantane) Une zone peut porter `k` : agrandie k fois avant la lecture (lecteur WebAssembly
// seulement). MESURÉ (banc scan-instantane) : un Code 128 tenu loin (1,2 à 1,8 px par module) ne se lit pas tel
// quel — ses barres tombent entre deux pixels —, agrandi ×2 (lissé) il se lit : on vise de deux fois plus loin.
export const ZONES_LECTURE = { zone: [{ x: 0.15, y: 0.3, l: 0.7, h: 0.4 }, { x: 0.2, y: 0.38, l: 0.6, h: 0.24, k: 2 }, null] };

// ── (17 nov., lot scan-instantane) LE LECTEUR WebAssembly, HORS DU FIL DE L'ÉCRAN ─────────────────────────────
// Julien (iPhone) : « il est un peu long et il faut être vraiment très très proche ». Safari n'a pas
// `BarcodeDetector` : c'était ZXing en JavaScript, sur le fil de l'écran (l'écran se figeait à chaque image, ≈ 4
// images lues par seconde, un Code 128 lu seulement de très près). Ici : zxing-cpp en WebAssembly dans un worker
// (src/lecteurCodes.worker.js), chargé à l'ouverture du scanner, gardé ensuite (une 2e ouverture est immédiate).
// L'image visée est découpée par le navigateur (`createImageBitmap`, sans copie sur le fil de l'écran) et
// envoyée au worker ; sans `OffscreenCanvas` dans le worker (vieux Safari), la découpe passe par un canvas ici.
// Le worker ne répond pas (pas de WebAssembly, fichier introuvable) ⇒ ZXing en JavaScript, comme avant.
let travailleur = null;   // { w: Worker, pret: Promise<{ offscreen }>, attente: Map }
const lancerTravailleur = () => {
  if (travailleur) return travailleur;
  let w;
  try { w = new Worker(new URL('./lecteurCodes.worker.js', import.meta.url), { type: 'module' }); } catch (_) { return null; }
  const attente = new Map();
  const t = { w, attente, mort: false };
  t.pret = new Promise((ok, ko) => {
    const minut = setTimeout(() => ko(new Error('délai')), 12000);
    w.addEventListener('message', (ev) => {
      const d = ev.data || {};
      if (d.type === 'pret') { clearTimeout(minut); ok({ offscreen: !!d.offscreen }); return; }
      if (d.type === 'echec') { clearTimeout(minut); ko(new Error(d.raison || 'échec')); return; }
      const f = attente.get(d.id); if (f) { attente.delete(d.id); f(d); }
    });
    w.addEventListener('error', () => { clearTimeout(minut); t.mort = true; for (const f of attente.values()) f({ vals: [] }); attente.clear(); ko(new Error('worker')); });
  });
  t.pret.catch(() => { t.mort = true; if (travailleur === t) travailleur = null; try { w.terminate(); } catch (_) {} });
  w.postMessage({ type: 'prechauffer' });
  travailleur = t;
  return t;
};
// Le lecteur se prépare DÈS l'ouverture du scanner, en même temps que la caméra (rien à attendre ensuite).
export const prechargerLecteur = () => { try { if (typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined') lancerTravailleur(); } catch (_) {} };
const MAX_PX = 1700;   // le grand côté d'une zone lue à taille réelle (au-delà : réduite — un code proche est grand)
async function lecteurWasm() {
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return null;
  const t = lancerTravailleur(); if (!t) return null;
  let capa;
  try { capa = await t.pret; } catch (_) { return null; }
  const bitmap = capa.offscreen && typeof createImageBitmap === 'function';
  const cv = bitmap ? null : document.createElement('canvas');
  let id = 0, tour = 0, tampon = null, bitmapKo = false;
  const envoyer = (msg, transfert) => new Promise((ok) => { if (t.mort) { ok({ vals: [] }); return; } t.attente.set(msg.id, ok); t.w.postMessage(msg, transfert); });
  return { source: 'wasm', horsFil: true, detect: async (v, zone) => {
    const W = v.videoWidth, H = v.videoHeight; if (!W || !H || t.mort) return [];
    const zz = Array.isArray(zone) ? (zone.length ? zone[(tour++) % zone.length] : null) : zone;
    const z = zz && zz.l > 0 && zz.h > 0 ? zz : null;
    const sx = z ? Math.round(W * Math.max(0, z.x)) : 0, sy = z ? Math.round(H * Math.max(0, z.y)) : 0;
    const sw = z ? Math.min(W - sx, Math.round(W * z.l)) : W, sh = z ? Math.min(H - sy, Math.round(H * z.h)) : H;
    const k = z && z.k > 1 ? z.k : Math.min(1, MAX_PX / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
    id += 1;
    if (bitmap && !bitmapKo) {
      let bm = null;
      try { bm = await createImageBitmap(v, sx, sy, sw, sh); } catch (_) { bitmapKo = true; }
      if (bm) { const r = await envoyer({ id, bitmap: bm, w, h }, [bm]); return r.vals || []; }
    }
    const c = cv || document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    if (!tampon || tampon.byteLength !== px.byteLength) tampon = new ArrayBuffer(px.byteLength);
    new Uint8ClampedArray(tampon).set(px);
    const r = await envoyer({ id, buf: tampon, w, h }, [tampon]);
    tampon = r.buf && r.buf.byteLength ? r.buf : null;
    return r.vals || [];
  } };
}

// Un lecteur `{ detect(video, zone) → Promise<[rawValue…]> }`, ou null.
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
  } catch (_) { /* détecteur absent ou refusé : WebAssembly, puis ZXing */ }
  try { const l = await lecteurWasm(); if (l) return l; } catch (_) { /* WebAssembly absent : ZXing */ }
  try {
    const Z = await chargerZxing();
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.ITF, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.DATA_MATRIX, Z.BarcodeFormat.QR_CODE]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const lecteur = new Z.MultiFormatReader(); lecteur.setHints(hints);
    const cv = document.createElement('canvas');
    let tourZone = 0, lum = null;
    return { source: 'zxing', detect: async (v, zone) => {
      const W = v.videoWidth, H = v.videoHeight; if (!W || !H) return [];
      // (15 nov.) La zone visée seulement, si l'appelant la donne (fractions de l'image) ; sinon l'image entière.
      // Une LISTE de zones : une par tour, à tour de rôle. MESURÉ (banc scan-colis) : le lecteur 1D de ZXing ne
      // trouve pas un Code 128 net quand l'étiquette blanche est posée sur un fond sombre (carton, table) et que
      // ce fond entre dans l'image ; la même image recadrée sur le viseur se lit. D'où : le centre, puis large.
      const zz = Array.isArray(zone) ? (zone.length ? zone[(tourZone++) % zone.length] : null) : zone;
      const z = zz && zz.l > 0 && zz.h > 0 ? zz : null;
      const sx = z ? Math.round(W * Math.max(0, z.x)) : 0, sy = z ? Math.round(H * Math.max(0, z.y)) : 0;
      const w = z ? Math.min(W - sx, Math.round(W * z.l)) : W, h = z ? Math.min(H - sy, Math.round(H * z.h)) : H;
      const k = Math.min(1, 1280 / w); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(v, sx, sy, w, h, 0, 0, cv.width, cv.height);
      try {
        // (15 nov.) La luminance est calculée ICI (RGBLuminanceSource). MESURÉ (banc scan-colis, Chromium) : sur la
        // MÊME image, `HTMLCanvasElementLuminanceSource` de ZXing 0.20 ne trouve aucun Code 128 ni EAN-13 net, la
        // luminance donnée telle quelle les lit (les codes 2D passaient par les deux).
        const n = cv.width * cv.height, px = ctx.getImageData(0, 0, cv.width, cv.height).data;
        if (!lum || lum.length !== n) lum = new Uint8ClampedArray(n);
        for (let i = 0, j = 0; i < n; i++, j += 4) lum[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
        const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, cv.width, cv.height)));
        const r = lecteur.decode(bmp); return r && r.getText ? [r.getText()] : [];
      } catch (_) { return []; } finally { try { lecteur.reset(); } catch (_) {} }
    } };
  } catch (_) { return null; }
}

// (10 nov., lot AU) LA CAMÉRA DU SCANNER, partagée avec le mode « dépôt » (src/ModeDepot.jsx) : le flux
// arrière, le lecteur (`creerLecteur`), une même lecture comptée une fois (2,5 s), le flux COUPÉ en
// sortant. Rend l'état : 'demarrage' · 'active' · 'sans' (pas de caméra, refus, lecteur absent).
// (11 nov., « la caméra ne marche pas sur iPhone ») La raison d'une caméra absente est GARDÉE et dite
// (`raisonCamera()`), pour qu'un refus d'autorisation ne ressemble pas à « pas de caméra » :
// 'refus' (autorisation refusée), 'absente' (aucune caméra), 'occupee' (prise par une autre app),
// 'lecteur' (le lecteur de codes n'a pas pu se charger), 'autre'.
let derniereRaison = '';
export const raisonCamera = () => derniereRaison;
const raisonDe = (e) => {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'refus';
  if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'absente';
  if (n === 'NotReadableError' || n === 'AbortError' || n === 'TrackStartError') return 'occupee';
  return e && e.message === 'pas de caméra' ? 'absente' : 'autre';
};
// Les contraintes de l'iPhone : la caméra arrière d'abord ; si Safari refuse la taille demandée, on
// redemande sans taille, puis n'importe quelle caméra (une contrainte trop précise ne doit rien bloquer).
async function ouvrirFlux() {
  const essais = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false },
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: true, audio: false },
  ];
  let derniere = null;
  for (const c of essais) {
    try { return await navigator.mediaDevices.getUserMedia(c); }
    catch (e) { derniere = e; if (raisonDe(e) === 'refus') break; }
  }
  throw derniere || new Error('pas de caméra');
}
// Branche le flux sur l'élément <video> ACTUEL : la vue peut être remontée (nouvelle lecture), et
// l'iPhone n'affiche rien tant que la vidéo n'est pas inline, muette et relancée par play().
const brancher = (v, flux) => {
  if (!v || !flux) return;
  if (v.srcObject !== flux) v.srcObject = flux;
  v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.muted = true;
  const p = v.play(); if (p && p.catch) p.catch(() => {});
};
// (15 nov., scanner pour retrouver) `opts.surFlux(flux)` : le flux ouvert est donné à l'appelant (la lampe
// lit la piste) ; `opts.pause` : le temps entre deux lectures (220 ms par défaut) ; `opts.zone` : { x, y, l, h } en fractions de l'image — ZXing ne lit que la zone visée
// (moins de pixels, lecture plus rapide). Sans `opts`, rien ne change.
export function useLectureCamera(video, traiter, opts = null) {
  const [camera, setCamera] = React.useState('demarrage');
  const optsRef = React.useRef(opts); optsRef.current = opts;
  React.useEffect(() => {
    let vivant = true, flux = null, minuterie = null, rvfc = null;
    const nouveau = filtreRepetition(2500);
    derniereRaison = '';
    // (17 nov., lot scan-instantane) Le lecteur se prépare EN MÊME TEMPS que la caméra (avant : après elle).
    prechargerLecteur();
    const lecteurP = creerLecteur();
    (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('pas de caméra');
        flux = await ouvrirFlux();
        if (!vivant) { flux.getTracks().forEach((t) => t.stop()); return; }
        if (!video.current) return;
        brancher(video.current, flux);
        reglerMiseAuPoint(flux);
        try { const o = optsRef.current; if (o && typeof o.surFlux === 'function') o.surFlux(flux); } catch (_) {}
        const lecteur = await lecteurP;
        if (!vivant) return;
        if (!lecteur) { derniereRaison = 'lecteur'; setCamera('sans'); return; }
        setCamera('active');
        // Hors du fil de l'écran (WebAssembly) : l'image suivante dès qu'elle arrive (`requestVideoFrameCallback`),
        // sans pause. Sur le fil de l'écran (ZXing en JavaScript, BarcodeDetector) : la pause d'avant.
        const suivante = () => {
          if (!vivant) return;
          const o = optsRef.current, v = video.current;
          if (!lecteur.horsFil) { minuterie = setTimeout(tour, o && Number.isFinite(o.pause) ? o.pause : 220); return; }
          if (v && typeof v.requestVideoFrameCallback === 'function') {
            let fait = false; const go = () => { if (fait) return; fait = true; if (minuterie) clearTimeout(minuterie); tour(); };
            rvfc = { v, id: v.requestVideoFrameCallback(go) };
            minuterie = setTimeout(go, 120);   // une vidéo figée (onglet caché, image identique) ne bloque jamais la boucle
          } else minuterie = setTimeout(tour, 16);
        };
        const tour = async () => {
          if (!vivant) return;
          const v = video.current;
          try {
            if (v) { brancher(v, flux); if (v.readyState >= 2) { const o = optsRef.current; const vals = await lecteur.detect(v, o && o.zone); if (vivant) for (const x of vals) if (nouveau(x)) traiter(x); } }
          } catch (_) {}
          suivante();
        };
        tour();
      } catch (e) { derniereRaison = raisonDe(e); if (vivant) setCamera('sans'); }
    })();
    // La caméra est COUPÉE en sortant (le flux est rendu au système).
    const v0 = video.current;
    return () => {
      vivant = false; if (minuterie) clearTimeout(minuterie);
      try { if (rvfc && rvfc.v.cancelVideoFrameCallback) rvfc.v.cancelVideoFrameCallback(rvfc.id); } catch (_) {}
      if (flux) flux.getTracks().forEach((t) => t.stop()); try { if (v0) v0.srcObject = null; } catch (_) {}
    };
  }, [traiter]);
  return camera;
}
// (17 nov., lot scan-instantane) La mise au point CONTINUE quand la caméra la propose (Android, ordinateur) :
// sans elle, certaines caméras restent nettes à une seule distance. Safari sur iPhone la fait déjà seul.
const reglerMiseAuPoint = (flux) => {
  try {
    const t = flux && flux.getVideoTracks ? flux.getVideoTracks()[0] : null;
    const caps = t && typeof t.getCapabilities === 'function' ? t.getCapabilities() : null;
    if (caps && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) t.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
  } catch (_) {}
};
// (17 nov.) LE ZOOM de la caméra (Safari 17+, Chrome Android) : `null` si elle n'en a pas, sinon { min, max, valeur }.
export const zoomDe = (t) => {
  try { const c = t && typeof t.getCapabilities === 'function' ? t.getCapabilities() : null; const z = c && c.zoom; if (!z || !(z.max > z.min)) return null;
    const s = typeof t.getSettings === 'function' ? t.getSettings() : {}; return { min: z.min, max: z.max, valeur: Number.isFinite(s.zoom) ? s.zoom : z.min }; } catch (_) { return null; }
};
export const poserZoom = async (t, x) => { const z = zoomDe(t); if (!z) return null; const v = Math.max(z.min, Math.min(z.max, x)); try { await t.applyConstraints({ advanced: [{ zoom: v }] }); return v; } catch (_) { return null; } };

// La phrase quand la caméra manque : un refus dit OÙ l'autoriser (iPhone : Réglages › Safari › Caméra).
export const phraseSansCamera = (defaut) => {
  const r = raisonCamera();
  if (r === 'refus') return 'Caméra refusée. iPhone : Réglages › Safari › Caméra › Autoriser, puis rouvre. Ou tape le n°.';
  if (r === 'occupee') return 'Caméra prise par une autre app : ferme-la, puis rouvre. Ou tape le n°.';
  if (r === 'lecteur') return 'Lecteur de codes pas chargé (réseau ?). Rouvre, ou tape le n°.';
  return defaut;
};
export const vibrer = (motif) => { try { if (navigator.vibrate) navigator.vibrate(motif); } catch (_) {} };
// Un bip discret (WebAudio, si le navigateur le permet) — jamais un fichier, rien n'est chargé.
export const creerBip = () => {
  let ctx = null;
  return (ok) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = 'sine'; o.frequency.value = ok ? 1320 : 440;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.09 : 0.16));
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.18);
    } catch (_) {}
  };
};

// Les mots de chaque mode : le colis qu'il ENVOIE (bordereau), l'achat qu'il RETIRE.
const MOTS = {
  envoi: {
    titre: 'Scanner un bordereau', saisie: 'N° de suivi du bordereau', tete: 'Dans ce colis',
    get geste() { return `C’est ${motsVendeur().bonne} · Colis fait`; }, fait: 'Colis fait', deja: 'Déjà noté colis fait',
    inconnu: 'Ce n° n’est relié à aucune vente', ambigu: (n) => `${n} ventes portent ce n° : vérifie`,
    sansVente: 'Ce bordereau n’est relié à aucune vente', personne: 'acheteur',
    sansCamera: 'Pas de caméra ici : tape le n° imprimé sur le bordereau.',
  },
  retrait: {
    titre: 'Scanner un colis à retirer', saisie: 'N° de suivi ou code de retrait', tete: 'Ton achat',
    geste: 'C’est mon colis · Retiré', fait: 'Retiré', deja: 'Déjà noté retiré',
    inconnu: 'Aucun achat à retirer ne porte ce code', ambigu: (n) => `${n} achats portent ce code : vérifie`,
    sansVente: 'Ce colis n’est relié à aucun achat', personne: 'vendeur',
    sansCamera: 'Pas de caméra ici : tape le n° de suivi ou le code de retrait.',
  },
};
const euros = (v) => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') + ' €' : '');

// (9 nov., lot AD) `attendu` : la clé du colis que « Préparer mes colis » montre. Le scan dit alors
// si le bordereau est le BON (la même identité : n° de suivi ⇒ SA vente) ; un bordereau d'un autre
// colis est dit (« celui du N°… »), sans bouton — rien n'est coché sur la mauvaise vente.
export default function ScannerColis({ Photo = null, mode = 'envoi', trouver, onConfirmer, onDeposer, onFermer, attente = null, onAnnuler = null, zIndex = 18000, children = null, attendu = '', note = null }) {
  const M = MOTS[mode] || MOTS.envoi;
  const video = React.useRef(null);
  const saisieRef = React.useRef(null);
  const [res, setRes] = React.useState(null);                 // { etat, colis?, n, lu }
  const [scannes, setScannes] = React.useState([]);           // la série : [{ n, cle, etat, num, titre, fait }]
  const [saisie, setSaisie] = React.useState('');
  const ref = React.useRef({}); ref.current.trouver = trouver; ref.current.confirmer = onConfirmer || onDeposer; ref.current.attendu = attendu ? String(attendu) : '';
  const bip = React.useRef(null); if (!bip.current) bip.current = creerBip();
  const compte = React.useRef(0);
  const noter = React.useCallback((n, colis, etat, fait) => setScannes((L) => {
    const un = colis && !Array.isArray(colis) ? colis : null;
    const cle = un ? String(un.cle) : '';
    const x = { n, cle, etat, fait: !!fait, num: un ? (un.num || '') : '', titre: un ? (un.titre || '') : '' };
    const autres = cle ? L.filter((y) => y.cle !== cle) : L;
    return [x, ...autres].slice(0, 40);
  }), []);
  const traiter = React.useCallback((brut) => {
    let r = ref.current.trouver(brut) || { etat: 'inconnu' };
    // (10 nov., lot AZ) Le carton qu'il vient de noter « Colis fait » reste dans le cadre pendant qu'il le
    // photographie : relire SON bordereau ne remplace pas l'écran (il garde « Annuler » et la photo).
    const cour = ref.current.res;
    if (cour && cour.etat === 'fait' && cour.colis && !Array.isArray(cour.colis) && r.colis && !Array.isArray(r.colis) && String(r.colis.cle) === String(cour.colis.cle)) return;
    const att = ref.current.attendu;
    if (att && (r.etat === 'trouve' || r.etat === 'deja') && r.colis && !Array.isArray(r.colis) && String(r.colis.cle) !== att) r = { etat: 'autre', colis: r.colis };
    compte.current += 1; const n = compte.current;
    const bon = r.etat === 'trouve';
    vibrer(bon ? 40 : [30, 60, 30]); bip.current(bon);
    setRes({ etat: r.etat, colis: r.colis || null, n, lu: String(brut) });
    noter(n, r.colis || null, r.etat === 'autre' ? 'inconnu' : r.etat, r.etat === 'deja');
  }, [noter]);
  // (15 nov.) Le centre du viseur, puis l'image entière, à tour de rôle (voir `creerLecteur` : ZXing et le fond sombre).
  const camera = useLectureCamera(video, traiter, ZONES_LECTURE);
  React.useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onFermer && onFermer(); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [onFermer]);
  // Sans caméra (ordinateur sans webcam, refus) : le clavier prend la main.
  React.useEffect(() => { if (camera === 'sans') { try { if (saisieRef.current) saisieRef.current.focus({ preventScroll: true }); } catch (_) {} } }, [camera]);
  const valider = (e) => { e.preventDefault(); const s = saisie.trim(); if (!s) return; traiter(s); setSaisie(''); };
  ref.current.res = res;
  const c = res && res.colis && !Array.isArray(res.colis) ? res.colis : null;
  // SON toucher : le geste existant, une fois. Rien n'est écrit avant.
  const confirmer = () => {
    if (!res || res.etat !== 'trouve' || !c) return;
    try { if (ref.current.confirmer) ref.current.confirmer(c); } catch (_) {}
    vibrer(60); bip.current(true);
    setRes({ ...res, etat: 'fait' });
    noter(res.n, c, 'fait', true);
  };
  const enAttente = !!(c && attente && attente.cle === String(c.cle));
  const annuler = () => {
    if (!onAnnuler) return;
    onAnnuler();
    if (res && c) { setRes({ ...res, etat: 'trouve' }); noter(res.n, c, 'trouve', false); }
  };
  const montrePaire = !!(c && res && (res.etat === 'trouve' || res.etat === 'fait' || res.etat === 'deja'));
  // (10 nov., lot AZ) « Vérification au scan » : au bordereau, la paire attendue occupe TOUTE la feuille —
  // sa photo et son N° en très grand, impossibles à rater. Même identité (n° de suivi ⇒ SA vente ⇒ SA
  // fiche) ; les cas sans paire (aucune vente, deux ventes, autre colis) gardent leur message.
  const verif = mode === 'envoi' && montrePaire;
  // Après « Colis fait » (ou sur un colis déjà noté) : « Photo du carton », facultative, rangée avec SA vente.
  const vente = verif && (res.etat === 'fait' || res.etat === 'deja') ? venteDuColis(c) : null;
  const suivant = () => setRes(null);
  const nAmbigu = res && Array.isArray(res.colis) ? res.colis.length : 2;
  const autre = res && res.etat === 'autre' && res.colis && !Array.isArray(res.colis) ? res.colis : null;
  const message = !res ? '' : autre ? `Pas ce colis : ce bordereau est celui ${autre.num ? `du N°${autre.num}` : 'd’une autre vente'}${autre.titre ? ` (${autre.titre})` : ''}.` : res.etat === 'ambigu' ? M.ambigu(nAmbigu) : res.etat === 'sansVente' ? M.sansVente : M.inconnu;
  return createPortal(
    <div className={'vrm-scan' + (montrePaire ? ' a-paire' : '') + (verif ? ' is-verif' : '')} data-scan-verif={verif ? res.etat : undefined} role="dialog" aria-modal="true" aria-label={M.titre} data-scan-sheet="" data-scan-mode={mode} data-scan-attendu={attendu || undefined} data-scan-camera={camera} style={{ zIndex }}>
      {children}
      <div className="vrm-scan-tete">
        <h2>{M.titre}</h2>
        <button type="button" className="vrm-scan-fermer" data-scan-fermer="" onClick={onFermer} aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div className={'vrm-scan-vue' + (res ? ' is-' + res.etat : '')} key={res ? res.n : 0}>
        <video ref={video} playsInline muted autoPlay aria-hidden="true"/>
        {camera === 'sans' ? <p className="vrm-scan-sans" data-scan-sans-camera={raisonCamera() || ''}>{phraseSansCamera(M.sansCamera)}</p> : <span className="vrm-scan-viseur" aria-hidden="true"/>}
      </div>
      <div className={'vrm-scan-res' + (verif ? ' is-verif' : '')} role="status" aria-live="assertive" data-scan-resultat={res ? res.etat : ''} data-scan-cle={c ? String(c.cle) : ''} data-scan-n={res ? res.n : 0}>
        {montrePaire ? (
          <div className="vrm-scan-paire" data-scan-paire={String(c.cle)} data-scan-paire-num={c.num || ''}>
            <div className="vrm-scan-photo">{c.photo && Photo ? <Photo src={c.photo} alt="" data-vrm-vignette="" decoding="async"/> : <span aria-hidden="true"/>}</div>
            <div className="vrm-scan-infos">
              <span className={'vrm-scan-kicker is-' + res.etat} data-scan-bon={attendu ? '1' : undefined}>{res.etat === 'deja' ? M.deja : res.etat === 'fait' ? M.fait + ' ✓' : attendu ? 'C’est le bon bordereau' : M.tete}</span>
              <span className="vrm-scan-ligne1">{c.num ? <b className="vrm-scan-num" data-scan-num={c.num}>N°{c.num}</b> : verif ? <b className="vrm-scan-num is-sans" data-scan-num="">Sans N°</b> : null}<span className="vrm-scan-titre" data-scan-titre="">{c.titre}</span></span>
              <span className="vrm-scan-sous">
                {c.taille ? <span data-scan-taille={c.taille}>{/^\d/.test(String(c.taille)) ? `Taille ${c.taille}` : c.taille}</span> : null}
                {c.compte ? <span className="vrm-sensible" data-stream-type="compte" data-scan-compte="">{c.compte}</span> : null}
                {c.personne ? <span className="vrm-sensible" data-stream-type="acheteur" data-scan-personne={M.personne}>{c.personne}</span> : null}
                {Number.isFinite(c.prix) ? <span data-montant="" data-scan-prix={String(c.prix)}>{euros(c.prix)}</span> : null}
              </span>
              {/* (10 nov., lot BD) La note privée de la paire, par son N°. */}
              {note && c.num ? <span className="vrm-scan-note" data-scan-note="">{note(c)}</span> : null}
            </div>
          </div>
        ) : res ? (
          <div className="vrm-scan-msg">
            <span className={'vrm-scan-etat is-' + res.etat} data-scan-message="">{message}</span>
            <span className="vrm-scan-quoi is-n">{res.lu} · rien n’est coché</span>
          </div>
        ) : <span className="vrm-scan-attente">{camera === 'sans' ? '' : 'Vise le code-barres.'}</span>}
        {/* (20 nov., chasse-bugs-2 — décision « 4 oui ») Sans geste confié (envoi : le dépôt est constaté par le suivi), le scanner montre le colis, sans bouton. */}
        {montrePaire && res.etat === 'trouve' && (onConfirmer || onDeposer)
          ? <button type="button" className="vrm-scan-geste" data-scan-confirmer={String(c.cle)} onClick={confirmer}>{M.geste}</button> : null}
        {vente ? <BoutonPhotoCarton vente={{ ...vente, num: c.num || '' }} ton="sombre"/> : null}
        {montrePaire && res.etat === 'fait' && enAttente && onAnnuler
          ? <button type="button" className="vrm-scan-annuler" data-depose-annuler={attente.cle} onClick={annuler}>Annuler</button> : null}
        {verif ? <button type="button" className="vrm-scan-suivant" data-scan-suivant="" onClick={suivant}>{res.etat === 'trouve' ? 'Scanner un autre' : 'Scanner le suivant'}</button> : null}
      </div>
      {scannes.length ? (
        <details className="vrm-scan-serie" data-scan-serie={scannes.length}>
          <summary>Scannés · {scannes.length}</summary>
          <ol>
            {scannes.map((x) => (
              <li key={x.n + ':' + x.cle} data-scan-serie-cle={x.cle} data-scan-serie-etat={x.fait ? 'fait' : x.etat}>
                {x.num ? <b>N°{x.num}</b> : null}<span>{x.titre || (x.etat === 'ambigu' ? 'Plusieurs colis' : 'Pas trouvé')}</span>
                <em className={x.fait ? 'is-fait' : (x.etat === 'trouve' ? 'is-attente' : 'is-non')}>{x.fait ? (x.etat === 'deja' ? 'déjà' : '✓') : x.etat === 'trouve' ? 'pas coché' : '—'}</em>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      <form className="vrm-scan-saisie" onSubmit={valider}>
        <input ref={saisieRef} data-scan-saisie="" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={M.saisie} inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label={M.saisie}/>
        <button type="submit" data-scan-ok="" disabled={!saisie.trim()}>OK</button>
      </form>
    </div>,
    document.body
  );
}
