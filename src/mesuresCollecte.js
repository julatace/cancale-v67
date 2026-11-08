// ════════════════════════════════════════════════════════════════════════════
//  LA COLLECTE DES TEMPS RÉELS, SUR L'APPAREIL (6 nov., v36)
// ════════════════════════════════════════════════════════════════════════════
// La règle (ce qui est mesuré, ce qui peut sortir) vit dans src/mesuresTerrain.js.
// Ici, le navigateur : observer, ranger dans des CASES, envoyer par lot.
//   · le premier écran utile : une ouverture (depuis le début du chargement) ou
//     un changement d'écran (depuis le toucher), jusqu'à ce que `<main>` montre
//     du contenu sans squelette de chargement ni écran de démarrage ; un écran
//     qui n'y arrive pas en 30 s compte « 30 s ou plus » (c'est une vraie
//     lenteur) ; une page passée en arrière-plan n'est PAS mesurée ;
//   · l'interaction (Event Timing) et le décalage (Layout Instability) de
//     chaque visite d'écran — seulement si le navigateur sait les mesurer, et
//     l'interaction seulement s'il y en a eu une (jamais un 0 inventé) ;
//   · un morceau de l'app qui ne se charge pas (`vite:preloadError`, ou une
//     erreur que src/plantages.js range parmi les morceaux périmés).
// L'ENVOI : au plus UNE fois par minute (horodatage gardé sur l'appareil,
// commun aux onglets), par `navigator.sendBeacon` (il part même quand l'app se
// ferme) vers `/api/compte?mode=mesures` — pas une treizième fonction. Le lot
// passe d'abord par `normaliserLot` (la règle du serveur) : ce qui n'est pas un
// compte dans une case fermée ne part pas. Hors réseau, il attend (gardé sur
// l'appareil, `vrm_mesures_lot`). Sans session, rien ne part.
import { lotVide, ajouterMesure, normaliserLot, typeAppareil, ENVOI_MIN_MS, ecranValide } from './mesuresTerrain.js';
import { estMorceauPerime, brancherAlertes } from './plantages.js';
// (8 nov.) L'alerte de plantage pour le propriétaire (src/alertesPlantages.js) :
// comptée ici, partie avec le lot (`p`), anonyme.
import { compterErreur, evenementsAEnvoyer, apresEnvoi } from './alertesPlantages.js';
import { masquerPourEnvoi } from './modeStream.js';
import { SELECTEUR_ATTENTE } from './demarrage.js';

export const CLE_LOT = 'vrm_mesures_lot';
export const CLE_ENVOI = 'vrm_mesures_envoi_at';
export const ROUTE_MESURES = '/api/compte?mode=mesures';
const PEU_MAX_MS = 30000;
const PAS_MS = 50;

const lireJson = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } };
const ecrireJson = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

let E = null;   // l'état de la collecte (une par page)

export const CLE_ALERTES = 'vrm_alertes_plantages';
// Branché dès l'import : une erreur du démarrage compte aussi. Rien ne part
// d'ici — seulement à l'envoi du lot, avec une session.
brancherAlertes((e) => { ecrireJson(CLE_ALERTES, compterErreur(lireJson(CLE_ALERTES, {}), e, { masque: masquerPourEnvoi })); });

const appareil = () => {
  try { return typeAppareil({ largeur: window.innerWidth, tactile: window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 }); } catch (_) { return 'ordinateur'; }
};
const sait = (type) => { try { return typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes || []).includes(type); } catch (_) { return false; } };

function noter(ecran, metrique, valeur) {
  if (!E || !ecranValide(ecran)) return;
  const lot = lireJson(CLE_LOT, null) || lotVide();
  ajouterMesure(lot, ecran, E.appareil, metrique, valeur);
  ecrireJson(CLE_LOT, normaliserLot(lot) || null);
}

