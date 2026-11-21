// ════════════════════════════════════════════════════════════════════════════
//  LE RYTHME DES RELECTURES DE FOND (6 novembre, charge)
// ════════════════════════════════════════════════════════════════════════════
//  Julien, SEUL vendeur actif, faisait ~14 000 lectures/jour depuis ses
//  navigateurs (Mac 7 144, iPhone 6 715). Mesuré au banc
//  `scripts/bancs/charge-navigateur.cjs` : un onglet ouvert SANS que personne
//  n'y touche relisait la base 5 à 6 fois par minute (nuage, version de la
//  numérotation, âge des ventes, cloche, comptes, eBay), et un onglet CACHÉ
//  continuait une fois par minute. Un Mac laissé sur Ma journée toute la
//  journée ≈ 7 000 lectures — exactement ce que disaient les journaux.
//
//  ⇒ UNE règle pour toutes les relectures PÉRIODIQUES (jamais pour un geste) :
//   · onglet caché (`document.hidden`) : AUCUNE relecture périodique. Rien ne
//     change à l'écran que personne ne regarde ; le retour sur l'onglet relit
//     (chaque écran garde son écoute de `visibilitychange`) ;
//   · onglet visible mais personne n'y touche depuis `INACTIF_MS` (10 min) :
//     les périodes sont multipliées par `FACTEUR_INACTIF` (au moins
//     `PERIODE_INACTIF_MIN_MS`, 5 min) — un écran posé sur un second écran se
//     met encore à jour, plus lentement ;
//   · dès que la main revient (clavier, souris, doigt, retour sur l'onglet),
//     les écouteurs `surReveil` sont appelés : ce qui a vieilli est relu
//     TOUT DE SUITE, pas à la minute suivante (données fraîches au premier
//     regard).
//  Ce que la règle NE fait PAS : elle ne bloque aucune lecture faite par un
//  geste, aucune écriture, aucune relecture « lire-fusionner-réécrire » (§4) ;
//  elle ne touche ni aux réponses ni aux erreurs (« pas su » reste « pas su »).
//  Elle ne fait que dire à un minuteur « pas maintenant ».
// ════════════════════════════════════════════════════════════════════════════

export const INACTIF_MS = 10 * 60 * 1000;
export const FACTEUR_INACTIF = 5;
export const PERIODE_INACTIF_MIN_MS = 5 * 60 * 1000;
// Un minuteur ne tombe jamais pile : une seconde de marge pour qu'un tic à
// 59,9 s d'une période de 60 s ne soit pas sauté.
const MARGE_MS = 1000;
// (Pas `scroll` : l'app fait défiler elle-même — reprise de la position — et ce
// n'est pas un geste ; un défilement à la main passe par wheel/touch/clavier.)
const EVENEMENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'];

export function creerRythme({ doc, win, maintenant = () => Date.now(), inactifMs = INACTIF_MS, facteur = FACTEUR_INACTIF, minInactif = PERIODE_INACTIF_MIN_MS } = {}) {
  let derniereActivite = maintenant();
  const derniers = new Map();          // clé → dernière relecture périodique
  let reveils = [];
  const cache = () => {
    try { return !!doc && (doc.hidden === true || doc.visibilityState === 'hidden'); } catch (_) { return false; }
  };
  const inactif = (t = maintenant()) => t - derniereActivite > inactifMs;
  const periodeEffective = (periodeMs, t = maintenant()) => (inactif(t) ? Math.max(periodeMs * facteur, minInactif) : periodeMs);
  // Le geste revient : l'activité est notée ; si l'onglet dormait (inactif),
  // les relectures en retard partent maintenant.
  const activite = () => {
    const t = maintenant();
    const dormait = inactif(t);
    derniereActivite = t;
    if (dormait && !cache()) for (const f of reveils.slice()) { try { f(); } catch (_) {} }
  };
  // Le tic d'un minuteur : `true` = relire maintenant. Une relecture faite
  // ailleurs pour la même clé (geste, retour sur l'onglet) se note par `noter`.
  const doitLire = (cle, periodeMs) => {
    if (cache()) return false;
    const t = maintenant();
    const d = derniers.get(cle);
    if (d != null && t - d < periodeEffective(periodeMs, t) - MARGE_MS) return false;
    derniers.set(cle, t);
    return true;
  };
  const noter = (cle) => { derniers.set(cle, maintenant()); };
  const surReveil = (f) => { reveils.push(f); return () => { reveils = reveils.filter((x) => x !== f); }; };
  if (win && typeof win.addEventListener === 'function') {
    let derniereVue = 0;
    const leger = () => { const t = maintenant(); if (t - derniereVue < 2000 && !inactif(t)) return; derniereVue = t; activite(); };
    for (const e of EVENEMENTS) { try { win.addEventListener(e, leger, { passive: true, capture: true }); } catch (_) {} }
    try { win.addEventListener('focus', activite); } catch (_) {}
  }
  if (doc && typeof doc.addEventListener === 'function') {
    try { doc.addEventListener('visibilitychange', () => { if (!cache()) activite(); }); } catch (_) {}
  }
  return { doitLire, noter, surReveil, cache, inactif: () => inactif(), periodeEffective: (p) => periodeEffective(p), activite };
}

// L'instance de l'app, une fois.
let _rythme = null;
export function rythme() {
  if (_rythme) return _rythme;
  _rythme = creerRythme({ doc: typeof document !== 'undefined' ? document : null, win: typeof window !== 'undefined' ? window : null });
  return _rythme;
}
