// ════════════════════════════════════════════════════════════════════════════
//  ANNONCES TOUT DE SUITE — CE QUI EST RANGÉ (11 nov., lot « ouverture-legere-2 » ;
//  passation finale §D2 : « un instantané pour Annonces », comme Ma journée, Colis
//  et Ventes).
//
//  La règle commune (clé `vrm_annonces_instantane:<uid>`, uid dans la valeur, âge
//  ≤ 3 jours, un seul compte sur l'appareil, jamais dans le nuage, effacée à la
//  déconnexion) est src/instantaneEcran.js. Ici : ce qu'Annonces RANGE, relu dans
//  l'écran vrai (texte et `data-*` rendus, rien recalculé, §11), sur LISTE BLANCHE :
//    · la phrase de l'écran, la carte des chiffres (`[data-carte-stats="annonces"]`) ;
//    · le NOMBRE de puces de compte (jamais leur nom) ;
//    · par annonce, dans l'ordre rendu (24 au plus) : N°, titre court (60 car.),
//      prix rendu (ce que montre la vignette fermée).
//  JAMAIS : ni photo, ni lien, ni identifiant d'annonce, ni nom de compte, ni prix
//  d'achat, ni note privée.
//  Rangé seulement sur la vue d'ouverture : Vinted · Annonces, compte « Tous »,
//  recherche vide. Une valeur encore « lecture… » ⇒ rien n'est rangé.
// Exécuté par scripts/tests/annonces-instantanee.test.mjs et scripts/bancs/ouverture-legere-2.cjs.
// ════════════════════════════════════════════════════════════════════════════
import { attr, txt, enLecture, propre, capturerCarte, enTeteInstantane, lireInstantaneEcran, ecrireInstantaneEcran, ageInstantane, carteMontrable } from './instantaneEcran.js';

const MAX_FICHES = 24;
const RE_NUM = /^[A-Za-z]{0,3}\d{1,6}$/;

// `racine` = la section `[data-tache="annonces"]` rendue (Vinted · Annonces).
export function capturerAnnonces(racine, { uid, maintenant = Date.now(), largeur = 0 } = {}) {
  if (!racine || !uid) return null;
  if (attr(racine, 'data-tache-site') !== 'vinted' || attr(racine, 'data-tache-section') !== 'annonces') return null;
  // Le compte « Tous » seulement (l'écran s'ouvre ainsi) ; une recherche en cours n'est pas la vue d'ouverture.
  const puces = [...racine.querySelectorAll('[data-compte-puces] [data-compte-puce]')];
  const actif = puces.find((b) => attr(b, 'data-actif') === '1');
  if (puces.length && (!actif || attr(actif, 'data-compte-puce') !== '*')) return null;
  if (racine.querySelector('[data-champ-recherche-plein="1"]')) return null;
  const carteEl = racine.querySelector('[data-carte-stats="annonces"]');
  const carte = carteEl ? capturerCarte(carteEl) : null;
  if (carteEl && !carte) return null;
  const fiches = [...racine.querySelectorAll('[data-carte-annonce]')].slice(0, MAX_FICHES).map((el) => {
    const num = attr(el.querySelector('[data-fiche-num]'), 'data-fiche-num') || '';
    return {
      num: RE_NUM.test(num) ? num : '',
      titre: txt(el.querySelector('[data-titre]'), 60),
      prix: txt(el.querySelector('[data-prix]'), 20),
    };
  });
  if (!fiches.length) return null;
  if (fiches.some((f) => enLecture(f.titre) || enLecture(f.prix))) return null;
  const snap = enTeteInstantane('annonces', uid, maintenant, largeur);
  snap.phrase = txt(racine.querySelector('[data-phrase-ecran="annonces"]'), 120) || '';
  snap.puces = puces.length;
  // La carte d'Annonces dit son chiffre aussi dans le libellé, pour le lecteur d'écran
  // (« Qui dorment : 0 ») : le libellé rangé est celui qu'on VOIT.
  if (carte && Array.isArray(carte.cases)) carte.cases = carte.cases.map((c) => { const suf = ` : ${c.b}`; return c.b && c.l.endsWith(suf) ? { ...c, l: c.l.slice(0, -suf.length) } : c; });
  snap.carte = carte;
  snap.fiches = fiches;
  // L'écart entre la carte et les vignettes (recherche, filtres : des gestes, jamais rangés) : sa hauteur seulement.
  try {
    const g = racine.querySelector('.vrm-ann-grid'); const h = carteEl && carteEl.parentElement;
    snap.ecart = g && h ? Math.max(0, Math.min(300, Math.round(g.getBoundingClientRect().top - h.getBoundingClientRect().bottom))) : 0;
  } catch (_) { snap.ecart = 0; }
  return snap;
}

export const lireInstantaneAnnonces = (uid, opts) => lireInstantaneEcran('annonces', uid, opts);
export const ecrireInstantaneAnnonces = (snap, opts) => ecrireInstantaneEcran('annonces', snap, opts);

// Ce qui se montre : la carte selon sa portée (jour / mois) ; plus de 3 jours : rien.
export function annoncesMontrable(s, maintenant = Date.now()) {
  if (!s || s.ecran !== 'annonces' || !Array.isArray(s.fiches) || !s.fiches.length) return null;
  const A = ageInstantane(s, maintenant);
  return {
    ...A, phrase: propre(s.phrase || '', 120), puces: Math.max(0, Math.min(20, Number(s.puces) || 0)),
    carte: carteMontrable(s.carte, A), ecart: Math.max(0, Math.min(300, Number(s.ecart) || 0)),
    fiches: s.fiches.slice(0, MAX_FICHES).map((f) => ({ num: RE_NUM.test(String(f.num || '')) ? String(f.num) : '', titre: propre(f.titre, 60), prix: propre(f.prix, 20) })),
  };
}
