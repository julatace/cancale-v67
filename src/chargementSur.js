// ════════════════════════════════════════════════════════════════════════════
//  UN MORCEAU DE L'APP QUI NE SE CHARGE PAS (15 nov., chantier « ouverture »).
//
//  Julien : « L'app bug quand je l'ouvre. » Le même jour, une dizaine de mises en
//  ligne. Mesuré au banc (scripts/bancs/ouverture.cjs, deux builds servis tour à
//  tour, le vrai service worker) :
//   • l'app rouverte après une mise en ligne démarrait sur la version GARDÉE par le
//     service worker (ouverture instantanée), voyait la nouvelle, se rechargeait…
//     et le rechargement retombait sur la version gardée tant que le service worker
//     n'avait pas fini de ranger la nouvelle (≈ 40 fichiers un par un) : A ▸ A ▸ B,
//     l'écran de démarrage qui repart deux, trois fois ;
//   • une page restée ouverte (iPhone : des heures en arrière-plan) qui ouvre un
//     écran jamais ouvert demande un morceau que le serveur n'a plus : « Cet écran a
//     un souci » s'affichait le temps que la page se recharge, et, le rechargement
//     retombant sur la version gardée, l'erreur revenait (« default », « Failed to
//     fetch dynamically imported module » — comptés à part, jamais notés en base :
//     c'est pourquoi le journal des plantages ne disait rien depuis le 12 nov.).
//
//  Ici, UNE règle pour tous :
//   • `chargerSur(charger)` : un morceau à la demande relancé UNE fois ; raté encore,
//     si le serveur a une autre version que la page ⇒ rechargement PROPRE (la
//     promesse reste en attente : l'écran garde son attente, jamais un écran tombé) ;
//     sinon une erreur MARQUÉE (`vrmMorceau`) que les garde-fous montrent comme
//     « Mettre à jour VRM », avec un bouton. Jamais `undefined` rendu à React.lazy
//     (« Cannot read properties of undefined (reading 'default') »).
//   • `rechargerVersNouvelle` : avant de relire la page, la coquille gardée par le
//     service worker (`/` de `vrm-shell-*`) est OUBLIÉE — le rechargement passe donc
//     par le réseau et arrive sur la nouvelle version, quel que soit le mode de cache
//     que le navigateur donne à un rechargement (Safari n'est pas Chrome). Une fois
//     par version cible et par onglet (sessionStorage) : jamais une boucle.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

export const CLE_RECHARGE = 'vrm_recharge_version';
const DIX_MIN = 10 * 60 * 1000;
const RE_PRINCIPAL = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

