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
// Un bip discret (WebAudio, si le navigateur le permet) — jamais un fichier, rien n'est chargé.
const creerBip = () => {
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
    geste: 'C’est la bonne paire · Colis fait', fait: 'Colis fait', deja: 'Déjà noté colis fait',
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
export default function ScannerColis({ mode = 'envoi', trouver, onConfirmer, onDeposer, onFermer, attente = null, onAnnuler = null, zIndex = 18000, children = null, attendu = '' }) {
  const M = MOTS[mode] || MOTS.envoi;
  const video = React.useRef(null);
  const saisieRef = React.useRef(null);
  const [camera, setCamera] = React.useState('demarrage');   // demarrage · active · sans
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
    const att = ref.current.attendu;
    if (att && (r.etat === 'trouve' || r.etat === 'deja') && r.colis && !Array.isArray(r.colis) && String(r.colis.cle) !== att) r = { etat: 'autre', colis: r.colis };
    compte.current += 1; const n = compte.current;
    const bon = r.etat === 'trouve';
    vibrer(bon ? 40 : [30, 60, 30]); bip.current(bon);
    setRes({ etat: r.etat, colis: r.colis || null, n, lu: String(brut) });
    noter(n, r.colis || null, r.etat === 'autre' ? 'inconnu' : r.etat, r.etat === 'deja');
  }, [noter]);
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
    // La caméra est COUPÉE en sortant (le flux est rendu au système).
    const v0 = video.current;
    return () => { vivant = false; if (minuterie) clearTimeout(minuterie); if (flux) flux.getTracks().forEach((t) => t.stop()); try { if (v0) v0.srcObject = null; } catch (_) {} };
  }, [traiter]);
  React.useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') onFermer && onFermer(); };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [onFermer]);
  // Sans caméra (ordinateur sans webcam, refus) : le clavier prend la main.
  React.useEffect(() => { if (camera === 'sans') { try { if (saisieRef.current) saisieRef.current.focus({ preventScroll: true }); } catch (_) {} } }, [camera]);
  const valider = (e) => { e.preventDefault(); const s = saisie.trim(); if (!s) return; traiter(s); setSaisie(''); };
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
  const nAmbigu = res && Array.isArray(res.colis) ? res.colis.length : 2;
  const autre = res && res.etat === 'autre' && res.colis && !Array.isArray(res.colis) ? res.colis : null;
  const message = !res ? '' : autre ? `Pas ce colis : ce bordereau est celui ${autre.num ? `du N°${autre.num}` : 'd’une autre vente'}${autre.titre ? ` (${autre.titre})` : ''}.` : res.etat === 'ambigu' ? M.ambigu(nAmbigu) : res.etat === 'sansVente' ? M.sansVente : M.inconnu;
  return createPortal(
    <div className={'vrm-scan' + (montrePaire ? ' a-paire' : '')} role="dialog" aria-modal="true" aria-label={M.titre} data-scan-sheet="" data-scan-mode={mode} data-scan-attendu={attendu || undefined} data-scan-camera={camera} style={{ zIndex }}>
      {children}
      <div className="vrm-scan-tete">
        <h2>{M.titre}</h2>
        <button type="button" className="vrm-scan-fermer" data-scan-fermer="" onClick={onFermer} aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div className={'vrm-scan-vue' + (res ? ' is-' + res.etat : '')} key={res ? res.n : 0}>
        <video ref={video} playsInline muted autoPlay aria-hidden="true"/>
        {camera === 'sans' ? <p className="vrm-scan-sans" data-scan-sans-camera="">{M.sansCamera}</p> : <span className="vrm-scan-viseur" aria-hidden="true"/>}
      </div>
      <div className="vrm-scan-res" role="status" aria-live="assertive" data-scan-resultat={res ? res.etat : ''} data-scan-cle={c ? String(c.cle) : ''} data-scan-n={res ? res.n : 0}>
        {montrePaire ? (
          <div className="vrm-scan-paire" data-scan-paire={String(c.cle)} data-scan-paire-num={c.num || ''}>
            <div className="vrm-scan-photo">{c.photo ? <img src={c.photo} alt="" data-vrm-vignette="" referrerPolicy="no-referrer" decoding="async"/> : <span aria-hidden="true"/>}</div>
            <div className="vrm-scan-infos">
              <span className={'vrm-scan-kicker is-' + res.etat} data-scan-bon={attendu ? '1' : undefined}>{res.etat === 'deja' ? M.deja : res.etat === 'fait' ? M.fait + ' ✓' : attendu ? 'C’est le bon bordereau' : M.tete}</span>
              <span className="vrm-scan-ligne1">{c.num ? <b className="vrm-scan-num" data-scan-num={c.num}>N°{c.num}</b> : null}<span className="vrm-scan-titre" data-scan-titre="">{c.titre}</span></span>
              <span className="vrm-scan-sous">
                {c.taille ? <span data-scan-taille={c.taille}>{/^\d/.test(String(c.taille)) ? `Taille ${c.taille}` : c.taille}</span> : null}
                {c.compte ? <span className="vrm-sensible" data-stream-type="compte" data-scan-compte="">{c.compte}</span> : null}
                {c.personne ? <span className="vrm-sensible" data-stream-type="acheteur" data-scan-personne={M.personne}>{c.personne}</span> : null}
                {Number.isFinite(c.prix) ? <span data-montant="" data-scan-prix={String(c.prix)}>{euros(c.prix)}</span> : null}
              </span>
            </div>
          </div>
        ) : res ? (
          <div className="vrm-scan-msg">
            <span className={'vrm-scan-etat is-' + res.etat} data-scan-message="">{message}</span>
            <span className="vrm-scan-quoi is-n">{res.lu} · rien n’est coché</span>
          </div>
        ) : <span className="vrm-scan-attente">{camera === 'sans' ? '' : 'Vise le code-barres.'}</span>}
        {montrePaire && res.etat === 'trouve'
          ? <button type="button" className="vrm-scan-geste" data-scan-confirmer={String(c.cle)} onClick={confirmer}>{M.geste}</button> : null}
        {montrePaire && res.etat === 'fait' && enAttente && onAnnuler
          ? <button type="button" className="vrm-scan-annuler" data-depose-annuler={attente.cle} onClick={annuler}>Annuler</button> : null}
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
