// ── LES PHOTOS DU CDN DE VINTED, ET LEUR SECOURS PAR L'EXTENSION (11 octobre) ──
// Julien, 11 octobre : « quand je suis dans VRM, je n'ai plus les photos des
// paires — ni dans les annonces, ni dans les bordereaux, ni dans les ventes ».
//
// Mesuré avant d'écrire (lecture seule) : les DONNÉES sont intactes (chaque
// annonce porte `photo.url` = https://images1.vinted.net/t/…/f800/….jpeg?s=…),
// et le code d'affichage n'avait PAS changé dans le déploiement. La cause est
// donc très probablement EXTÉRIEURE : le CDN de Vinted qui refuse désormais
// l'affichage hors de son site (en-tête Cross-Origin-Resource-Policy, ou
// anti-hotlink sur le référent), ou un logiciel de protection local. Ce n'est
// PAS prouvé — c'est pourquoi ce module MESURE dans son navigateur (`sonder`).
//
// Ce que fait ce module, et c'est UNE règle pour toute l'app (§11) :
//   1. chaque photo du CDN Vinted part SANS référent (`no-referrer`) — une
//      protection par référent laisse presque toujours passer « aucun » ;
//   2. si elle ne s'affiche quand même pas, l'EXTENSION va chercher les octets
//      (le pont « photo », présent depuis très longtemps : une requête de son
//      service worker n'est soumise ni à CORP ni au référent de la page) ;
//      on en fait une URL objet ;
//   3. un cache par URL (succès ET échec — on ne redemande jamais en boucle),
//      borné à MAX_ENTREES entrées hors écran (URL objet révoquées à
//      l'éviction), au plus MAX_EN_VOL demandes à la fois, et AUCUNE demande
//      pour une image hors écran ;
//   4. sans secours possible ici (téléphone, autre navigateur, extension
//      muette, secours refusé) : le pictogramme, jamais une image cassée — et
//      la phrase de la coque (`etatGlobal`) dit ce qui se passe et le geste.
//
// ⚠️ « Pas su » ne vaut pas « oui » : tant que l'extension n'a pas pu se
//    manifester (les premières secondes), on n'affirme pas qu'il n'y a pas de
//    secours. Les dépendances (le pont, l'état de l'extension, l'écriture du
//    bilan) sont INJECTÉES par App.jsx : ce module ne sait rien de Supabase ni
//    du pont, il est exécutable seul.

// La MÊME règle que le pont de l'extension (background.js : `action === 'photo'`
// n'accepte que `^https://…vinted.net/`). Une autre adresse ne passe jamais par
// le secours : elle s'affiche comme avant.
export const RE_PHOTO_VINTED = /^https:\/\/[\w.-]*vinted\.net\//i;
export const estPhotoVinted = (u) => typeof u === 'string' && RE_PHOTO_VINTED.test(u);

export const MAX_ENTREES = 300;
export const MAX_EN_VOL = 3;
// Le premier bilan part peu après le premier échec (le temps que la sonde et
// les premiers secours répondent), les suivants au plus une fois toutes les 10 min.
export const BILAN_PREMIER_MS = 6000;
export const BILAN_INTERVALLE_MS = 10 * 60e3;

// ── Les dépendances (injectées par App.jsx) ─────────────────────────────────
// demander(url) → Promise<dataUrl|null>   : le pont « photo » de l'extension
// secours()     → 'oui' | 'attente' | 'non' : peut-on demander ICI ?
//                 'attente' = pas encore su (l'extension se manifeste après le chargement)
// ext()         → 'presente' | 'absente' | 'muette' (pour le bilan)
// ecrire(bilan) → Promise<bool>            : range le bilan dans SA ligne
const deps = { demander: null, secours: () => 'non', ext: () => 'absente', ecrire: null };
export function configurer(d) {
  Object.assign(deps, d || {});
  dernierSecours = null;
  toutNotifier();
  pomper();
  // Un bilan noté avant que l'écriture soit branchée part maintenant.
  if (d && d.ecrire && bilanSale) planifierBilan();
}
// Appelé quand l'état de l'extension change (elle apparaît, se tait, revient).
// Le battement de l'extension prévient toutes les 20 s : on ne redessine les
// photos que si la réponse à « peut-on demander ici ? » a CHANGÉ.
let dernierSecours = null;
export function secoursChange() {
  let s = 'non'; try { s = deps.secours(); } catch (_) {}
  if (s !== dernierSecours) { dernierSecours = s; toutNotifier(); }
  pomper();
}