// Le script principal de la page en cours (l'empreinte de SA version) ; null hors build.
export function versionChargee() {
  try {
    const s = document.querySelector('script[src*="/assets/index-"]');
    const m = s && RE_PRINCIPAL.exec(s.getAttribute('src') || '');
    return m ? m[0] : null;
  } catch (_) { return null; }
}
// La version que le serveur sert MAINTENANT (index.html relu sans cache) ; null = pas su.
export async function versionServeur(f = (typeof fetch === 'function' ? fetch : null)) {
  if (!f) return null;
  try {
    const r = await f('/?_v=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
    if (!r || !r.ok) return null;
    const m = RE_PRINCIPAL.exec(await r.text());
    return m ? m[0] : null;
  } catch (_) { return null; }
}

// La règle de garde, PURE (exécutée par les audits) : un rechargement vers `cible` est permis s'il n'a pas
// déjà été fait vers CETTE cible dans les 10 dernières minutes, et jamais plus de 3 en 10 minutes.
export function rechargementPermis(note, cible, maintenant = Date.now()) {
  const n = note && typeof note === 'object' ? note : null;
  const recents = n && Array.isArray(n.l) ? n.l.filter((x) => x && maintenant - Number(x.at) < DIX_MIN) : [];
  if (recents.length >= 3) return false;
  return !recents.some((x) => x.cible === (cible || ''));
}
const lireNote = () => { try { return JSON.parse(sessionStorage.getItem(CLE_RECHARGE) || 'null'); } catch (_) { return null; } };
function noterRechargement(cible, raison) {
  try {
    const n = lireNote();
    const l = (n && Array.isArray(n.l) ? n.l : []).filter((x) => x && Date.now() - Number(x.at) < DIX_MIN);
    l.push({ cible: cible || '', raison: String(raison || ''), at: Date.now() });
    sessionStorage.setItem(CLE_RECHARGE, JSON.stringify({ l: l.slice(-5) }));
    return true;
  } catch (_) { return false; }   // un onglet qui ne garde rien ne recharge pas tout seul (jamais une boucle)
}

// Oublie la coquille gardée par le service worker : le prochain chargement passe par le réseau.
// Les fichiers `/assets/` restent (immuables, nommés par leur contenu) ; les réserves `vrm-hl-*`
// (QR, bordereaux, photos du hors ligne) ne sont pas touchées.
export async function oublierCoquille() {
  try {
    if (typeof caches === 'undefined') return;
    for (const nom of await caches.keys()) {
      if (!/^vrm-shell/.test(nom)) continue;
      const c = await caches.open(nom);
      await c.delete('/'); await c.delete('/index.html');
    }
  } catch (_) {}
}

// Relit la page vers la version `cible`, proprement. `force` (le bouton de Julien) passe outre la garde.
export async function rechargerVersNouvelle({ cible = '', raison = '', force = false } = {}) {
  if (!force && !rechargementPermis(lireNote(), cible)) return false;
  if (!noterRechargement(cible, raison) && !force) return false;
  try { window.dispatchEvent(new CustomEvent('vrm:rechargement', { detail: { cible, raison } })); } catch (_) {}
  // La coquille n'est oubliée qu'EN LIGNE (sinon on jetterait la seule page qui s'ouvre sans réseau).
  const enLigne = !(typeof navigator !== 'undefined' && navigator.onLine === false);
  if (enLigne) await Promise.race([oublierCoquille(), new Promise((r) => setTimeout(r, 1500))]);
  try { window.location.reload(); } catch (_) { return false; }
  return true;
}

// Un morceau introuvable : est-ce une page d'une ANCIENNE version (le serveur en sert une autre) ?
// Oui ⇒ rechargement propre (true). Pas su, même version, hors ligne, déjà rechargé ⇒ false.
let enCours = null;
export function verifierMorceauPerime(raison = 'morceau') {
  if (enCours) return enCours;
  enCours = (async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    const actuelle = versionChargee();
    if (!actuelle) return false;
    const serveur = await versionServeur();
    if (!serveur || serveur === actuelle) return false;
    return rechargerVersNouvelle({ cible: serveur, raison });
  })().catch(() => false);
  enCours.finally(() => { setTimeout(() => { enCours = null; }, 2000); });
  return enCours;
}

// L'erreur d'un morceau que rien n'a pu charger : les garde-fous la montrent comme « Mettre à jour VRM ».
export const RE_MORCEAU = /Unable to preload CSS|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (CSS )?chunk [\w-]+ failed|is not a valid JavaScript MIME type|reading 'default'|evaluating '[\w$.]*\.default'|_result\.default/i;
export function estErreurMorceau(err) {
  if (!err) return false;
  if (err.vrmMorceau === true) return true;
  return RE_MORCEAU.test(String((err && err.message) || err));
}
function marquer(err, vide) {
  const e = new Error(vide ? 'module vide : le morceau chargé ne porte pas son écran' : String((err && err.message) || err || 'morceau introuvable'));
  e.vrmMorceau = true;
  e.cause = err;
  return e;
}