// L'écran est-il UTILE ? Du contenu dans `<main>`, aucune ATTENTE au sens de
// l'écran de démarrage (`SELECTEUR_ATTENTE`, src/demarrage.js — la même règle :
// squelette d'un écran qui attend ses données essentielles, morceau en
// téléchargement, session ou boutique en vérification), aucun squelette.
export function ecranUtile(doc = document) {
  try {
    if (doc.querySelector(SELECTEUR_ATTENTE)) return false;
    const m = doc.querySelector('main.vrm-main') || doc.querySelector('main');
    if (!m) return false;
    if (m.querySelector('.vrm-skeleton')) return false;
    return (m.innerText || '').trim().length > 0;
  } catch (_) { return false; }
}

function suivrePremierEcran(ecran, debut) {
  const visite = E.visite;
  const t0 = Date.now();
  const tour = () => {
    if (!E || E.visite !== visite || visite.cachee) return;     // écran quitté ou page cachée : pas mesuré
    const ecoule = performance.now() - debut;
    if (ecranUtile()) { noter(ecran, 'peu', Math.max(0, ecoule)); visite.peuFait = true; return; }
    if (ecoule > PEU_MAX_MS || Date.now() - t0 > PEU_MAX_MS + 5000) { noter(ecran, 'peu', PEU_MAX_MS + 1); visite.peuFait = true; return; }
    visite.minuteur = setTimeout(tour, PAS_MS);
  };
  tour();
}

function finirVisite() {
  const v = E && E.visite;
  if (!v || v.finie) return;
  v.finie = true;
  if (v.minuteur) clearTimeout(v.minuteur);
  if (E.saitInp && v.inp > 0) noter(v.ecran, 'inp', v.inp);
  if (E.saitCls && performance.now() - v.debut >= 1000) noter(v.ecran, 'cls', v.cls);
}

function nouvelleVisite(ecran, debut, avecPeu) {
  E.visite = { ecran, debut: performance.now(), inp: 0, cls: 0, fenetre: 0, dernierDecalage: 0, debutFenetre: 0, finie: false, cachee: document.visibilityState === 'hidden', peuFait: !avecPeu };
  if (avecPeu && !E.visite.cachee) suivrePremierEcran(ecran, debut);
}

// Appelé par l'app à chaque rendu avec l'écran ouvert (`tab`) ; ne fait rien si
// c'est le même écran.
export function mesuresEcran(tab) {
  if (!E) { if (typeof window !== 'undefined') window.__vrmEcranMesure = tab; return; }
  const ecran = ecranValide(tab);
  if (!ecran || (E.visite && E.visite.ecran === ecran && !E.visite.finie)) return;
  finirVisite();
  // Le début : le dernier toucher s'il vient d'avoir lieu (le geste qui a changé d'écran).
  const maintenant = performance.now();
  const debut = E.dernierToucher && maintenant - E.dernierToucher < 1000 ? E.dernierToucher : maintenant;
  nouvelleVisite(ecran, debut, true);
}

export function envoyerMesures() {
  if (!E) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    const jeton = E.jeton();
    if (!jeton) return false;
    const lot = normaliserLot(lireJson(CLE_LOT, null));
    const evts = evenementsAEnvoyer(lireJson(CLE_ALERTES, {}));
    if (!lot && !evts.length) return false;
    const dernier = Number(lireJson(CLE_ENVOI, 0)) || 0;
    if (Date.now() - dernier < ENVOI_MIN_MS) return false;
    // Seulement le lot normalisé, les alertes normalisées (écran, message nettoyé,
    // version, nombre — sans la clé locale) et le jeton de la session (vérifié, jamais rangé).
    const corps = JSON.stringify({ v: (lot && lot.v) || 1, h: (lot && lot.h) || {}, ...(evts.length ? { p: evts.map(({ cle, ...ev }) => ev) } : {}), jeton });
    let parti = false;
    if (navigator.sendBeacon) parti = navigator.sendBeacon(E.url, new Blob([corps], { type: 'text/plain;charset=UTF-8' }));
    else if (typeof fetch === 'function') { fetch(E.url, { method: 'POST', keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: corps }).catch(() => {}); parti = true; }
    if (parti) { ecrireJson(CLE_ENVOI, Date.now()); ecrireJson(CLE_LOT, null); if (evts.length) ecrireJson(CLE_ALERTES, apresEnvoi(lireJson(CLE_ALERTES, {}), evts)); }
    return parti;
  } catch (_) { return false; }
}