// ── Le cache par URL ────────────────────────────────────────────────────────
// etat : 'natif' (on laisse le navigateur l'afficher) · 'attente' (le navigateur
// a échoué, on attend le secours) · 'vol' (demandée à l'extension) · 'ok' (URL
// objet prête) · 'ko' (le secours a échoué — définitif pour cette ouverture).
const entrees = new Map();
function entree(url, creer) {
  let e = entrees.get(url);
  if (!e && creer) {
    e = { etat: 'natif', blob: null, refs: 0, visibles: new Set(), abonnes: new Set(), essaisBlob: 0 };
    entrees.set(url, e);
  }
  return e || null;
}
// Moins récemment servie en tête : on la remet en queue à chaque usage.
function toucher(url) { const e = entrees.get(url); if (e) { entrees.delete(url); entrees.set(url, e); } }
function ranger() {
  if (entrees.size <= MAX_ENTREES) return;
  for (const [u, e] of entrees) {
    if (entrees.size <= MAX_ENTREES) break;
    // Jamais une photo à l'écran, ni une demande en vol : on ne range que ce
    // que plus personne ne regarde.
    if (e.refs > 0 || e.etat === 'vol') continue;
    if (e.blob) { try { URL.revokeObjectURL(e.blob); } catch (_) {} }
    entrees.delete(u);
  }
}

// ── Ce que la session a vu (le bilan) — jamais une URL ─────────────────────
// Des empreintes, pas des adresses : le bilan ne compte que des NOMBRES.
const empreinte = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const vus = { okNatif: new Set(), koNatif: new Set(), secoursOk: new Set(), secoursKo: new Set() };
let sonde = null;           // null jamais lancée · 'encours' · 'bloquee' · 'reponse' · 'passu'
let hote = '';              // le NOM du serveur de la première photo en échec, rien d'autre
let ecranPremier = '';
let ecranCourant = '';
export function ecranActuel(t) { ecranCourant = String(t || '').slice(0, 40); }

// ── Les abonnés ─────────────────────────────────────────────────────────────
const ecouteurs = new Set();
let globalPlanifie = null;
function notifierGlobal() {
  if (globalPlanifie) return;
  globalPlanifie = setTimeout(() => { globalPlanifie = null; ecouteurs.forEach((f) => { try { f(); } catch (_) {} }); }, 40);
}
export function ecouter(fn) { ecouteurs.add(fn); return () => ecouteurs.delete(fn); }
function notifier(url) {
  const e = entrees.get(url);
  if (e) e.abonnes.forEach((f) => { try { f(); } catch (_) {} });
  notifierGlobal();
}
function toutNotifier() {
  for (const e of entrees.values()) e.abonnes.forEach((f) => { try { f(); } catch (_) {} });
  notifierGlobal();
}

// ── Ce qu'un composant appelle ──────────────────────────────────────────────
export function etat(url) { const e = entrees.get(url); return e ? e.etat : 'natif'; }
export function blobDe(url) { const e = entrees.get(url); return (e && e.blob) || null; }
// Morte = elle ne s'affichera pas ICI : le secours a échoué, ou il n'y en a pas
// (et on le SAIT — « attente » n'est pas « non »).
export function estMorte(url) {
  const e = entrees.get(url);
  if (!e) return false;
  if (e.etat === 'ko') return true;
  return e.etat === 'attente' && deps.secours() === 'non';
}
export function monter(url, fn) {
  const e = entree(url, true);
  e.refs++;
  if (fn) e.abonnes.add(fn);
  toucher(url);
  ranger();
  return () => {
    e.refs = Math.max(0, e.refs - 1);
    if (fn) e.abonnes.delete(fn);
    ranger();
  };
}
export function voir(url, qui, visible) {
  const e = entrees.get(url);
  if (!e) return;
  if (visible) e.visibles.add(qui); else e.visibles.delete(qui);
  if (visible) pomper();
}
export function chargeNatif(url) {
  vus.okNatif.add(empreinte(url));
  notifierGlobal();
}
export function echecNatif(url) {
  const e = entree(url, true);
  const k = empreinte(url);
  if (!vus.koNatif.has(k)) { vus.koNatif.add(k); }
  if (e.etat === 'natif') e.etat = 'attente';
  if (!hote) { try { const h = new URL(url).hostname; if (/^[a-z0-9.-]+\.vinted\.net$/i.test(h)) hote = h.toLowerCase(); } catch (_) {} }
  if (!ecranPremier) ecranPremier = ecranCourant;
  if (sonde === null) sonder(url);
  planifierBilan();
  notifier(url);
  pomper();
}
// L'URL objet ne s'affiche pas (révoquée, octets qui ne sont pas une image) :
// une seconde demande, jamais plus.
export function echecBlob(url) {
  const e = entrees.get(url);
  if (!e || e.etat !== 'ok') return;
  if (e.blob) { try { URL.revokeObjectURL(e.blob); } catch (_) {} }
  e.blob = null;
  e.essaisBlob++;
  e.etat = e.essaisBlob > 1 ? 'ko' : 'attente';
  if (e.etat === 'ko') vus.secoursKo.add(empreinte(url));
  planifierBilan();
  notifier(url);
  pomper();
}