// Un module rendu par `charger()` est-il un VRAI écran ? (React.lazy lit `.default`.)
export const moduleValide = (m) => !!m && (typeof m.default === 'function' || (typeof m.default === 'object' && m.default !== null));

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// (16 nov., parcours-vert, banc session-reveil D) Une feuille de style refusée UNE fois (déploiement, réseau) :
// le préchargeur de Vite garde son adresse pour « déjà vue » et la seconde tentative rend le module SANS sa
// feuille — l'app s'affichait sans aucune mise en forme. Avant de relancer, chaque feuille `/assets/` qui n'a
// pas chargé (aucune `sheet`) est reposée à neuf, à la même adresse (fichier immuable), une seule fois.
export function relancerFeuilles(doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) return 0;
  let n = 0;
  try {
    for (const l of [...doc.querySelectorAll('link[rel="stylesheet"][href*="/assets/"]')]) {
      if (l.sheet || l.dataset.vrmRelance) continue;
      const neuf = doc.createElement('link');
      neuf.rel = 'stylesheet'; neuf.href = l.href; neuf.dataset.vrmRelance = '1';
      if (l.crossOrigin) neuf.crossOrigin = l.crossOrigin;
      l.replaceWith(neuf); n++;
    }
  } catch (_) {}
  return n;
}
const attendreFeuilles = (doc, ms) => new Promise((r) => {
  try {
    const l = [...doc.querySelectorAll('link[data-vrm-relance]')].filter((x) => !x.sheet);
    if (!l.length) return r();
    let reste = l.length; const fin = () => { if (--reste <= 0) r(); };
    l.forEach((x) => { x.addEventListener('load', fin, { once: true }); x.addEventListener('error', fin, { once: true }); });
    setTimeout(r, ms);
  } catch (_) { r(); }
});
export const ATTENTE_RECHARGEMENT_MS = 8000;
export async function chargerSur(charger, { relance = 450, verifier = verifierMorceauPerime } = {}) {
  let err = null, vide = false;
  for (let i = 0; i < 2; i++) {
    try {
      const m = await charger();
      if (moduleValide(m)) return m;
      err = null; vide = true;
    } catch (e) { err = e; vide = false; }
    if (i === 0) { await pause(relance); if (typeof document !== 'undefined' && relancerFeuilles(document)) await attendreFeuilles(document, 4000); }
  }
  // Deux fois raté. Une nouvelle version en ligne ⇒ la page se recharge : on ne rend RIEN (l'attente
  // reste à l'écran jusqu'au rechargement), jamais un écran tombé le temps qu'il parte.
  let recharge = false;
  try { recharge = await verifier('morceau'); } catch (_) {}
  // (21 nov., fluidité — Julien : « ça charge dans le vide ») Le rechargement n'a pas eu lieu (l'app installée de l'iPhone
  // peut l'ignorer) : passé 8 s, l'attente cède à l'erreur marquée « morceau » (le filet de l'écran dit « Mettre à jour
  // VRM ») — jamais un squelette pour toujours.
  if (recharge) return new Promise((_, ko) => { setTimeout(() => ko(marquer(err, vide)), ATTENTE_RECHARGEMENT_MS); });
  throw marquer(err, vide);
}

// React.lazy, sûr : à utiliser À LA PLACE de `React.lazy` partout (audit-ouverture le vérifie).
// (21 nov., fluidité — Julien : « des écrans qui se superposent quand ça charge, ça part dans tous les sens ») Un morceau
// DÉJÀ arrivé (préchargé au repos par `precharger()`, ou rendu une fois) se rend TOUT DE SUITE, sans passer par
// <Suspense> : avant, chaque première visite d'un onglet montrait l'attente du morceau (un squelette ou rien) le temps
// d'une image, puis l'écran — un clignotement à chaque premier toucher (banc couches-chargement). Une instance montée
// par React.lazy le reste (changer de type la remonterait, avec son état).
export function lazySur(charger) {
  let module = null, encours = null;
  const garder = (m) => { if (moduleValide(m)) module = m; return m; };
  const L = React.lazy(() => (encours = encours || chargerSur(charger).then(garder, (e) => { encours = null; throw e; })));
  function MorceauSur(props) {
    const voie = React.useRef(null);
    if (voie.current == null) voie.current = module ? 'direct' : 'lazy';
    return React.createElement(voie.current === 'direct' ? module.default : L, props);
  }
  // Précharger au repos : un échec ne dit rien (le rendu, lui, passera par `chargerSur` et sa relance).
  MorceauSur.precharger = () => { if (module || encours) return encours || Promise.resolve(module); try { return Promise.resolve(charger()).then(garder, () => null); } catch (_) { return Promise.resolve(null); } };
  return MorceauSur;
}