// Démarre la collecte (une fois par page). `jeton()` rend le jeton de la
// session, ou '' (rien ne part). `ouverture` : la session était là au
// chargement de la page — sinon le « premier écran » compterait le temps de
// taper son mot de passe, et il n'est pas mesuré.
export function demarrerMesures({ jeton, url = ROUTE_MESURES, ouverture = true } = {}) {
  if (E || typeof window === 'undefined' || typeof performance === 'undefined') return;
  E = { jeton: typeof jeton === 'function' ? jeton : () => '', url, appareil: appareil(), saitInp: sait('event'), saitCls: sait('layout-shift'), visite: null, dernierToucher: 0 };
  try { window.addEventListener('pointerdown', (e) => { E.dernierToucher = e.timeStamp || performance.now(); }, { capture: true, passive: true }); } catch (_) {}
  if (E.saitInp) {
    try {
      new PerformanceObserver((liste) => {
        for (const x of liste.getEntries()) if (x.interactionId && E.visite && !E.visite.finie && x.startTime >= E.visite.debut - 50) E.visite.inp = Math.max(E.visite.inp, x.duration);
      }).observe({ type: 'event', durationThreshold: 16, buffered: false });
    } catch (_) { E.saitInp = false; }
  }
  if (E.saitCls) {
    try {
      new PerformanceObserver((liste) => {
        const v = E.visite; if (!v || v.finie) return;
        for (const x of liste.getEntries()) {
          if (x.hadRecentInput) continue;
          // Fenêtres de session : 1 s sans décalage ou 5 s de fenêtre ⇒ une nouvelle.
          if (v.fenetre && (x.startTime - v.dernierDecalage < 1000) && (x.startTime - v.debutFenetre < 5000)) v.fenetre += x.value;
          else { v.fenetre = x.value; v.debutFenetre = x.startTime; }
          v.dernierDecalage = x.startTime;
          v.cls = Math.max(v.cls, v.fenetre);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (_) { E.saitCls = false; }
  }
  const morceau = (m) => { if (E.visite && estMorceauPerime(m)) noter(E.visite.ecran, 'morceau', 1); };
  window.addEventListener('vite:preloadError', (ev) => morceau(String((ev && ev.payload && ev.payload.message) || 'Unable to preload CSS')));
  window.addEventListener('unhandledrejection', (ev) => morceau(String((ev && ev.reason && (ev.reason.message || ev.reason)) || '')));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (E.visite) E.visite.cachee = true; finirVisite(); envoyerMesures(); }
    else if (E.visite && E.visite.finie) nouvelleVisite(E.visite.ecran, performance.now(), false);
  });
  window.addEventListener('pagehide', () => { finirVisite(); envoyerMesures(); });
  E.minuteur = setInterval(() => envoyerMesures(), 15000);
  // L'écran ouvert au démarrage : mesuré depuis le début du chargement de la page.
  const tab = ecranValide(window.__vrmEcranMesure);
  if (tab) nouvelleVisite(tab, 0, !!ouverture && document.visibilityState !== 'hidden' && performance.now() < PEU_MAX_MS);
}
// Pour les bancs : l'état de la collecte, sans rien envoyer.
export const etatMesures = () => (E ? { appareil: E.appareil, saitInp: E.saitInp, saitCls: E.saitCls, ecran: E.visite && E.visite.ecran } : null);