// ── La file : au plus MAX_EN_VOL demandes, seulement pour ce qui est à l'écran ──
let enVol = 0;
function pomper() {
  if (!deps.demander || deps.secours() !== 'oui') return;
  while (enVol < MAX_EN_VOL) {
    let cible = null;
    for (const [u, e] of entrees) { if (e.etat === 'attente' && e.visibles.size > 0) { cible = u; break; } }
    if (!cible) return;
    lancer(cible);
  }
}
function lancer(url) {
  const e = entrees.get(url);
  if (!e) return;
  e.etat = 'vol';
  enVol++;
  notifier(url);
  let fini = false;
  const fin = (dataUrl) => {
    if (fini) return; fini = true;
    enVol = Math.max(0, enVol - 1);
    const blob = dataUrl ? blobDeDataUrl(dataUrl) : null;
    // L'entrée a pu être rangée entre-temps (elle était en vol : non) — prudence.
    const cur = entrees.get(url) || e;
    if (blob) {
      try { cur.blob = URL.createObjectURL(blob); } catch (_) { cur.blob = null; }
    }
    const k = empreinte(url);
    if (cur.blob) { cur.etat = 'ok'; vus.secoursOk.add(k); vus.secoursKo.delete(k); }
    else { cur.etat = 'ko'; if (!vus.secoursOk.has(k)) vus.secoursKo.add(k); }
    planifierBilan();
    notifier(url);
    ranger();
    pomper();
  };
  let p;
  try { p = deps.demander(url); } catch (_) { p = null; }
  Promise.resolve(p).then(fin, () => fin(null));
}
// Les octets rendus par l'extension, en Blob. Jamais rien d'autre qu'une image :
// un type inconnu devient image/jpeg (le CDN répond parfois sans type), et si
// les octets ne sont pas une image, l'<img> échoue et `echecBlob` le constate.
export function blobDeDataUrl(d) {
  try {
    const m = /^data:([^;,]*)((?:;[^;,]*)*?)(;base64)?,([\s\S]*)$/.exec(String(d || ''));
    if (!m) return null;
    const mime = /^image\//i.test(m[1]) ? m[1] : 'image/jpeg';
    const bin = m[3] ? atob(m[4]) : decodeURIComponent(m[4]);
    if (!bin.length) return null;
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: mime });
  } catch (_) { return null; }
}

// ── LA SONDE : pourquoi ça ne s'affiche pas, mesuré dans SON navigateur ──────
// Une seule fois par ouverture, au premier échec. Une requête `no-cors` SANS
// référent ni cookie :
//   · TypeError ⇒ « bloquée » (CORP de Vinted, un logiciel de protection, ou le
//     réseau — on ne peut pas les séparer d'ici, la phrase ne tranche pas) ;
//   · une réponse (opaque) ⇒ « le serveur a répondu » (mais l'image ne
//     s'affiche pas : un statut d'erreur, ou une image refusée pour une autre
//     raison) ;
//   · hors ligne, délai, autre erreur ⇒ « pas su ».
async function sonder(url) {
  sonde = 'encours';
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { sonde = 'passu'; return; }
    if (typeof fetch !== 'function') { sonde = 'passu'; return; }
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { try { ac && ac.abort(); } catch (_) {} }, 10000);
    try {
      await fetch(url, { mode: 'no-cors', referrerPolicy: 'no-referrer', cache: 'no-store', credentials: 'omit', signal: ac ? ac.signal : undefined });
      sonde = 'reponse';
    } catch (err) {
      sonde = err && err.name === 'TypeError' ? 'bloquee' : 'passu';
    } finally { clearTimeout(t); }
  } catch (_) { sonde = 'passu'; }
  finally { if (sonde === 'encours') sonde = 'passu'; planifierBilan(); notifierGlobal(); }
}

// ── Ce que la coque affiche (une phrase, une fois) ─────────────────────────
export function etatGlobal() {
  let morts = 0, attente = 0;
  for (const [u, e] of entrees) {
    if (e.refs <= 0) continue;                 // seulement ce qui est À L'ÉCRAN maintenant
    if (estMorte(u)) morts++;
    else if (e.etat === 'attente' || e.etat === 'vol') attente++;
  }
  return {
    koNatif: vus.koNatif.size, okNatif: vus.okNatif.size,
    secoursOk: vus.secoursOk.size, secoursKo: vus.secoursKo.size,
    morts, attente, sonde: sonde === 'encours' ? null : sonde, secours: deps.secours(),
  };
}

// ── LE BILAN DANS SA BASE (`diag_photos`) ───────────────────────────────────
// Des nombres et des mots, JAMAIS une URL, une signature ou un titre.
export function bilan(extra) {
  return Object.assign({
    at: new Date().toISOString(),
    ko: vus.koNatif.size, ok: vus.okNatif.size,
    secoursOk: vus.secoursOk.size, secoursKo: vus.secoursKo.size,
    sonde: sonde === 'bloquee' || sonde === 'reponse' ? sonde : 'passu',
    hote: hote || '',
    ext: (() => { try { const v = deps.ext(); return v === 'presente' || v === 'muette' ? v : 'absente'; } catch (_) { return 'absente'; } })(),
    ecran: ecranPremier || ecranCourant || '',
  }, extra || {});
}
let bilanTimer = null, bilanDernier = 0, bilanEnVol = false, bilanSale = false;
function planifierBilan() {
  if (!vus.koNatif.size) return;      // tout s'affiche : rien à écrire
  bilanSale = true;
  if (bilanTimer || bilanEnVol) return;
  const maintenant = Date.now();
  const delai = bilanDernier ? Math.max(0, bilanDernier + BILAN_INTERVALLE_MS - maintenant) : BILAN_PREMIER_MS;
  bilanTimer = setTimeout(envoyerBilan, delai);
}
async function envoyerBilan() {
  bilanTimer = null;
  // Pas encore d'écriture branchée (pas de session) : le bilan reste « à écrire »,
  // `configurer` le relancera.
  if (!deps.ecrire || !bilanSale) return;
  bilanEnVol = true; bilanSale = false;
  let ok = false;
  try { ok = await deps.ecrire(bilan()); } catch (_) { ok = false; }
  bilanEnVol = false;
  bilanDernier = Date.now();
  // Pas écrit ⇒ on retentera au prochain créneau ; écrit ⇒ seulement si du neuf est arrivé.
  if (!ok) bilanSale = true;
  if (bilanSale) planifierBilan();
}

// ── Pour les bancs et les audits ────────────────────────────────────────────
export function _etatInterne() { return { taille: entrees.size, enVol, sonde }; }

// ── L'observation de l'écran : un seul IntersectionObserver pour toute l'app ──
let io = null;
const rappels = new WeakMap();
export function observer(el, cb) {
  if (!el) return () => {};
  if (typeof IntersectionObserver === 'undefined') { cb(true); return () => cb(false); }
  if (!io) {
    io = new IntersectionObserver((liste) => liste.forEach((en) => { const f = rappels.get(en.target); if (f) f(en.isIntersecting); }), { rootMargin: '200px 0px' });
  }
  rappels.set(el, cb);
  io.observe(el);
  return () => { try { io.unobserve(el); } catch (_) {} rappels.delete(el); cb(false); };
}
